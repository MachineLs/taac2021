// Claude-backed intake provider (used when ANTHROPIC_API_KEY is set). Owner: B2.
// Calls the Anthropic Messages API with fetch (no SDK). Any failure, refusal or timeout falls back to the rule engine.
// The rule engine still runs every turn to keep the structured state (slots, recommendations) that summaries rely on;
// Claude only writes the wording of the reply, guided by the rule engine's next step.
import { z } from 'zod';
import { ISSUE_TAGS, MODE_LABEL, type IntakeSummary } from '@tingyu/shared';
import { config } from '../../core/config';
import { approvedCounselors } from './match';
import type { HistoryItem, IntakeProvider, IntakeState } from './provider';
import { MAX_REPLY_CHARS, ruleStep, ruleSummary } from './rules';
import { detectCrisis } from './crisis';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
/** Mutable so tests can shorten the timeout. */
export const llmSettings = { timeoutMs: 8000 };
/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-fable-5-2']);

const PRINCIPLES = `你是「听屿」心理服务平台的 AI 接待助手「小屿」。
你的职责只有：接待、初步了解情况、风险识别、匹配推荐咨询师、提议预约和随访。
你不做心理咨询、不做诊断、不做治疗，不推荐或评价任何药物，不承诺任何疗效。被问到这些时，温和地说明这需要咨询师或医生来判断，然后回到接待。
说话方式：先用一句话共情复述对方刚说的内容，再只问一个问题。每次回复 1 到 3 句，总共不超过 80 个汉字。回复会被语音合成朗读，所以只用口语化的完整句子：不要列表、不要 Markdown、不要表情符号、不要括号注释。
接待流程：了解主要困扰 → 持续多久 → 对睡眠、工作或关系的影响 → 安全确认（是否有伤害自己的念头）→ 偏好的咨询方式（语音、视频、文字、面询）→ 推荐 1 到 3 位咨询师并提议预约。对方答非所问时自然地追问。对话超过 8 轮时主动收尾。
危机协议：只要对方流露出自杀、自伤或不想活的念头，立刻停止常规流程，表达关心，询问对方现在是否安全，并给出热线：全国心理援助热线 12356（24 小时免费），有生命危险时立即拨打 120 或 110。不要评判，不要讲道理。`;

function counselorList(): string {
  return approvedCounselors().map((c) => `- ${c.name}：擅长${c.tags.join('、')}；可${c.modes.map((m) => MODE_LABEL[m]).join('/')}咨询`).join('\n');
}

function systemPrompt(): string {
  return `${PRINCIPLES}\n\n平台可推荐的咨询师（只能推荐这些人，不要编造）：\n${counselorList()}`;
}

/** Per-turn guidance from the rule engine, appended as the last user-turn context. */
function guidance(next: { text: string; state: IntakeState }): string {
  const s = next.state;
  const known = [
    s.topics.length ? `主要困扰：${s.topics.join('、')}` : '',
    s.duration ? `持续时间：${s.duration}` : '',
    s.impactAreas.length ? `受影响：${s.impactAreas.join('、')}` : '',
    s.safety === 'safe' ? '已确认没有自伤念头' : s.safety === 'risk' ? '已出现危机信号' : '',
    s.modality ? `偏好方式：${MODE_LABEL[s.modality]}` : '',
  ].filter(Boolean).join('；');
  const recs = s.recommended.length ? approvedCounselors().filter((c) => s.recommended.includes(c.id)).map((c) => c.name).join('、') : '';
  return `【接待进度，仅供你参考，不要向来访者复述】已了解：${known || '暂无'}。第 ${s.turns} 轮。${recs ? `已为对方匹配：${recs}。` : ''}下一步建议这样回应（可以改写得更自然，但保持同一个问题和意图）：${next.text}`;
}

/** Strip anything that would not read well aloud and keep at most 3 sentences. */
export function cleanSpoken(raw: string): string {
  let t = raw.replace(/```[\s\S]*?```/g, '').replace(/[*#>`_~]/g, '').replace(/^\s*[-•\d]+[.、)]\s*/gm, '')
    .replace(/\s*\n+\s*/g, '').replace(/【[^】]*】/g, '').trim();
  const sentences = t.match(/[^。！？!?]+[。！？!?]?/g) ?? [t];
  t = sentences.slice(0, 3).join('');
  if (t.length > MAX_REPLY_CHARS * 1.5) {
    let out = '';
    for (const s of sentences) { if ((out + s).length > MAX_REPLY_CHARS) break; out += s; }
    t = out || t.slice(0, MAX_REPLY_CHARS);
  }
  return t.trim();
}

interface ClaudeCall { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; maxTokens: number; jsonSchema?: object }

/** One Messages API call; returns the concatenated text, or throws on error / refusal / timeout. */
export async function callClaude(req: ClaudeCall): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), llmSettings.timeoutMs);
  const model = config.anthropicModel;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': config.anthropicApiKey,
    'anthropic-version': API_VERSION,
  };
  const body: Record<string, unknown> = {
    model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: req.messages,
    // short conversational turns: keep latency low (adaptive thinking stays on by default)
    output_config: { effort: 'low', ...(req.jsonSchema ? { format: { type: 'json_schema', schema: req.jsonSchema } } : {}) },
  };
  if (FALLBACK_MODELS.has(model)) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  try {
    const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (data.stop_reason === 'refusal') throw new Error('anthropic refusal');
    if (data.stop_reason === 'max_tokens') throw new Error('anthropic max_tokens');
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
    if (!text) throw new Error('anthropic empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Claude needs alternating roles starting with "user"; the greeting is an assistant turn, so prepend a stub. */
function toApiMessages(history: HistoryItem[]): ClaudeCall['messages'] {
  const out: ClaudeCall['messages'] = [];
  for (const m of history) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: '（来访者打开了接待页面）' });
  return out;
}

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mood', 'moodScore', 'topics', 'duration', 'riskNote', 'plan'],
  properties: {
    mood: { type: 'string', description: '1-2 个情绪词，用 " · " 连接，例如 "焦虑 · 疲惫"' },
    moodScore: { type: 'integer', description: '0-100，越高情绪越好' },
    topics: { type: 'array', items: { type: 'string', enum: [...ISSUE_TAGS] } },
    duration: { type: 'string', description: '例如 "1 个多月"，未提及写 "未提及"' },
    riskNote: { type: 'string', description: '一句话风险说明，给咨询师看' },
    plan: { type: 'string', description: '建议路径，用 " → " 连接 3-4 步，例如 "睡眠与压力评估 → CBT-I 6 次 → 每周情绪追踪"，由咨询师评估后执行' },
  },
};
const SummaryOut = z.object({
  mood: z.string().min(1).max(30),
  moodScore: z.number().int().min(0).max(100),
  topics: z.array(z.enum(ISSUE_TAGS)).max(6),
  duration: z.string().min(1).max(30),
  riskNote: z.string().min(1).max(200),
  plan: z.string().min(1).max(200),
});

export const llmProvider: IntakeProvider = {
  name: 'llm',
  async reply(history, state) {
    const ruled = ruleStep(history, state);         // structured state + fallback text
    ruled.state.provider = 'llm';
    try {
      const msgs = toApiMessages(history);
      const last = msgs[msgs.length - 1];
      last.content = `${last.content}\n\n${guidance(ruled)}`;
      const raw = await callClaude({ system: systemPrompt(), messages: msgs, maxTokens: 2000 });
      const text = cleanSpoken(raw);
      // never let the model drop the crisis layer or emit something empty
      if (!text || (detectCrisis(text) && !/12356|120|110/.test(text))) throw new Error('unsafe or empty reply');
      return { text, state: ruled.state };
    } catch (e) {
      console.warn('[intake] LLM reply failed, using rules:', (e as Error).message);
      return { text: ruled.text, state: { ...ruled.state, provider: 'rules' } };
    }
  },
  async summarize(history, state) {
    const base = ruleSummary(history, state);
    try {
      const transcript = history.map((m) => `${m.role === 'user' ? '来访者' : '小屿'}：${m.content}`).join('\n');
      const raw = await callClaude({
        system: `${PRINCIPLES}\n\n现在请根据接待对话，为咨询师整理一份接待小结。只依据对话内容，不做诊断，不提药物。`,
        messages: [{ role: 'user', content: `接待对话如下：\n${transcript}\n\n请按要求的 JSON 格式输出小结。` }],
        maxTokens: 2000,
        jsonSchema: SUMMARY_SCHEMA,
      });
      const parsed = SummaryOut.parse(JSON.parse(raw.replace(/^```(json)?|```$/g, '').trim()));
      const merged: IntakeSummary = {
        ...base,
        mood: parsed.mood,
        // risk is decided by the deterministic crisis layer, never by the model
        moodScore: base.risk === 'high' ? Math.min(parsed.moodScore, 20) : parsed.moodScore,
        topics: parsed.topics.length ? [...new Set(parsed.topics)] : base.topics,
        duration: parsed.duration,
        riskNote: base.risk === 'high' ? base.riskNote : `${parsed.riskNote}${parsed.riskNote.includes('估计') ? '' : '量表分数为根据对话的初步估计，需正式测评确认。'}`,
        plan: parsed.plan.includes('咨询师') ? parsed.plan : `${parsed.plan}（由咨询师评估后执行）`,
      };
      return merged;
    } catch (e) {
      console.warn('[intake] LLM summary failed, using rules:', (e as Error).message);
      return base;
    }
  },
};
