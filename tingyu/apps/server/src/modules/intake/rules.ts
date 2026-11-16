// Rule-based intake provider (default; also the fallback for the LLM provider). Owner: B2.
// Slot-filling conversation: issue → duration → impact → safety → modality → recommend → booking → closing.
import { MODE_LABEL, type ConsultMode, type IntakeSummary, type RiskLevel, type ScaleId } from '@tingyu/shared';
import { SCALE_MAX, scaleLevel } from '../assessments/scales';
import { agreement, extractDuration, extractImpact, extractModality, extractTopics, faqAnswer, safetyAnswer, type TopicHit } from './extract';
import { fmtWhen, priceRange, recommendCounselors } from './match';
import { MAX_TURNS, SLOT_ORDER, type HistoryItem, type IntakeProvider, type IntakeState, type ReplyResult, type Slot } from './provider';

export const MAX_REPLY_CHARS = 80;

// ---------- greeting ----------
export function greeting(now = new Date()): string {
  const h = new Date(now.getTime() + 8 * 3600000).getUTCHours();
  const intro = '我是听屿的接待助手小屿。这里很安全，你说的内容只有你和为你服务的咨询师能看到。';
  if (h < 5) return `夜深了，${intro}这么晚还没睡，想聊点什么？`;
  if (h < 11) return `早上好，${intro}今天想聊点什么？`;
  if (h < 13) return `中午好，${intro}今天想聊点什么？`;
  if (h < 18) return `下午好，${intro}今天想聊点什么？`;
  return `晚上好，${intro}今晚想聊点什么？`;
}

// ---------- phrasing ----------
const QUESTIONS: Record<Slot, [string, string]> = {
  issue: ['最近是什么事让你最困扰呢？', '能多说一点吗？比如是睡眠、情绪、工作，还是关系上的事？'],
  duration: ['这种情况大概持续多久了？', '大概是从什么时候开始的？几天、几周，还是更久？'],
  impact: ['这对你的睡眠、工作或者人际关系，影响大吗？', '比如白天的精神、做事的效率，或者和身边人的相处，有受影响吗？'],
  safety: ['我想确认一下，最近有没有出现过伤害自己的念头？', '这个问题很重要，我再确认一下：最近有没有想过伤害自己？'],
  modality: ['你更习惯语音、视频、文字，还是面对面的咨询？', '咨询可以用语音、视频、文字或面询，你比较喜欢哪种？'],
};

const TOPIC_PHRASE: Record<string, (kw: string) => string> = {
  失眠: (kw) => (/睡|醒/.test(kw) ? `晚上${kw.length <= 4 ? kw : '睡不好'}的滋味真的很磨人。` : '睡不好的日子真的很磨人。'),
  焦虑: () => '听起来你心里一直绷着，很难真正放松下来。',
  职场压力: () => '工作上的事一直压着你，下了班也很难放下。',
  情绪低落: () => '听起来你最近心里很沉，常常开心不起来。',
  亲密关系: () => '感情里的事最牵动人，你一定很难受。',
  婚姻: () => '婚姻里的困扰，往往说不出口又放不下。',
  家庭沟通: () => '和家人之间的拉扯，常常让人又累又委屈。',
  亲子: () => '为孩子操心的同时，你自己也需要被照顾。',
  青少年: () => '学业和成长的压力，真的不轻松。',
  创伤: () => '那些经历留下的影响很重，你能说出来已经很勇敢。',
  自我成长: () => '对自己和未来感到迷茫，很多人都经历过。',
  正念: () => '想让自己慢下来，这是很好的开始。',
};

function topicReflection(hits: TopicHit[]): string {
  const first = hits[0];
  let s = TOPIC_PHRASE[first.tag]?.(first.keyword) ?? '谢谢你愿意说出来。';
  if (first.tag !== '失眠' && hits.some((h) => h.tag === '失眠')) s = s.replace(/。$/, '，连睡觉都受了影响。');
  return s;
}

function durationReflection(label: string, days: number): string {
  if (label === '最近几天') return '这几天一定很难熬。';
  if (label === '很多年') return '这么多年一直带着它，辛苦你了。';
  if (label === '有一段时间') return '持续了一段时间，一直扛着不容易。';
  return days >= 30 ? `${label}了，一直这样扛着真的不容易。` : `${label}了，这段时间你一定很难受。`;
}

function impactReflection(areas: string[], severity: IntakeState['impactSeverity']): string {
  if (severity === 'mild' && !areas.length) return '听起来生活还能维持，但心里一直不轻松。';
  const a = areas.filter((x) => x !== '精力').slice(0, 2);
  if (areas.includes('精力') && !a.length) return '白天也没什么精神，确实很消耗人。';
  if (a.length) return `连${a.join('和')}都受到了影响，这段时间你一定很辛苦。`;
  return severity === 'severe' ? '影响这么大，这段时间你一定很辛苦。' : '我记下了，谢谢你告诉我。';
}

const MODE_PHRASE: Record<ConsultMode, string> = {
  voice: '好的，语音不用露脸，会轻松一些。',
  video: '好的，视频能看到彼此，交流会更充分。',
  text: '好的，文字可以慢慢组织语言，也很好。',
  offline: '好的，面对面聊会更有温度。',
};

const FILLERS = ['没关系，慢慢想。', '嗯，我明白。'];

/** Join sentences, dropping optional (leading) parts until the reply fits the length budget. */
export function fit(optional: string[], required: string[]): string {
  const opt = optional.filter(Boolean);
  while (opt.length && [...opt, ...required].join('').length > MAX_REPLY_CHARS) opt.shift();
  return [...opt, ...required].join('');
}

// ---------- signals for scale estimates ----------
const count = (re: RegExp, t: string) => (t.match(new RegExp(re.source, 'g')) || []).length;
function updateSignals(s: IntakeState, text: string) {
  s.signals.low += count(/难过|想哭|哭|没意思|低落|抑郁|开心不起来|不开心|提不起劲|没动力|空虚|绝望|麻木|自责|没用/, text);
  s.signals.anxiety += count(/焦虑|紧张|担心|心慌|不安|害怕|慌|停不下来|烦躁|压力/, text);
  s.signals.sleep += count(/睡不着|失眠|睡不好|早醒|半夜.{0,2}醒|多梦|入睡|整夜/, text);
  s.signals.fatigue += count(/累|没精神|疲惫|没力气|没劲|困/, text);
}

const clone = (s: IntakeState): IntakeState => JSON.parse(JSON.stringify(s));

/** State update for a turn that was handled by the crisis layer (no provider reply). */
export function markCrisis(state: IntakeState, text: string): IntakeState {
  const s = clone(state);
  s.turns += 1;
  updateSignals(s, text);
  const hits = extractTopics(text).filter((h) => !s.topics.includes(h.tag));
  if (hits.length) {
    s.topics.push(...hits.map((h) => h.tag));
    if (!s.slots.issue) { s.slots.issue = 'done'; s.issueText = text.slice(0, 200); }
  }
  s.crisis = true; s.safety = 'risk'; s.slots.safety = 'done';
  s.stage = 'crisis_check'; s.retries.crisis_check = 0;
  return s;
}
const nextSlot = (s: IntakeState): Slot | undefined => SLOT_ORDER.find((k) => !s.slots[k]);

function recommendText(s: IntakeState): string {
  const recs = recommendCounselors(s.topics.length ? s.topics : ['自我成长'], s.modality);
  s.recommended = recs.map((c) => c.id);
  s.stage = 'booking';
  const top = recs[0];
  if (!top) { s.stage = 'closing'; return '我已经整理好你的情况，稍后可以在找咨询师页面挑选合适的老师。'; }
  const tags = s.topics.filter((t) => top.tags.includes(t)).slice(0, 2);
  const skill = tags.length ? `擅长${tags.join('和')}的` : '';
  const when = top.nextAt ? `${fmtWhen(top.nextAt)} 就能约` : '';
  const mode = s.modality && top.modes.includes(s.modality) ? MODE_LABEL[s.modality] : MODE_LABEL[top.modes[0] ?? 'voice'];
  return `我为你推荐${skill}${top.name}老师${when ? `，${when}` : ''}。要不要现在帮你预约一次${mode}咨询？`;
}

/** Pure rule step: returns the reply text and the next state. */
export function ruleStep(history: HistoryItem[], state: IntakeState): ReplyResult {
  const s = clone(state);
  s.provider = s.provider ?? 'rules';
  const text = [...history].reverse().find((m) => m.role === 'user')?.content.trim() ?? '';
  s.turns += 1;
  updateSignals(s, text);
  const asked = s.stage;
  const filledNow = new Set<string>();

  // --- slot extraction from this message ---
  const hits = extractTopics(text).filter((h) => !s.topics.includes(h.tag));
  if (hits.length) {
    s.topics.push(...hits.map((h) => h.tag));
    if (s.slots.issue !== 'done') { s.slots.issue = 'done'; s.issueText = text.slice(0, 200); filledNow.add('issue'); }
  }
  if (!s.slots.duration || s.slots.duration === 'skipped') {
    const d = extractDuration(text);
    if (d) { s.duration = d.label; s.durationDays = d.days; s.slots.duration = 'done'; filledNow.add('duration'); }
  }
  if (asked !== 'issue' && !filledNow.has('issue')) {
    const imp = extractImpact(text);
    if (imp) {
      for (const a of imp.areas) if (!s.impactAreas.includes(a)) s.impactAreas.push(a);
      s.impactSeverity = imp.severity ?? s.impactSeverity;
      if (!s.slots.impact || s.slots.impact === 'skipped') { s.slots.impact = 'done'; filledNow.add('impact'); }
    }
  }
  if (asked === 'safety') {
    const a = safetyAnswer(text);
    if (a === 'no') { s.safety = 'safe'; s.slots.safety = 'done'; filledNow.add('safety'); }
    else if (a === 'yes') { s.safety = 'risk'; s.crisis = true; s.slots.safety = 'done'; filledNow.add('safety'); }
  }
  const mod = extractModality(text);
  if (mod && (asked === 'modality' || mod.mode)) {
    s.modality = mod.mode ?? s.modality ?? 'voice';
    if (!s.slots.modality || mod.mode) { s.slots.modality = 'done'; filledNow.add('modality'); }
  }

  const faq = faqAnswer(text, priceRange());

  // --- safety "yes": the service layer turns this into crisis handling; keep a safe text anyway ---
  if (s.safety === 'risk' && filledNow.has('safety')) {
    s.stage = nextSlot(s) ?? 'booking';
    return { text: '谢谢你告诉我，我很在意你的安全。你现在安全吗？如果有危险请马上拨打 120 或 12356 心理援助热线。', state: s };
  }

  // --- after recommendation ---
  if (asked === 'booking') {
    const a = agreement(text);
    if (a === 'yes') { s.booking = 'yes'; s.stage = 'closing'; return { text: fit(faq ? [faq] : [], ['好的，点下方老师的卡片就能选时间预约。接待小结要经过你同意，才会给咨询师看。']), state: s }; }
    if (a === 'no') { s.booking = 'no'; s.stage = 'closing'; return { text: fit(faq ? [faq] : [], ['没关系，不用着急决定。你可以随时回来找我，也记得好好照顾自己。']), state: s }; }
    const r = (s.retries.booking ?? 0) + 1; s.retries.booking = r;
    if (r < 2) return { text: fit([faq ?? (hits.length ? '这一点我也记下了。' : '嗯，我明白。')], ['要不要现在帮你看看老师最近可约的时间？']), state: s };
    s.stage = 'closing';
    return { text: fit([faq ?? ''], ['好的，你可以先看看推荐的老师，准备好了再预约。']), state: s };
  }
  if (asked === 'closing') {
    const pre = faq ?? (hits.length ? '这一点我也记下了，会写进接待小结。' : '我在呢，谢谢你和我说这些。');
    return { text: fit([pre], ['准备好了，可以点结束对话，看看你的接待小结。']), state: s };
  }

  // --- reflection (empathetic restatement) ---
  let reflection = '';
  if (asked === 'safety' && filledNow.has('safety')) reflection = '好的，谢谢你如实告诉我。';
  else if (filledNow.has('modality') && asked === 'modality') reflection = s.modality && mod?.mode ? MODE_PHRASE[s.modality] : '好的，那我按老师的擅长来帮你挑。';
  else if (asked === 'duration' && filledNow.has('duration')) {
    reflection = durationReflection(s.duration!, s.durationDays ?? 0);
    if (filledNow.has('impact') && s.impactAreas.includes('精力')) reflection = reflection.replace(/。$/, '，白天还没精神，很消耗人。');
  } else if (hits.length) reflection = topicReflection(hits);
  else if (filledNow.has('impact')) reflection = impactReflection(s.impactAreas, s.impactSeverity);
  else if (filledNow.has('duration')) reflection = durationReflection(s.duration!, s.durationDays ?? 0);

  // --- follow-up after crisis handling: make sure the person is safe before anything else ---
  if (asked === 'crisis_check') {
    const unsafe = /不安全|不太安全|危险|不好|撑不住|不知道|没人|一个人/.test(text);
    const safe = !unsafe && /安全|没事|还好|好多了|好一点|在家|有人陪|不会做傻事|放心|冷静|没关系|好的|嗯/.test(text);
    if (!safe) {
      const r = (s.retries.crisis_check ?? 0) + 1; s.retries.crisis_check = r;
      if (r < 2) return { text: '请先保护好自己，现在就拨打 120 或 12356，也可以请身边信任的人陪着你。我会一直在这里。', state: s };
      reflection = '我会一直在这里陪你，也请记得 12356 随时可以打。';
    } else reflection = '谢谢你告诉我，平台的值班同事也会关注你。';
  }

  // --- turn cap: wrap up ---
  if (s.turns >= MAX_TURNS) {
    for (const k of ['issue', 'duration', 'impact', 'modality'] as Slot[]) if (!s.slots[k]) s.slots[k] = 'skipped';
    if (!s.slots.safety) { s.stage = 'safety'; return { text: fit([faq ?? '时间差不多了，最后我想确认一件事。'], [QUESTIONS.safety[0]]), state: s }; }
    if (!s.modality) s.modality = 'voice';
    if (!s.recommended.length) return { text: fit([faq ?? reflection, '今天先聊到这里。'], [recommendText(s)]), state: s };
    s.stage = 'closing';
    return { text: fit([faq ?? reflection], ['今天先聊到这里，准备好了可以点结束对话，看看接待小结。']), state: s };
  }

  // --- the asked slot was not answered: follow up naturally ---
  const askedSlot = (SLOT_ORDER as string[]).includes(asked) ? (asked as Slot) : null;
  if (askedSlot && !s.slots[askedSlot]) {
    if (faq) return { text: fit([], [faq, QUESTIONS[askedSlot][0]]), state: s };
    const r = (s.retries[askedSlot] ?? 0) + 1; s.retries[askedSlot] = r;
    if (r < 2) {
      if (askedSlot === 'issue') reflection = reflection || '嗯，我在听。';
      return { text: fit([reflection || FILLERS[(s.turns + r) % FILLERS.length]], [QUESTIONS[askedSlot][1]]), state: s };
    }
    // give up on this slot after two follow-ups
    s.slots[askedSlot] = 'skipped';
    if (askedSlot === 'safety') s.safety = 'unclear';
    if (askedSlot === 'modality') s.modality = 'voice';
    reflection = reflection || '没关系，我们先往下聊。';
  }

  const nxt = nextSlot(s);
  if (nxt) {
    s.stage = nxt;
    return { text: fit([faq ?? reflection], [QUESTIONS[nxt][0]]), state: s };
  }
  if (!s.recommended.length) return { text: fit([faq ?? reflection], [recommendText(s)]), state: s };
  s.stage = 'closing';
  return { text: fit([faq ?? reflection], ['准备好了，可以点结束对话，看看你的接待小结。']), state: s };
}

// ---------- summary ----------
const MOOD_WORD: Record<string, string> = { 焦虑: '焦虑', 失眠: '疲惫', 情绪低落: '低落', 职场压力: '压力大', 亲密关系: '委屈', 婚姻: '委屈', 家庭沟通: '委屈', 亲子: '操心', 青少年: '迷茫', 创伤: '不安', 自我成长: '迷茫', 正念: '平和' };
const ASSESS_NAME: Record<string, string> = { 失眠: '睡眠', 焦虑: '焦虑', 职场压力: '压力', 情绪低落: '情绪', 亲密关系: '关系模式', 婚姻: '婚姻关系', 家庭沟通: '家庭沟通', 亲子: '亲子关系', 青少年: '学业与成长', 创伤: '创伤影响', 自我成长: '自我探索', 正念: '身心状态' };
const INTERVENTION: Record<string, string> = {
  失眠: 'CBT-I 失眠认知行为干预 6 次',
  焦虑: '认知行为咨询 6–8 次',
  职场压力: '焦点解决短程咨询 4–6 次',
  情绪低落: 'ACT / CBT 咨询 6–8 次',
  亲密关系: '情绪聚焦咨询 6–8 次',
  婚姻: '伴侣或个体咨询 6–8 次',
  家庭沟通: '家庭系统咨询 6 次',
  亲子: '家长指导与家庭咨询 6 次',
  青少年: '青少年支持性咨询 6 次',
  创伤: '稳定化与创伤知情咨询',
  自我成长: '自我探索咨询 6 次',
  正念: '正念减压练习 8 周',
};

export function buildPlan(topics: string[], risk: RiskLevel): string {
  const ts = topics.length ? topics : ['自我成长'];
  const assessTopics = (ts.includes('失眠') ? ['失眠', ...ts.filter((t) => t !== '失眠')] : ts).slice(0, 2);
  const assess = `${[...new Set(assessTopics.map((t) => ASSESS_NAME[t]))].join('与')}评估`;
  const main = INTERVENTION[ts.includes('失眠') ? '失眠' : ts[0]] ?? '支持性咨询 4–6 次';
  return [risk === 'high' ? '24 小时内危机回访与安全计划' : '', assess, main, '每周情绪追踪'].filter(Boolean).join(' → ') + '（由咨询师评估后执行）';
}

export function estimateScales(s: IntakeState): IntakeSummary['scales'] {
  const long = (s.durationDays ?? 0) >= 14;
  const severe = s.impactSeverity === 'severe';
  const has = (t: string) => s.topics.includes(t);
  let phq = 1 + (has('情绪低落') ? 6 : 0) + Math.min(s.signals.low, 4) * 2 + (s.signals.sleep > 0 || has('失眠') ? 2 : 0)
    + (s.signals.fatigue > 0 ? 2 : 0) + (long ? 1 : 0) + (severe ? 3 : 0);
  if (s.crisis) phq = Math.max(phq + 3, 15);
  let gad = 1 + (has('焦虑') ? 6 : 0) + Math.min(s.signals.anxiety, 4) * 2 + (has('职场压力') ? 2 : 0) + (long ? 1 : 0) + (severe ? 2 : 0);
  let isi = 1 + (has('失眠') ? 9 : 0) + Math.min(s.signals.sleep, 3) * 2 + ((s.durationDays ?? 0) >= 30 && has('失眠') ? 3 : 0) + (severe && has('失眠') ? 2 : 0);
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
  phq = clamp(phq, 27); gad = clamp(gad, 21); isi = clamp(isi, 28);
  return (['phq9', 'gad7', 'isi'] as ScaleId[]).map((scale, i) => {
    const score = [phq, gad, isi][i];
    return { scale, score, max: SCALE_MAX[scale], level: scaleLevel(scale, score) };
  });
}

export function ruleSummary(history: HistoryItem[], state: IntakeState): IntakeSummary {
  const s = clone(state);
  if (!s.topics.length) {
    const all = history.filter((m) => m.role === 'user').map((m) => m.content).join('。');
    s.topics = extractTopics(all).map((h) => h.tag);
    if (!s.duration) { const d = extractDuration(all); if (d) { s.duration = d.label; s.durationDays = d.days; } }
  }
  const topics = s.topics.slice(0, 4);
  const risk: RiskLevel = s.crisis || s.safety === 'risk' ? 'high'
    : s.safety === 'unclear' || ((s.durationDays ?? 0) >= 60 && topics.includes('情绪低落') && s.impactSeverity === 'severe') ? 'medium' : 'low';
  const moods = [...new Set(topics.map((t) => MOOD_WORD[t]).filter(Boolean))];
  if (s.signals.fatigue > 0 && !moods.includes('疲惫')) moods.push('疲惫');
  const mood = moods.slice(0, 2).join(' · ') || '平稳';

  let score = 72 - topics.length * 5 - Math.min(s.signals.low, 4) * 4 - Math.min(s.signals.anxiety, 4) * 3 - Math.min(s.signals.sleep, 3) * 2;
  if ((s.durationDays ?? 0) >= 180) score -= 10; else if ((s.durationDays ?? 0) >= 30) score -= 6;
  if (s.impactSeverity === 'severe') score -= 8; else if (s.impactSeverity === 'mild') score += 4;
  if (risk === 'high') score = Math.min(score, 20); else if (risk === 'medium') score = Math.min(score, 40);
  const moodScore = Math.max(5, Math.min(90, Math.round(score)));

  const estNote = '量表分数为根据对话的初步估计，需正式测评确认。';
  const riskNote = risk === 'high' ? `对话中出现自伤或轻生相关表达，已触发危机流程，建议 24 小时内人工回访并优先安排咨询。${estNote}`
    : risk === 'medium' ? (s.safety === 'unclear' ? `安全确认未得到明确回答，建议咨询师在首次会谈中评估风险。${estNote}` : `困扰持续时间较长且影响明显，建议尽快安排咨询并关注情绪变化。${estNote}`)
    : s.safety === 'safe' ? `未报告自伤念头，建议常规咨询。${estNote}` : `尚未完成安全确认，建议咨询师在首次会谈中评估。${estNote}`;

  const plan = buildPlan(topics, risk);

  let rec = s.recommended;
  if (!rec.length) rec = recommendCounselors(topics.length ? topics : ['自我成长'], s.modality).map((c) => c.id);
  return {
    mood, moodScore, topics, duration: s.duration ?? '未提及', risk, riskNote, scales: estimateScales(s), plan,
    modality: s.modality ?? 'voice', recommendedCounselorIds: rec.slice(0, 3),
  };
}

export const ruleProvider: IntakeProvider = {
  name: 'rules',
  async reply(history, state) { return ruleStep(history, state); },
  async summarize(history, state) { return ruleSummary(history, state); },
};
