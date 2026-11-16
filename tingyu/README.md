# 听屿心理 Tingyu

心理服务平台：**心理类达人宣传引流 → 平台聚集流量 → AI 助理「小屿」语音接待、初筛、匹配 → 持证咨询师在线咨询**。
AI 只做接待、初筛、匹配与随访，不做咨询、诊断和治疗。

## 快速开始
需要 Node.js 22+（使用内置 SQLite，无需安装数据库）。

```bash
npm install
npm run seed        # 生成演示数据（apps/server/.data/tingyu.db）
npm start           # 构建前端并启动服务：http://localhost:4100
```

开发模式（两个终端）：`npm run dev:server`、`npm run dev:web`（http://localhost:5173，/api 代理到 4100）。

## 入口
| 地址 | 内容 |
|---|---|
| `/` | 网站：首页、找咨询师、预约支付、小屿语音接待 `/intake`、个人中心 `/account` |
| `/m` | 手机 App / H5：首页、AI 助理 `/m/voice`、找咨询师、预约、消息、测评、情绪日记、我的 |
| `/m/r/AYU2026` | 达人落地页（抖音 / 小红书引流入口），`/r/AYU2026` 为桌面版 |
| `/desk` | 咨询师工作台：今日、排班、来访者简报、消息、收入、入驻申请 `/desk/apply` |
| `/admin` | 运营后台：总览、咨询师审核、订单、危机预警、达人 |
| `/creator` | 达人后台：推广链接、转化数据、佣金 |

## 演示账号（验证码统一 123456）
| 角色 | 手机号 |
|---|---|
| 来访者（小周） | 13800000001 |
| 咨询师（林知夏） | 13900000001 |
| 管理员 | 13700000000 |
| 达人（睡眠研究所阿屿，邀请码 AYU2026） | 13600000001 |

## 配置（环境变量）
| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口，默认 4100 |
| `DB_PATH` | 数据库文件，默认 `.data/tingyu.db` |
| `JWT_SECRET` | 登录令牌密钥，**上线前必须设置** |
| `NODE_ENV=production` | 生产模式：不再返回测试验证码 |
| `ANTHROPIC_API_KEY` | 设置后小屿使用 Claude 生成回复；不设置时使用内置规则引擎 |
| `ANTHROPIC_MODEL` | 默认 `claude-sonnet-5-5` |

## 上线前需要接入的外部服务（当前为模拟实现）
- 短信验证码（当前开发环境固定 123456）
- 微信支付 / 支付宝（当前为模拟支付，订单状态流转完整）
- 音视频咨询（当前咨询室为演示界面，可接入声网 / 腾讯云 TRTC 等）
- 语音识别与合成：当前使用浏览器 Web Speech API（Chrome / Edge / Safari），可替换为云端 ASR/TTS

## 工程结构
- `packages/shared`：前后端共享类型（接口契约）
- `apps/server`：Express + SQLite（`node:sqlite`），`npm test` 运行 64 个接口测试
- `apps/web`：React + Vite
- `docs/API.md`：接口文档；`docs/PLAN.md`：分工与约定
