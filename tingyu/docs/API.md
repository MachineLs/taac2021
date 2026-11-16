# 听屿 API 契约（v1）

所有路径前缀 `/api`。类型都在 `packages/shared/src/types.ts`。鉴权：`Authorization: Bearer <token>`。
标记：🔓 公开 · 🔑 需登录 · 🧑‍⚕️ 需 counselor 角色 · 🛡 需 admin 角色 · 📣 需 creator 角色。
错误：`{ error: { code, message } }`，code 取值：`bad_request` `unauthorized` `forbidden` `not_found` `conflict` `slot_taken` `payment_expired` `invalid_code` `internal`。

## B1 · 交易核心（apps/server/src/modules/{auth,counselors,appointments,coupons,workbench}）
| 方法 | 路径 | 权限 | 请求 | 响应 |
|---|---|---|---|---|
| POST | /auth/send-code | 🔓 | SendCodeReq | SendCodeRes（开发环境验证码固定 `123456`，并在 devCode 返回） |
| POST | /auth/login | 🔓 | LoginReq | LoginRes（新用户自动注册；refCode 有效则归因达人，并发放新人券） |
| GET | /me | 🔑 | – | User |
| PATCH | /me | 🔑 | UpdateMeReq | User |
| GET | /counselors | 🔓 | CounselorQuery（query string） | Page<CounselorSummary>（只返回 approved） |
| GET | /counselors/:id | 🔓 | – | CounselorDetail |
| GET | /counselors/:id/slots?from=&days=7 | 🔓 | – | Slot[]（只返回未来的 open + booked，便于前端置灰） |
| GET | /counselors/:id/reviews?page= | 🔓 | – | Page<Review> |
| GET | /coupons/mine | 🔑 | – | UserCoupon[] |
| POST | /coupons/claim | 🔑 | `{ code: string }` | UserCoupon（新人券 code=`NEW100`） |
| POST | /appointments | 🔑 | CreateAppointmentReq | Appointment（status=pending_payment，锁定 slot 15 分钟；slot 不可用 → 409 slot_taken） |
| GET | /appointments?status= | 🔑 | – | Appointment[]（来访者自己的） |
| GET | /appointments/:id | 🔑 | – | Appointment（本人、对应咨询师或 admin） |
| POST | /appointments/:id/pay | 🔑 | PayReq | PayRes（模拟支付；过期 → 410 payment_expired；成功后发事件 `appointment.paid`） |
| POST | /appointments/:id/cancel | 🔑 | CancelReq | Appointment（未支付直接取消；已支付且距开始 >24h 全额退款 → refunded；<24h → 409 conflict） |
| POST | /appointments/:id/reschedule | 🔑 | RescheduleReq | Appointment（已支付且距开始 >24h） |
| POST | /appointments/:id/review | 🔑 | CreateReviewReq | Review（仅 completed 且未评价） |
| GET | /appointments/:id/room | 🔑 | – | SessionRoom |
| POST | /appointments/:id/complete | 🧑‍⚕️ | – | Appointment（咨询师结束咨询 → completed，发事件 `appointment.completed`） |
| GET | /workbench/appointments?from=&to= | 🧑‍⚕️ | – | Appointment[]（我的来访） |
| GET | /workbench/appointments/:id/brief | 🧑‍⚕️ | – | ClientBrief |
| GET | /workbench/slots?from=&days=14 | 🧑‍⚕️ | – | Slot[] |
| POST | /workbench/slots | 🧑‍⚕️ | UpsertSlotsReq | Slot[]（新建的） |
| DELETE | /workbench/slots/:id | 🧑‍⚕️ | – | `{ ok: true }`（只能删 open） |
| POST | /workbench/appointments/:id/notes | 🧑‍⚕️ | `{ content: string }` | SessionNote |
| GET | /workbench/earnings?month=2026-11 | 🧑‍⚕️ | – | CounselorEarnings |
| POST | /counselor-applications | 🔑 | ApplyCounselorReq | CounselorDetail（status=pending，当前用户获得 counselor 角色） |
| GET | /admin/counselors?status= | 🛡 | – | CounselorDetail[] |
| POST | /admin/counselors/:id/review | 🛡 | ReviewCounselorReq | CounselorDetail |
| GET | /admin/appointments?status=&page= | 🛡 | – | Page<Appointment> |

## B2 · 关怀与增长（apps/server/src/modules/{intake,assessments,mood,messages,notifications,creators,admin}）
| 方法 | 路径 | 权限 | 请求 | 响应 |
|---|---|---|---|---|
| POST | /intake/sessions | 🔓（带 token 则绑定用户） | – | IntakeSession（含小屿开场白） |
| GET | /intake/sessions/:id | 🔓（匿名会话凭 id；已绑定用户的需本人） | – | IntakeSession |
| POST | /intake/sessions/:id/reply | 🔓 同上 | IntakeReplyReq | IntakeReplyRes（风险词 → crisis + 写 crisis_alerts + 风险升为 high） |
| POST | /intake/sessions/:id/end | 🔓 同上 | – | IntakeSession（生成 summary） |
| GET | /intake/sessions?mine=1 | 🔑 | – | IntakeSession[]（不含 messages 也可） |
| POST | /intake/sessions/:id/claim | 🔑 | – | IntakeSession（匿名会话登录后绑定到当前用户） |
| GET | /assessments/scales | 🔓 | – | ScaleDefinition[] |
| POST | /assessments/:scale | 🔑 | SubmitAssessmentReq | AssessmentResult |
| GET | /assessments/results | 🔑 | – | AssessmentResult[]（新的在前） |
| GET | /mood?days=30 | 🔑 | – | MoodCheckin[] |
| POST | /mood | 🔑 | CreateMoodReq | MoodCheckin |
| GET | /conversations | 🔑 | – | Conversation[]（来访者或咨询师视角） |
| POST | /conversations | 🔑 | `{ counselorId: string }` | Conversation（已存在则返回已有） |
| GET | /conversations/:id/messages | 🔑 | – | ChatMessage[]（同时把对方消息标记已读） |
| POST | /conversations/:id/messages | 🔑 | SendMessageReq | ChatMessage（含风险词 → 写 crisis_alerts，source=message） |
| GET | /notifications | 🔑 | – | Notification[] |
| POST | /notifications/read-all | 🔑 | – | `{ ok: true }` |
| GET | /creators/:refCode | 🔓 | – | Creator（落地页用） |
| POST | /creators/:refCode/visit | 🔓 | – | `{ ok: true }`（记录一次访问） |
| GET | /creators/:refCode/counselors | 🔓 | – | CounselorSummary[]（达人推荐的咨询师，3 位） |
| GET | /creator/stats | 📣 | – | CreatorStats（当前达人） |
| GET | /admin/overview | 🛡 | – | AdminOverview |
| GET | /admin/crisis?status= | 🛡 | – | CrisisAlert[] |
| PATCH | /admin/crisis/:id | 🛡 | UpdateCrisisReq | CrisisAlert |
| GET | /admin/creators | 🛡 | – | (Creator & { firstOrders: number; commissionTotal: number })[] |

## 事件（apps/server/src/core/events.ts）
- `appointment.paid` → payload `{ appointmentId }`：B2 的 creators 模块据此计提达人佣金（首单 × commission_rate），notifications 由 B1 直接调用 `notify()`。
- `appointment.completed` → `{ appointmentId }`
- `intake.crisis` → `{ sessionId, userId }`

## 演示账号（seed）
| 角色 | 手机号 | 说明 |
|---|---|---|
| 来访者 | 13800000001 | 小周，28 岁产品经理；有一次已结束的小屿接待、一笔已支付的预约（林知夏 明天 20:00） |
| 咨询师 | 13900000001 | 林知夏（其他咨询师 13900000002 … 13900000012） |
| 管理员 | 13700000000 | 平台运营 |
| 达人 | 13600000001 | 睡眠研究所阿屿，邀请码 `AYU2026` |
验证码统一 `123456`（非生产环境）。
