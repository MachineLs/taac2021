# 听屿 Tingyu · 开发计划与分工（必读）

听屿是一个心理服务平台：**心理类达人宣传引流 → 平台聚集流量 → AI 助理「小屿」语音接待、初筛、匹配 → 持证真人咨询师在线提供咨询**。
AI 只做接待、初筛、匹配和随访，**不做咨询、不做诊断和治疗**，所有文案保持一致。

## 技术栈
- Monorepo（npm workspaces），根目录 `tingyu/`。依赖已经全部装好，**不要再 `npm install` 新包**（确需新包，写到 `docs/contract-requests/<代号>.md` 说明理由，由负责人决定）。
- `packages/shared`：前后端共享的类型与接口契约 `src/types.ts`。
- `apps/server`：Node 22 + Express 4 + TypeScript（tsx 运行）+ SQLite（`node:sqlite`）+ zod 校验 + vitest/supertest 测试。
- `apps/web`：React 18 + Vite 6 + TypeScript + react-router-dom 6。纯 CSS（设计令牌在 `src/styles/tokens.css`）。
- 接口契约：`docs/API.md`。视觉标准：`/home/user/taac2021/mindvoice/design3/app-home.html`（App）和 `web-home.html`（网站），截图在 `/home/user/taac2021/mindvoice/renders/v3-app-home.jpg`、`v3-web-home.jpg`。

## 分工（每个人只改自己目录里的文件）
| 代号 | 职责 | 可以修改的路径 |
|---|---|---|
| B1 后端·交易核心 | 登录注册、咨询师、时段、优惠券、预约下单、模拟支付、取消改约退款、评价、咨询室、咨询师工作台、咨询师入驻申请、管理端咨询师审核与订单 | `apps/server/src/modules/{auth,counselors,coupons,appointments,workbench,applications,admin-commerce}/**`，`apps/server/tests/b1-*.test.ts` |
| B2 后端·关怀与增长 | AI 接待小屿（LLM + 规则兜底 + 危机识别 + 小结 + 匹配推荐）、心理测评、情绪打卡、消息、通知、达人归因与佣金、管理端运营看板与危机预警 | `apps/server/src/modules/{intake,assessments,mood,messages,notifications,creators,admin-ops}/**`，`apps/server/tests/b2-*.test.ts` |
| F1 前端·网站（桌面） | 官网首页、找咨询师、咨询师详情与预约、下单支付、AI 语音接待页、登录、个人中心（订单/测评/消息/情绪） | `apps/web/src/areas/site/**` |
| F2 前端·App（移动端 / H5） | `/m` 下的完整移动端：首页、AI 语音接待、找咨询师、详情、预约支付、订单、咨询室、消息、测评、情绪日记、我的、达人落地页 | `apps/web/src/areas/mobile/**` |
| F3 前端·咨询师工作台 | `/desk`：今日安排、排班管理、来访者简报（接待小结/量表/笔记）、结束咨询、消息、收入、入驻申请 | `apps/web/src/areas/desk/**` |
| F4 前端·运营后台 + 达人后台 | `/admin`：运营总览、咨询师审核、订单、危机预警、达人；`/creator`：达人数据看板与推广链接 | `apps/web/src/areas/admin/**`、`apps/web/src/areas/creator/**` |

**负责人（lead）拥有、任何 agent 都不能改的文件**：`packages/shared/**`、`docs/**`（除了 contract-requests）、`apps/server/src/{app.ts,index.ts,core/**,seed/**}`、`apps/server/tests/helpers.ts`、`apps/web/src/{App.tsx,main.tsx,api/**,auth/**,lib/**,voice/**,styles/**,components/**}`、所有 package.json / tsconfig / vite 配置。
发现契约不够用（缺字段、缺接口、类型错误）：在 `docs/contract-requests/<代号>.md` 里写清楚，然后在自己目录内先做兼容处理继续推进，**不要改别人的文件**。

## 约定
### 后端
- 每个模块 `modules/<name>/routes.ts` 导出 `router`（已挂载到 `/api`），路径写全，例如 `router.get('/counselors', …)`。可在模块目录内新建 `service.ts`、`*.ts`。
- 数据访问用 `core/db` 的 `one/all/run/tx/j`；类型转换用 `core/mappers`（`toUser`、`toCounselorSummary`、`loadAppointment`、`listAppointments`…）；
  鉴权用 `core/auth`（`requireAuth`、`requireRole('counselor'|'admin'|'creator')`、`me(req)`）；错误用 `core/errors`（`h()` 包装 async、`parse(zodSchema, data)`、`badRequest/notFound/conflict/forbidden`）；
  id/时间用 `core/util`；站内通知 `core/notify`；跨模块事件 `core/events`（`emit('appointment.paid', …)` / `on(...)`）。
- 响应严格按 `@tingyu/shared` 的类型返回（在 handler 里用 `satisfies` 或显式类型标注）。表结构见 `core/schema.sql`（不能改，要改走 contract-requests）。
- 测试：`tests/<代号小写>-*.test.ts`，用 `tests/helpers.ts` 的 `setup()`（内存库 + 种子数据）和 `tokenFor(phone)`。演示账号见 `docs/API.md`。
- 跑测试：`cd apps/server && npx vitest run tests/b1-` ；类型检查：`npx tsc --noEmit -p .`

### 前端
- 所有接口调用走 `src/api/client.ts` 的 `api.xxx()`；登录状态 `useAuth()`；加载数据 `useAsync()`；时间金额格式 `lib/format`；空/错/加载状态与登录守卫 `components/states`（`RequireAuth`）；提示 `useToast()`；危机横幅 `CrisisBanner`；语音 `voice/useVoice`；达人归因 `lib/ref`（`captureRefFromUrl()`）。
- 每个区域的入口是 `areas/<area>/routes.tsx`（默认导出一个包含 `<Routes>` 的组件，内部路径是相对路径）。页面、组件、样式都放在自己区域目录下（例如 `areas/site/pages/Home.tsx`、`areas/site/site.css`）。区域 CSS 的类名加区域前缀（`site-`、`m-`、`desk-`、`adm-`、`cr-`）避免冲突，颜色只用 tokens 变量。
- 区域之间互相跳转只用 URL（例如网站点「下载 App」去 `/m`），不 import 别的区域的代码。
- 登录页：网站 `/login`（F1）、移动端 `/m/login`（F2）；工作台、后台、达人后台未登录时跳转 `/login?next=…`。
- 验证码统一 `123456`（开发环境）。图片在 `/assets/*.jpg`（`apps/web/public/assets`）。
- 类型检查：`cd apps/web && npx tsc --noEmit -p .`；构建：`npx vite build`。

## 端口（每个 agent 起自己的后端 + 数据库，互不干扰）
| 代号 | 后端端口 | 数据库 | 前端端口 |
|---|---|---|---|
| B1 | 4101 | .data/b1.db | – |
| B2 | 4102 | .data/b2.db | – |
| F1 | 4103 | .data/f1.db | 5173 |
| F2 | 4104 | .data/f2.db | 5174 |
| F3 | 4105 | .data/f3.db | 5175 |
| F4 | 4106 | .data/f4.db | 5176 |
启动示例（在 `apps/server`）：`PORT=4103 DB_PATH=.data/f1.db npx tsx src/seed/seed.ts && PORT=4103 DB_PATH=.data/f1.db npx tsx src/index.ts`（后台运行）。
前端（在 `apps/web`）：`VITE_API_PORT=4103 npx vite --port 5173 --strictPort`（后台运行）。
后端接口由 B1/B2 并行开发中，前端开始时部分接口可能返回 404；先按契约写页面，隔一段时间重启后端（`tsx` 不带 watch 时需要重启）再联调。**不要因为接口暂未实现而修改后端代码。**

## 完成标准（每个 agent）
1. 自己负责的接口 / 页面全部完成，类型检查 0 报错（server 或 web）。
2. 后端：关键流程有 vitest 测试并全部通过。前端：用 Playwright（`require('playwright')`，chromium 已安装）在桌面 1440 或手机 390 宽截图检查主要页面，修掉明显的样式问题、横向滚动、控制台报错。
3. 不要 git commit（负责人统一提交）。结束时停掉自己启动的后台进程。
4. 最终回复：完成了什么、没完成什么、发现的问题（尤其是契约问题）。
