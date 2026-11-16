/**
 * 听屿 Tingyu — shared domain types and API contract.
 * Owned by the lead (architect). Backend and frontend both import from here.
 * Agents must NOT edit this file; request changes in docs/contract-requests/<agent>.md.
 *
 * Conventions
 * - All ids are strings (prefixed nanoid-like, e.g. "u_xxx", "c_xxx").
 * - All timestamps are ISO-8601 strings in UTC (e.g. "2026-11-17T12:00:00.000Z").
 * - All money is integer CNY yuan (no cents) — prices in this domain are whole yuan.
 * - Every API response is JSON. Errors: HTTP 4xx/5xx with body ApiError.
 * - Auth: header `Authorization: Bearer <token>`.
 */

// ---------- common ----------
export interface ApiError { error: { code: string; message: string; details?: unknown } }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }

export type Role = 'client' | 'counselor' | 'admin' | 'creator';
export type ConsultMode = 'video' | 'voice' | 'text' | 'offline';
export type RiskLevel = 'low' | 'medium' | 'high';

// ---------- users & auth ----------
export interface User {
  id: string;
  phone: string;            // masked in public contexts, e.g. "138****0001"
  name: string;
  avatar: string | null;    // URL path, e.g. "/assets/u-asian-woman.jpg"
  roles: Role[];
  counselorId: string | null;  // set when the user is a counselor
  creatorId: string | null;    // set when the user is a creator (达人)
  createdAt: string;
}
export interface SendCodeReq { phone: string }
export interface SendCodeRes { ok: true; devCode?: string }          // devCode only outside production
export interface LoginReq { phone: string; code: string; refCode?: string }  // refCode = creator referral code captured from ?ref=
export interface LoginRes { token: string; user: User; isNew: boolean }
export interface UpdateMeReq { name?: string; avatar?: string | null }

// ---------- counselors ----------
export interface CounselorSummary {
  id: string;
  name: string;
  avatar: string;
  title: string;              // e.g. "国家二级心理咨询师"
  headline: string;           // e.g. "临床心理学硕士 · 认知行为疗法（CBT）"
  badges: string[];           // e.g. ["金牌"]
  years: number;
  sessionsCount: number;
  rating: number;             // 0..5, 2 decimals
  reviewCount: number;
  rebookRate: number;         // 0..100 percent
  tags: string[];             // issues they specialise in, e.g. ["焦虑","失眠"]
  modes: ConsultMode[];
  price: number;              // per 50-minute session
  originalPrice: number | null;
  city: string | null;        // for offline sessions
  gender: 'female' | 'male';
  nextAvailableAt: string | null;  // earliest open slot start
}
export interface CounselorDetail extends CounselorSummary {
  intro: string;
  methods: string[];          // e.g. ["认知行为疗法 CBT"]
  qualifications: { name: string; issuer: string; year: number }[];
  training: { period: string; content: string }[];
  status: 'pending' | 'approved' | 'rejected';
}
export interface CounselorQuery {
  q?: string;                 // free text: name / tag / headline
  tag?: string;               // issue tag
  mode?: ConsultMode;
  priceMin?: number;
  priceMax?: number;
  gender?: 'female' | 'male';
  city?: string;
  availableWithinDays?: number;   // has an open slot within N days
  sort?: 'recommended' | 'rating' | 'price_asc' | 'price_desc' | 'soonest';
  page?: number;
  pageSize?: number;
}
export interface Slot {
  id: string;
  counselorId: string;
  startAt: string;
  endAt: string;              // startAt + 50 min
  status: 'open' | 'booked' | 'blocked';
}
export interface Review {
  id: string;
  counselorId: string;
  userName: string;           // masked, e.g. "周**"
  rating: number;             // 1..5
  content: string;
  tags: string[];
  createdAt: string;
}

// ---------- coupons ----------
export interface UserCoupon {
  id: string;
  title: string;              // "新人首单立减 100 元"
  amount: number;
  minSpend: number;
  status: 'unused' | 'used' | 'expired';
  expiresAt: string;
}

// ---------- appointments (orders) ----------
export type AppointmentStatus = 'pending_payment' | 'paid' | 'in_session' | 'completed' | 'cancelled' | 'refunded';
export type PayMethod = 'wechat' | 'alipay' | 'card';
export interface Appointment {
  id: string;
  userId: string;
  counselor: Pick<CounselorSummary, 'id' | 'name' | 'avatar' | 'title'>;
  client: { id: string; name: string; avatar: string | null };
  slotId: string;
  startAt: string;
  endAt: string;
  mode: ConsultMode;
  status: AppointmentStatus;
  price: number;
  discount: number;
  amount: number;             // price - discount
  couponId: string | null;
  intakeSessionId: string | null;
  shareIntake: boolean;       // client consented to share the AI intake summary with the counselor
  creatorId: string | null;   // attributed creator (达人) for the first order
  reviewed: boolean;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  payExpiresAt: string | null;  // pending_payment orders expire after 15 minutes
}
export interface CreateAppointmentReq {
  counselorId: string;
  slotId: string;
  mode: ConsultMode;
  couponId?: string | null;
  intakeSessionId?: string | null;
  shareIntake?: boolean;
}
export interface PayReq { method: PayMethod }
export interface PayRes { appointment: Appointment; payment: { id: string; method: PayMethod; amount: number; transactionNo: string; paidAt: string } }
export interface CancelReq { reason?: string }
export interface RescheduleReq { slotId: string }
export interface CreateReviewReq { rating: number; content: string; tags?: string[] }
export interface SessionRoom {
  appointment: Appointment;
  canJoin: boolean;           // true from 10 min before start until end
  joinOpensAt: string;
  roomId: string;
}

// ---------- counselor workbench ----------
export interface SessionNote { id: string; appointmentId: string; content: string; createdAt: string; updatedAt: string }
export interface CounselorEarnings {
  month: string;              // "2026-11"
  sessions: number;
  gross: number;              // sum of amounts of completed appointments this month
  platformFee: number;        // platform service fee (30%, or 20% + creator 10% on referred first orders)
  net: number;
  pendingSettlement: number;  // paid but not completed yet
}
export interface UpsertSlotsReq { slots: { startAt: string }[] }   // creates open 50-min slots; duplicates ignored
export interface ClientBrief {                          // what the counselor sees before a session
  appointment: Appointment;
  intake: IntakeSummary | null;                         // only when shareIntake = true
  assessments: AssessmentResult[];                      // latest per scale, only when shareIntake = true
  notes: SessionNote[];
  source: { creatorName: string } | null;               // attributed creator, if any
}

// ---------- AI intake (小屿) ----------
export type IntakeRole = 'assistant' | 'user';
export interface IntakeMessage { id: string; role: IntakeRole; content: string; createdAt: string }
export interface IntakeSummary {
  mood: string;               // "焦虑 · 疲惫"
  moodScore: number;          // 0..100 (higher = better)
  topics: string[];
  duration: string;           // "1 个多月"
  risk: RiskLevel;
  riskNote: string;
  scales: { scale: ScaleId; score: number; max: number; level: string }[];   // estimates from the conversation
  plan: string;               // "睡眠与压力评估 → CBT-I 6 次 → 每周情绪追踪"
  modality: ConsultMode;
  recommendedCounselorIds: string[];   // best first, 1..3
}
export interface IntakeSession {
  id: string;
  userId: string | null;      // anonymous sessions allowed; bound to user on login
  status: 'active' | 'ended';
  risk: RiskLevel;
  crisis: boolean;            // true once crisis language was detected
  messages: IntakeMessage[];
  summary: IntakeSummary | null;
  createdAt: string;
  endedAt: string | null;
}
export interface IntakeReplyReq { content: string }
export interface IntakeReplyRes {
  session: IntakeSession;
  reply: IntakeMessage;
  crisis: CrisisInfo | null;  // present when this turn triggered crisis handling
}
export interface CrisisInfo {
  hotlines: { name: string; number: string; note: string }[];
  message: string;
}

// ---------- assessments ----------
export type ScaleId = 'phq9' | 'gad7' | 'isi';
export interface ScaleDefinition {
  id: ScaleId;
  name: string;               // "PHQ-9 抑郁症筛查量表"
  description: string;
  prompt: string;             // "过去两周里，你有多少时候受到以下问题困扰？"
  questions: string[];
  options: { label: string; value: number }[];   // per question; ISI uses per-question options via optionsPerQuestion
  optionsPerQuestion?: { label: string; value: number }[][];
  minutes: number;
}
export interface AssessmentResult {
  id: string;
  scale: ScaleId;
  score: number;
  max: number;
  level: string;              // "轻度" etc.
  interpretation: string;
  answers: number[];
  createdAt: string;
}
export interface SubmitAssessmentReq { answers: number[] }

// ---------- mood ----------
export interface MoodCheckin { id: string; mood: 1 | 2 | 3 | 4 | 5; tags: string[]; note: string; createdAt: string }
export interface CreateMoodReq { mood: 1 | 2 | 3 | 4 | 5; tags?: string[]; note?: string }

// ---------- messages & notifications ----------
export interface Conversation {
  id: string;
  counselor: Pick<CounselorSummary, 'id' | 'name' | 'avatar' | 'title'>;
  client: { id: string; name: string; avatar: string | null };
  lastMessage: ChatMessage | null;
  unread: number;             // unread for the requesting user
  updatedAt: string;
}
export interface ChatMessage { id: string; conversationId: string; senderId: string; content: string; createdAt: string; readAt: string | null }
export interface SendMessageReq { content: string }
export interface Notification { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }

// ---------- creators (达人) & referrals ----------
export interface Creator {
  id: string;
  name: string;
  avatar: string;
  platform: string;           // "抖音" / "小红书"
  followers: number;
  bio: string;
  refCode: string;            // used as ?ref=CODE
  commissionRate: number;     // 0.10
}
export interface CreatorStats {
  creator: Creator;
  visits: number;             // landing visits with ?ref=
  signups: number;            // users attributed at registration
  intakes: number;            // AI intake sessions started by attributed users
  firstOrders: number;        // paid first orders by attributed users
  commissionTotal: number;
  commissionPending: number;  // not yet settled
  daily: { date: string; visits: number; signups: number; orders: number }[];   // last 30 days
  commissions: { id: string; appointmentId: string; amount: number; status: 'pending' | 'settled'; createdAt: string }[];
}

// ---------- admin ----------
export interface CrisisAlert {
  id: string;
  user: { id: string; name: string; phone: string } | null;
  sessionId: string | null;
  source: 'intake' | 'message';
  excerpt: string;
  status: 'open' | 'handling' | 'resolved';
  createdAt: string;
  handledBy: string | null;
}
export interface AdminOverview {
  users: number;
  counselors: { approved: number; pending: number };
  appointments: { today: number; paid: number; completed: number };
  gmv: number;                // paid + completed amounts
  intakes: number;
  openCrisis: number;
  daily: { date: string; gmv: number; appointments: number; intakes: number }[];  // last 14 days
}
export interface ReviewCounselorReq { status: 'approved' | 'rejected'; note?: string }
export interface UpdateCrisisReq { status: 'handling' | 'resolved' }
export interface ApplyCounselorReq {
  name: string; title: string; headline: string; years: number; intro: string;
  tags: string[]; methods: string[]; modes: ConsultMode[]; price: number; city?: string | null; gender: 'female' | 'male';
}

// ---------- constants ----------
export const HOTLINES: CrisisInfo['hotlines'] = [
  { name: '全国心理援助热线', number: '12356', note: '7×24 小时 · 免费' },
  { name: '希望 24 热线', number: '400-161-9995', note: '7×24 小时' },
  { name: '紧急情况', number: '120 / 110', note: '有生命危险时立即拨打' },
];
export const ISSUE_TAGS = ['焦虑', '失眠', '情绪低落', '职场压力', '亲密关系', '婚姻', '家庭沟通', '亲子', '青少年', '创伤', '自我成长', '正念'] as const;
export const MODE_LABEL: Record<ConsultMode, string> = { video: '视频', voice: '语音', text: '文字', offline: '面询' };
export const SESSION_MINUTES = 50;
