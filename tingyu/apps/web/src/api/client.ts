// Typed API client. Owned by the lead — frontend agents import from here and never call fetch('/api…') directly.
import type * as T from '@tingyu/shared';

const TOKEN_KEY = 'tingyu.token';
export const tokenStore = {
  get: (): string | null => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

type Query = Record<string, string | number | boolean | undefined | null>;
function qs(q?: Query) {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

async function request<R>(method: string, path: string, body?: unknown, query?: Query): Promise<R> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs(query)}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', '网络连接失败，请检查网络后重试');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = (data as T.ApiError | null)?.error;
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, e?.code ?? 'internal', e?.message ?? '请求失败，请稍后再试', e?.details);
  }
  return data as R;
}
const get = <R>(p: string, q?: Query) => request<R>('GET', p, undefined, q);
const post = <R>(p: string, b?: unknown) => request<R>('POST', p, b ?? {});
const patch = <R>(p: string, b?: unknown) => request<R>('PATCH', p, b ?? {});
const del = <R>(p: string) => request<R>('DELETE', p);

export const api = {
  // auth & me
  sendCode: (b: T.SendCodeReq) => post<T.SendCodeRes>('/auth/send-code', b),
  login: (b: T.LoginReq) => post<T.LoginRes>('/auth/login', b),
  me: () => get<T.User>('/me'),
  updateMe: (b: T.UpdateMeReq) => patch<T.User>('/me', b),

  // counselors
  counselors: (q: T.CounselorQuery = {}) => get<T.Page<T.CounselorSummary>>('/counselors', q as Query),
  counselor: (id: string) => get<T.CounselorDetail>(`/counselors/${id}`),
  counselorSlots: (id: string, q: { from?: string; days?: number } = {}) => get<T.Slot[]>(`/counselors/${id}/slots`, q),
  counselorReviews: (id: string, page = 1) => get<T.Page<T.Review>>(`/counselors/${id}/reviews`, { page }),
  applyCounselor: (b: T.ApplyCounselorReq) => post<T.CounselorDetail>('/counselor-applications', b),

  // coupons
  myCoupons: () => get<T.UserCoupon[]>('/coupons/mine'),
  claimCoupon: (code: string) => post<T.UserCoupon>('/coupons/claim', { code }),

  // appointments
  createAppointment: (b: T.CreateAppointmentReq) => post<T.Appointment>('/appointments', b),
  appointments: (status?: T.AppointmentStatus) => get<T.Appointment[]>('/appointments', { status }),
  appointment: (id: string) => get<T.Appointment>(`/appointments/${id}`),
  pay: (id: string, b: T.PayReq) => post<T.PayRes>(`/appointments/${id}/pay`, b),
  cancel: (id: string, b: T.CancelReq = {}) => post<T.Appointment>(`/appointments/${id}/cancel`, b),
  reschedule: (id: string, b: T.RescheduleReq) => post<T.Appointment>(`/appointments/${id}/reschedule`, b),
  review: (id: string, b: T.CreateReviewReq) => post<T.Review>(`/appointments/${id}/review`, b),
  room: (id: string) => get<T.SessionRoom>(`/appointments/${id}/room`),
  complete: (id: string) => post<T.Appointment>(`/appointments/${id}/complete`),

  // counselor workbench
  wbAppointments: (q: { from?: string; to?: string } = {}) => get<T.Appointment[]>('/workbench/appointments', q),
  wbBrief: (id: string) => get<T.ClientBrief>(`/workbench/appointments/${id}/brief`),
  wbSlots: (q: { from?: string; days?: number } = {}) => get<T.Slot[]>('/workbench/slots', q),
  wbAddSlots: (b: T.UpsertSlotsReq) => post<T.Slot[]>('/workbench/slots', b),
  wbDeleteSlot: (id: string) => del<{ ok: true }>(`/workbench/slots/${id}`),
  wbAddNote: (appointmentId: string, content: string) => post<T.SessionNote>(`/workbench/appointments/${appointmentId}/notes`, { content }),
  wbEarnings: (month?: string) => get<T.CounselorEarnings>('/workbench/earnings', { month }),

  // AI intake (小屿)
  intakeStart: () => post<T.IntakeSession>('/intake/sessions'),
  intakeGet: (id: string) => get<T.IntakeSession>(`/intake/sessions/${id}`),
  intakeReply: (id: string, content: string) => post<T.IntakeReplyRes>(`/intake/sessions/${id}/reply`, { content }),
  intakeEnd: (id: string) => post<T.IntakeSession>(`/intake/sessions/${id}/end`),
  intakeMine: () => get<T.IntakeSession[]>('/intake/sessions', { mine: 1 }),
  intakeClaim: (id: string) => post<T.IntakeSession>(`/intake/sessions/${id}/claim`),

  // assessments & mood
  scales: () => get<T.ScaleDefinition[]>('/assessments/scales'),
  submitAssessment: (scale: T.ScaleId, answers: number[]) => post<T.AssessmentResult>(`/assessments/${scale}`, { answers }),
  assessmentResults: () => get<T.AssessmentResult[]>('/assessments/results'),
  moods: (days = 30) => get<T.MoodCheckin[]>('/mood', { days }),
  addMood: (b: T.CreateMoodReq) => post<T.MoodCheckin>('/mood', b),

  // messages & notifications
  conversations: () => get<T.Conversation[]>('/conversations'),
  openConversation: (counselorId: string) => post<T.Conversation>('/conversations', { counselorId }),
  messages: (conversationId: string) => get<T.ChatMessage[]>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, content: string) => post<T.ChatMessage>(`/conversations/${conversationId}/messages`, { content }),
  notifications: () => get<T.Notification[]>('/notifications'),
  readAllNotifications: () => post<{ ok: true }>('/notifications/read-all'),

  // creators
  creator: (refCode: string) => get<T.Creator>(`/creators/${encodeURIComponent(refCode)}`),
  creatorVisit: (refCode: string) => post<{ ok: true }>(`/creators/${encodeURIComponent(refCode)}/visit`),
  creatorCounselors: (refCode: string) => get<T.CounselorSummary[]>(`/creators/${encodeURIComponent(refCode)}/counselors`),
  creatorStats: () => get<T.CreatorStats>('/creator/stats'),

  // admin
  adminOverview: () => get<T.AdminOverview>('/admin/overview'),
  adminCounselors: (status?: 'pending' | 'approved' | 'rejected') => get<T.CounselorDetail[]>('/admin/counselors', { status }),
  adminReviewCounselor: (id: string, b: T.ReviewCounselorReq) => post<T.CounselorDetail>(`/admin/counselors/${id}/review`, b),
  adminAppointments: (q: { status?: T.AppointmentStatus; page?: number } = {}) => get<T.Page<T.Appointment>>('/admin/appointments', q),
  adminCrisis: (status?: T.CrisisAlert['status']) => get<T.CrisisAlert[]>('/admin/crisis', { status }),
  adminUpdateCrisis: (id: string, b: T.UpdateCrisisReq) => patch<T.CrisisAlert>(`/admin/crisis/${id}`, b),
  adminCreators: () => get<(T.Creator & { firstOrders: number; commissionTotal: number })[]>('/admin/creators'),
};
