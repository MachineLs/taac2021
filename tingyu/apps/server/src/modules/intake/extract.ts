// Rule-based slot extraction for the intake assistant. Owner: B2.
import type { ConsultMode } from '@tingyu/shared';

type Tag = '焦虑' | '失眠' | '情绪低落' | '职场压力' | '亲密关系' | '婚姻' | '家庭沟通' | '亲子' | '青少年' | '创伤' | '自我成长' | '正念';

/** keyword → issue tags (ISSUE_TAGS). Longer / more specific keywords first. */
const TOPIC_RULES: [RegExp, Tag[]][] = [
  [/失眠|睡不着|睡不好|睡不踏实|入睡|早醒|半夜.{0,2}醒|睡眠|多梦|整夜|熬夜|躺下.{0,6}(停不下来|清醒)/, ['失眠']],
  [/焦虑|紧张|心慌|恐慌|不安|担心|慌|坐立不安|压力/, ['焦虑']],
  [/工作|加班|老板|领导|上班|职场|同事|绩效|KPI|kpi|裁员|辞职|失业|996|项目|考核|上司|升职|跳槽/, ['职场压力']],
  [/难过|难受|想哭|哭|没意思|低落|抑郁|消沉|开心不起来|不开心|提不起劲|没动力|空虚|郁闷|心情不好|心情很差|丧|孤独|绝望|麻木/, ['情绪低落']],
  [/老公|老婆|丈夫|妻子|婚姻|离婚|结婚|出轨|婆婆|婆媳|婚后/, ['婚姻', '亲密关系']],
  [/分手|男朋友|女朋友|男友|女友|对象|恋爱|前任|暧昧|失恋|感情|伴侣|喜欢的人/, ['亲密关系']],
  [/父母|爸妈|爸爸|妈妈|家里人|家人|原生家庭|家庭/, ['家庭沟通']],
  [/孩子|家长|儿子|女儿|宝宝|带娃|育儿|叛逆|小孩/, ['亲子']],
  [/学生|上学|高考|中考|考试|学校|同学|青春期|厌学|大学|考研|作业/, ['青少年']],
  [/创伤|阴影|噩梦|闪回|事故|虐待|霸凌|被欺负|性侵|去世|离世|走了以后|失去/, ['创伤']],
  [/迷茫|自卑|成长|不知道自己想要|方向|拖延|自信|意义感|认识自己/, ['自我成长']],
  [/正念|冥想|放松一下|静下心/, ['正念']],
];

export interface TopicHit { tag: Tag; keyword: string; index: number }

/** Topics in order of first appearance in the text. */
export function extractTopics(text: string): TopicHit[] {
  const hits = new Map<Tag, TopicHit>();
  for (const [re, tags] of TOPIC_RULES) {
    const m = re.exec(text);
    if (!m) continue;
    for (const tag of tags) {
      const prev = hits.get(tag);
      if (!prev || m.index < prev.index) hits.set(tag, { tag, keyword: m[0], index: m.index });
    }
  }
  // "没有不开心" style negations are rare in a first complaint; keep extraction simple.
  return [...hits.values()].sort((a, b) => a.index - b.index);
}

// ---------- duration ----------
const CN_NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 几: 3 };
function cnToNum(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_NUM[s[1]] ?? 0);
  if (s.endsWith('十')) return (CN_NUM[s[0]] ?? 1) * 10;
  if (s.includes('十')) return (CN_NUM[s[0]] ?? 1) * 10 + (CN_NUM[s[2]] ?? 0);
  return CN_NUM[s] ?? 1;
}
const UNIT_DAYS: Record<string, number> = { 天: 1, 周: 7, 星期: 7, 礼拜: 7, 月: 30, 年: 365 };
const UNIT_LABEL: Record<string, string> = { 天: '天', 周: '周', 星期: '周', 礼拜: '周', 月: '个月', 年: '年' };

export interface DurationHit { label: string; days: number }

/** `loose` also accepts vague answers ("这几天", "很久"), used when the assistant just asked about duration. */
export function extractDuration(text: string, loose = true): DurationHit | null {
  const t = text.replace(/\s+/g, '');
  if (/大半年/.test(t)) return { label: '大半年', days: 240 };
  if (/半年多/.test(t)) return { label: '半年多', days: 200 };
  if (/半年/.test(t)) return { label: '半年', days: 180 };
  if (/半个?月/.test(t)) return { label: '半个月', days: 15 };
  const m = /(\d+|[一两二三四五六七八九十几]+)(多)?(个)?(多)?(天|周|星期|礼拜|月|年)(多)?/.exec(t);
  if (m) {
    const word = m[1];
    const unit = m[5];
    if (unit === '月' && !m[3] && !/^\d+$/.test(word)) {
      // "三月" = March, not a duration; but "几月" is unclear — skip both
      return null;
    }
    const n = cnToNum(word);
    const more = !!(m[2] || m[4] || m[6]);
    const isVague = word === '几';
    const days = Math.round(n * UNIT_DAYS[unit] * (more ? 1.3 : 1));
    const unitLabel = UNIT_LABEL[unit];
    let label: string;
    if (isVague) label = `好几${unitLabel}`;
    else if (unit === '月') label = `${n} 个${more ? '多' : ''}月`;
    else label = `${n} ${unitLabel}${more ? '多' : ''}`;
    if (/好几/.test(t) && isVague) label = `好几${unitLabel}`;
    return { label, days };
  }
  if (!loose) return null;
  if (/去年|一年前/.test(t)) return { label: '1 年左右', days: 365 };
  if (/上个月/.test(t)) return { label: '1 个月左右', days: 30 };
  if (/上周|上个星期/.test(t)) return { label: '1 周左右', days: 7 };
  if (/从小|很多年|好多年|一直都|很久很久/.test(t)) return { label: '很多年', days: 1500 };
  if (/很久|好久|挺久|有一阵|一段时间|有段时间/.test(t)) return { label: '有一段时间', days: 60 };
  if (/这几天|这两天|最近几天|前几天|昨天|今天|刚刚|刚开始/.test(t)) return { label: '最近几天', days: 4 };
  return null;
}

// ---------- impact ----------
const IMPACT_RULES: [RegExp, string][] = [
  [/睡|失眠|醒/, '睡眠'],
  [/工作|上班|效率|注意力|专注|走神|学习|上课|成绩|做事/, '工作'],
  [/吵架|关系|(?<![男女])朋友|家人|社交|不想见人|不想说话|相处|沟通/, '关系'],
  [/吃不下|胃口|食欲|暴食|吃得/, '饮食'],
  [/没精神|疲惫|很累|好累|累|头疼|头痛|胸闷|心慌|没力气|没劲/, '精力'],
];
export interface ImpactHit { areas: string[]; severity: 'mild' | 'moderate' | 'severe' | null }

export function extractImpact(text: string): ImpactHit | null {
  const areas: string[] = [];
  for (const [re, area] of IMPACT_RULES) if (re.test(text) && !areas.includes(area)) areas.push(area);
  let severity: ImpactHit['severity'] = null;
  if (/影响(很|特别|非常|挺|蛮)?大|很严重|特别严重|严重|完全|根本|没法|没办法|撑不住|扛不住|崩溃/.test(text)) severity = 'severe';
  else if (/有(一些|一点|些)影响|有点影响|一点点|有影响|还行吧|多少有/.test(text)) severity = 'moderate';
  else if (/没什么影响|影响不大|没影响|还好|不太影响|还可以|没有影响/.test(text)) severity = 'mild';
  if (!areas.length && !severity) return null;
  return { areas, severity };
}

// ---------- modality ----------
export function extractModality(text: string): { mode: ConsultMode | null; flexible: boolean } | null {
  if (/视频/.test(text)) return { mode: 'video', flexible: false };
  if (/面询|面对面|线下|见面|当面|到店|门店/.test(text)) return { mode: 'offline', flexible: false };
  if (/文字|打字|发消息|聊天框|文字聊/.test(text)) return { mode: 'text', flexible: false };
  if (/语音|电话|打电话|声音|音频/.test(text)) return { mode: 'voice', flexible: false };
  if (/都可以|都行|随便|无所谓|都好|没要求|你定|看你/.test(text)) return { mode: null, flexible: true };
  return null;
}

// ---------- yes / no ----------
export type YesNo = 'yes' | 'no' | null;
/** Answer to "有没有伤害自己的念头" (crisis words are handled before this). */
export function safetyAnswer(text: string): YesNo {
  const t = text.replace(/\s+/g, '');
  if (/^(没|没有|无|不会|从没|从来没|从未|那倒没有|倒没有|没想过|还好|不至于|没那么严重|应该没有|并没有|no|No|NO)/.test(t)) return 'no';
  if (/没有|没想过|不会|从来没|从未|没那种|没这种|不至于/.test(t)) return 'no';
  if (/^(有|有过|有的|会|偶尔|有时候|有时|有一点|想过|是的|是|嗯有)/.test(t) || /想过|有过|有时候会|偶尔会/.test(t)) return 'yes';
  return null;
}

/** Generic agreement for "要不要预约". */
export function agreement(text: string): YesNo {
  const t = text.replace(/\s+/g, '');
  if (/不用|不要|先不|再想想|再考虑|考虑一下|算了|暂时不|以后再|还没想好|不了|不需要/.test(t)) return 'no';
  if (/^(好|可以|行|要|嗯|约|预约|好的|好啊|OK|ok|麻烦|需要|当然|没问题|是的|对)/.test(t) || /帮我约|想约|预约吧|可以|好的|都行/.test(t)) return 'yes';
  return null;
}

// ---------- off-topic questions ----------
export function faqAnswer(text: string, priceRange: [number, number] | null): string | null {
  if (/(吃|开|用|推荐|买).{0,4}药|药物|药吗|吃药|安眠药|褪黑素/.test(text)) return '用药的问题需要医生面诊后判断，我没办法给建议。';
  if (/诊断|是不是.{0,4}(抑郁症|焦虑症|病)|我是不是有病|算不算.{0,3}(病|抑郁症)|确诊/.test(text)) return '我不能做诊断，但可以帮你把情况理清楚，交给专业咨询师判断。';
  if (/你是(谁|人|机器人|AI|ai|真人)|机器人吗|是真人吗|是AI吗|是ai吗/.test(text)) return '我是听屿的 AI 接待助手小屿，负责了解情况、帮你匹配合适的咨询师。';
  if (/多少钱|价格|费用|收费|贵不贵|便宜/.test(text)) {
    return priceRange ? `咨询师每次 50 分钟，价格在 ${priceRange[0]} 到 ${priceRange[1]} 元之间，首单可用新人券。` : '每位咨询师的价格不同，首单可以使用新人券。';
  }
  if (/隐私|保密|泄露|别人知道|会被看到/.test(text)) return '你说的内容只有你和为你服务的咨询师能看到，请放心。';
  if (/能治好|治得好|多久能好|保证|有效果吗|有用吗/.test(text)) return '每个人的情况不同，我没法承诺效果，但专业咨询师会和你一起找到合适的方法。';
  return null;
}
