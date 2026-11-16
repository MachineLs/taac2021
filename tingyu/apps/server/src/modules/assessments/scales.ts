// Standard screening scales (PHQ-9, GAD-7, ISI): items, scoring and levels. Owner: B2.
import type { ScaleDefinition, ScaleId } from '@tingyu/shared';

const FREQ = [
  { label: '完全不会', value: 0 },
  { label: '好几天', value: 1 },
  { label: '一半以上的天数', value: 2 },
  { label: '几乎每天', value: 3 },
];
const SEVERITY = ['无', '轻度', '中度', '重度', '极重度'].map((label, value) => ({ label, value }));
const SATISFACTION = ['很满意', '满意', '一般', '不满意', '很不满意'].map((label, value) => ({ label, value }));
const INTERFERE = ['没有干扰', '轻微干扰', '有些干扰', '较多干扰', '很多干扰'].map((label, value) => ({ label, value }));
const NOTICEABLE = ['完全不明显', '有一点', '有些明显', '比较明显', '非常明显'].map((label, value) => ({ label, value }));
const WORRY = ['完全不担心', '有一点', '有些担心', '比较担心', '非常担心'].map((label, value) => ({ label, value }));

export const SCALES: ScaleDefinition[] = [
  {
    id: 'phq9',
    name: 'PHQ-9 抑郁症筛查量表',
    description: '国际通用的抑郁情绪自评筛查工具，共 9 题，帮助你了解最近两周的情绪状态。结果仅供参考，不作为诊断。',
    prompt: '在过去两周里，你有多少时候受到以下问题的困扰？',
    questions: [
      '做事时提不起劲或没有兴趣',
      '感到心情低落、沮丧或绝望',
      '入睡困难、睡不安稳或睡眠过多',
      '感觉疲倦或没有活力',
      '食欲不振或吃太多',
      '觉得自己很糟，或觉得自己很失败，或让自己或家人失望',
      '对事物专注有困难，例如阅读报纸或看电视时',
      '动作或说话速度缓慢到别人已经察觉；或正好相反，烦躁或坐立不安、动来动去的情况比平常更严重',
      '有不如死掉或用某种方式伤害自己的念头',
    ],
    options: FREQ,
    minutes: 3,
  },
  {
    id: 'gad7',
    name: 'GAD-7 广泛性焦虑量表',
    description: '国际通用的焦虑情绪自评筛查工具，共 7 题，帮助你了解最近两周的焦虑程度。结果仅供参考，不作为诊断。',
    prompt: '在过去两周里，你有多少时候受到以下问题的困扰？',
    questions: [
      '感觉紧张、焦虑或急切',
      '不能够停止或控制担忧',
      '对各种各样的事情担忧过多',
      '很难放松下来',
      '由于不安而无法静坐',
      '变得容易烦恼或急躁',
      '感到似乎将有可怕的事情发生而害怕',
    ],
    options: FREQ,
    minutes: 2,
  },
  {
    id: 'isi',
    name: 'ISI 失眠严重指数量表',
    description: '常用的失眠程度自评工具，共 7 题，评估最近两周的睡眠困扰及其对生活的影响。结果仅供参考，不作为诊断。',
    prompt: '请根据最近两周的睡眠情况，选择最符合你的选项。',
    questions: [
      '入睡困难的程度',
      '维持睡眠困难（夜间容易醒）的程度',
      '早醒的程度',
      '你对目前睡眠模式的满意程度',
      '睡眠问题对你日常功能的影响（如白天疲劳、工作能力、注意力、记忆力、情绪等）',
      '与其他人相比，你的睡眠问题对生活质量的影响有多明显',
      '你对自己目前的睡眠问题有多担心或苦恼',
    ],
    options: SEVERITY,
    optionsPerQuestion: [SEVERITY, SEVERITY, SEVERITY, SATISFACTION, INTERFERE, NOTICEABLE, WORRY],
    minutes: 2,
  },
];

export const scaleById = (id: string): ScaleDefinition | undefined => SCALES.find((s) => s.id === id);

export const SCALE_MAX: Record<ScaleId, number> = { phq9: 27, gad7: 21, isi: 28 };

export function scaleLevel(scale: ScaleId, score: number): string {
  if (scale === 'phq9') return score <= 4 ? '无/极轻' : score <= 9 ? '轻度' : score <= 14 ? '中度' : score <= 19 ? '中重度' : '重度';
  if (scale === 'gad7') return score <= 4 ? '无' : score <= 9 ? '轻度' : score <= 14 ? '中度' : '重度';
  return score <= 7 ? '无临床意义' : score <= 14 ? '轻度' : score <= 21 ? '中度' : '重度';
}

const NOTE = '（筛查结果仅供参考，不作为诊断）';
const TEXT: Record<ScaleId, Record<string, string>> = {
  phq9: {
    '无/极轻': '你最近的情绪整体比较平稳，继续保持规律作息和对自己的关照就好',
    轻度: '你最近有一些情绪低落的迹象，建议多留意自己的状态，也可以找咨询师聊一聊',
    中度: '你最近的情绪低落比较明显，建议预约咨询师做进一步的评估和支持',
    中重度: '你最近承受的情绪困扰已经比较重了，建议尽快预约专业咨询师，必要时到医院心理科就诊',
    重度: '你最近的情绪困扰非常明显，请尽快寻求专业帮助，建议前往医院精神心理科做评估',
  },
  gad7: {
    无: '你最近的焦虑水平不高，继续保持现在照顾自己的方式就好',
    轻度: '你最近有一些焦虑和紧张，可以试试规律运动和放松练习，持续的话可以找咨询师聊聊',
    中度: '你最近的焦虑比较明显，建议和咨询师一起梳理压力来源、制定应对计划',
    重度: '你最近的焦虑已经很明显地影响到生活，建议尽快预约专业咨询师，必要时到医院就诊评估',
  },
  isi: {
    无临床意义: '你目前的睡眠情况基本正常，继续保持规律的作息就好',
    轻度: '你有一些轻度的睡眠困扰，可以从固定起床时间、睡前减少屏幕开始调整',
    中度: '你的睡眠困扰比较明显，建议做一次睡眠评估，CBT-I 等方法对改善失眠很有帮助',
    重度: '你的失眠已经很严重，建议尽快寻求专业帮助，必要时到医院睡眠门诊就诊',
  },
};

export function interpret(scale: ScaleId, level: string, phq9Item9Positive = false): string {
  let s = `${TEXT[scale][level] ?? '感谢你完成测评，可以和咨询师一起进一步了解自己的状态'}${NOTE}。`;
  if (phq9Item9Positive) s += '你提到最近有过伤害自己的念头，如果此刻感到不安全，请立即拨打 12356 心理援助热线或 120，平台工作人员也会尽快联系你。';
  return s;
}
