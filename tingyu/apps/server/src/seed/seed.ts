// Demo data. Owned by the lead. `npm run seed` resets the database file and fills it.
// Also exported for tests: seed() fills whatever database is currently open.
import { rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openDb, one, run, tx } from '../core/db';
import { config } from '../core/config';
import { id, nowIso } from '../core/util';

const COUNSELORS = [
  { key: 'lin', name: '林知夏', avatar: '/assets/c-lin.jpg', title: '国家二级心理咨询师', headline: '临床心理学硕士 · 认知行为疗法（CBT）', badges: ['金牌'], years: 8, sessions: 2310, rating: 4.97, rebook: 72, tags: ['焦虑', '失眠', '职场压力', '情绪低落'], modes: ['video', 'voice', 'text'], price: 400, orig: 500, city: '北京', gender: 'female', methods: ['认知行为疗法 CBT', '失眠认知行为治疗 CBT-I'], intro: '我相信每一种情绪都有它的道理。咨询中我会和你一起看清想法与情绪之间的关系，用循证的方法慢慢找回节奏。擅长职场压力、焦虑与失眠的短程干预。' },
  { key: 'zhou', name: '周以宁', avatar: '/assets/c-zhou.jpg', title: '婚姻家庭治疗师', headline: 'EFT 情绪聚焦疗法认证 · 北京朝阳门店可面询', badges: ['金牌'], years: 11, sessions: 3480, rating: 4.95, rebook: 68, tags: ['亲密关系', '婚姻', '家庭沟通'], modes: ['video', 'voice', 'offline'], price: 600, orig: null, city: '北京', gender: 'female', methods: ['情绪聚焦疗法 EFT', '家庭系统治疗'], intro: '关系里的每一次争吵，背后都是一次没有被听见的需要。我陪伴伴侣和家庭重新建立安全的连接。' },
  { key: 'he', name: '何清', avatar: '/assets/c-he.jpg', title: '注册心理师', headline: '正念减压导师 · 接纳承诺疗法（ACT）', badges: [], years: 9, sessions: 2890, rating: 4.96, rebook: 70, tags: ['情绪低落', '正念', '自我成长'], modes: ['voice', 'video'], price: 450, orig: null, city: '上海', gender: 'female', methods: ['接纳承诺疗法 ACT', '正念减压 MBSR'], intro: '和情绪做朋友，而不是和它对抗。我用正念和 ACT 帮助来访者在困难中依然朝着重要的方向前进。' },
  { key: 'xu', name: '许蔓', avatar: '/assets/c-xu.jpg', title: '国家二级心理咨询师', headline: '青少年与亲子咨询 · 家庭系统治疗', badges: [], years: 6, sessions: 1520, rating: 4.93, rebook: 61, tags: ['青少年', '亲子', '家庭沟通'], modes: ['video', 'voice', 'offline'], price: 380, orig: 450, city: '杭州', gender: 'female', methods: ['家庭系统治疗', '游戏治疗'], intro: '孩子的问题常常是家庭在说话。我和父母、孩子一起找到更好的沟通方式。' },
  { key: 'song', name: '宋语棠', avatar: '/assets/c-song.jpg', title: '创伤治疗师 · EMDR 认证', headline: '创伤与哀伤 · 眼动脱敏与再加工（EMDR）', badges: ['金牌'], years: 12, sessions: 4120, rating: 4.98, rebook: 75, tags: ['创伤', '焦虑'], modes: ['video', 'offline'], price: 680, orig: null, city: '上海', gender: 'female', methods: ['EMDR', '创伤知情治疗'], intro: '创伤不是你的错。我们会以安全为先，按你能承受的节奏一步步处理过去的经历。' },
  { key: 'chen', name: '陈牧', avatar: '/assets/c-chen.jpg', title: '精神科主治医师', headline: '医学博士 · 抑郁焦虑评估与转介', badges: [], years: 15, sessions: 5260, rating: 4.96, rebook: 64, tags: ['情绪低落', '焦虑', '失眠'], modes: ['video'], price: 800, orig: null, city: '北京', gender: 'male', methods: ['精神科评估', '药物咨询'], intro: '提供专业的精神科评估与用药咨询，必要时协助转介线下医疗机构。' },
  { key: 'fang', name: '方宁', avatar: '/assets/c-fang.jpg', title: '企业 EAP 顾问', headline: '职业发展教练 · 焦点解决短程治疗', badges: [], years: 7, sessions: 1980, rating: 4.94, rebook: 66, tags: ['职场压力', '自我成长'], modes: ['video', 'voice'], price: 420, orig: null, city: '深圳', gender: 'female', methods: ['焦点解决短程治疗 SFBT'], intro: '职业倦怠、职场人际和职业选择，是我最常陪伴来访者面对的课题。' },
  { key: 'wang', name: '王屿川', avatar: '/assets/c-wang.jpg', title: '精神分析取向咨询师', headline: '自我探索 · 男性心理与关系模式', badges: [], years: 10, sessions: 2640, rating: 4.92, rebook: 69, tags: ['自我成长', '亲密关系'], modes: ['video', 'voice', 'offline'], price: 550, orig: null, city: '北京', gender: 'male', methods: ['精神动力学'], intro: '在长程的对话里，看见那些反复出现的关系模式，理解它们从哪里来。' },
  { key: 'gu', name: '顾言', avatar: '/assets/c-gu.jpg', title: '高校心理咨询师', headline: '大学生与职业迷茫 · 人本主义疗法', badges: [], years: 5, sessions: 1170, rating: 4.91, rebook: 58, tags: ['自我成长', '焦虑', '青少年'], modes: ['voice', 'text', 'video'], price: 300, orig: null, city: '南京', gender: 'male', methods: ['人本主义疗法'], intro: '迷茫不是失败，而是重新认识自己的机会。' },
  { key: 'qiao', name: '乔安', avatar: '/assets/c-qiao.jpg', title: '国家二级心理咨询师', headline: '情绪调节 · 辩证行为疗法（DBT）', badges: [], years: 6, sessions: 1340, rating: 4.9, rebook: 60, tags: ['情绪低落', '焦虑'], modes: ['voice', 'text'], price: 320, orig: 380, city: '成都', gender: 'female', methods: ['辩证行为疗法 DBT'], intro: '情绪像海浪，我们可以学会冲浪。' },
  { key: 'luo', name: '罗川', avatar: '/assets/c-luo.jpg', title: '注册心理师', headline: '男性心理 · 婚恋与家庭', badges: [], years: 8, sessions: 1760, rating: 4.89, rebook: 57, tags: ['亲密关系', '婚姻', '职场压力'], modes: ['video', 'voice'], price: 360, orig: null, city: '广州', gender: 'male', methods: ['认知行为疗法 CBT', '叙事疗法'], intro: '帮助男性来访者在压力和关系中照顾好自己。' },
  { key: 'tang', name: '唐晓', avatar: '/assets/c-tang.jpg', title: '国家二级心理咨询师', headline: '产后情绪 · 女性成长', badges: [], years: 7, sessions: 1610, rating: 4.94, rebook: 63, tags: ['情绪低落', '亲子', '自我成长'], modes: ['video', 'voice', 'offline'], price: 420, orig: null, city: '杭州', gender: 'female', methods: ['接纳承诺疗法 ACT', '人际心理治疗 IPT'], intro: '成为妈妈之后，也别忘了照顾自己。' },
] as const;

const CLIENT_NAMES = ['周', '陈', '李', '王', '张', '刘', '杨', '赵', '黄', '吴', '徐', '孙', '马', '朱', '胡'];
const REVIEW_TEXTS = [
  ['老师非常耐心，第一次就让我放松下来，说出了很多没对别人说过的话。', ['耐心', '专业']],
  ['给的练习很实用，两周后睡眠明显好转。', ['有方法', '见效']],
  ['没有评判，被认真听见的感觉很好。', ['温暖', '倾听']],
  ['帮我理清了和伴侣的沟通模式，回去试了确实有用。', ['专业', '有方法']],
  ['准时、专业，咨询后还发了总结和作业。', ['专业', '负责']],
] as const;

/** China-time slot start: dayOffset from today (CN date), hour in CN time. */
function cn(dayOffset: number, hour: number, minute = 0): string {
  const now = new Date();
  const cnNow = new Date(now.getTime() + 8 * 3600000);
  const d = Date.UTC(cnNow.getUTCFullYear(), cnNow.getUTCMonth(), cnNow.getUTCDate() + dayOffset, hour - 8, minute);
  return new Date(d).toISOString();
}
const end = (iso: string) => new Date(new Date(iso).getTime() + 50 * 60000).toISOString();

export function seed() {
  tx(() => {
    const t0 = nowIso();
    const user = (phone: string, name: string, avatar: string | null, roles: string[], ref: string | null = null, createdAt = t0) => {
      const uid = id('u');
      run('INSERT INTO users (id, phone, name, avatar, roles, referred_by_creator_id, created_at) VALUES (?,?,?,?,?,?,?)', uid, phone, name, avatar, JSON.stringify(roles), ref, createdAt);
      return uid;
    };

    // admin
    user('13700000000', '平台运营 · 小安', '/assets/u-man-4.jpg', ['client', 'admin']);

    // creators
    const creatorDefs = [
      { phone: '13600000001', name: '睡眠研究所阿屿', avatar: '/assets/cr-ayu.jpg', platform: '抖音', followers: 468000, bio: '心理学硕士，专注睡眠与情绪科普。', ref: 'AYU2026', recs: ['lin', 'he', 'chen'] },
      { phone: '13600000002', name: '打工人心理课', avatar: '/assets/cr-work.jpg', platform: '小红书', followers: 231000, bio: '聊聊职场里的情绪与边界。', ref: 'WORK2026', recs: ['fang', 'lin', 'luo'] },
      { phone: '13600000003', name: '恋爱里的小心思', avatar: '/assets/cr-love.jpg', platform: '抖音', followers: 315000, bio: '亲密关系里的心理学。', ref: 'LOVE2026', recs: ['zhou', 'wang', 'luo'] },
    ];

    // counselors (+ their user accounts)
    const cid: Record<string, string> = {};
    COUNSELORS.forEach((c, i) => {
      const uid = user(`139000000${String(i + 1).padStart(2, '0')}`, c.name, c.avatar, ['client', 'counselor']);
      const k = id('c'); cid[c.key] = k;
      run(`INSERT INTO counselors (id, user_id, name, avatar, title, headline, badges, years, sessions_count, rating, review_count, rebook_rate, tags, modes, price, original_price, city, gender, intro, methods, qualifications, training, status, sort_weight, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        k, uid, c.name, c.avatar, c.title, c.headline, JSON.stringify(c.badges), c.years, c.sessions, c.rating, 0, c.rebook,
        JSON.stringify(c.tags), JSON.stringify(c.modes), c.price, c.orig, c.city, c.gender, c.intro, JSON.stringify(c.methods),
        JSON.stringify([{ name: c.title, issuer: '人力资源和社会保障部 / 行业协会', year: 2026 - c.years }, { name: '心理学硕士', issuer: '北京师范大学', year: 2026 - c.years - 2 }]),
        JSON.stringify([{ period: `${2026 - c.years}–至今`, content: `${c.methods[0]} 系统培训与督导 ${Math.round(c.years * 120)} 小时` }]),
        'approved', 100 - i, t0);
    });
    // one pending application for the admin review queue
    const pendingUid = user('13900000013', '沈默', '/assets/c-shen.jpg', ['client', 'counselor']);
    run(`INSERT INTO counselors (id, user_id, name, avatar, title, headline, badges, years, tags, modes, price, gender, intro, methods, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id('c'), pendingUid, '沈默', '/assets/c-shen.jpg', '国家三级心理咨询师', '大学生情绪与学业压力', '[]', 3,
      JSON.stringify(['焦虑', '青少年']), JSON.stringify(['voice', 'text']), 260, 'male', '刚完成 300 小时个案督导，希望陪伴更多年轻人。', JSON.stringify(['人本主义疗法']), 'pending', t0);

    const crId: Record<string, string> = {};
    for (const c of creatorDefs) {
      const uid = user(c.phone, c.name, c.avatar, ['client', 'creator']);
      const k = id('cr'); crId[c.ref] = k;
      run('INSERT INTO creators (id, user_id, name, avatar, platform, followers, bio, ref_code, commission_rate, recommended_counselor_ids, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        k, uid, c.name, c.avatar, c.platform, c.followers, c.bio, c.ref, 0.1, JSON.stringify(c.recs.map((r) => cid[r])), t0);
    }

    // coupons
    const newCoupon = id('cp');
    run('INSERT INTO coupons (id, code, title, amount, min_spend, new_user_only, valid_days) VALUES (?,?,?,?,?,?,?)', newCoupon, 'NEW100', '新人首单立减 100 元', 100, 300, 1, 7);
    run('INSERT INTO coupons (id, code, title, amount, min_spend, new_user_only, valid_days) VALUES (?,?,?,?,?,?,?)', id('cp'), 'WEEK50', '周末关怀券 50 元', 50, 400, 0, 14);

    // future slots: next 14 days
    const hours = [9, 10, 14, 15, 19, 20, 21];
    const slotId: Record<string, string> = {};
    COUNSELORS.forEach((c, ci) => {
      for (let d = 0; d <= 14; d++) {
        hours.forEach((hr, hi) => {
          if ((d + hi + ci) % 3 === 0) return;               // not every hour is offered
          const s = cn(d, hr);
          if (new Date(s).getTime() < Date.now() + 30 * 60000) return;
          const k = id('s'); slotId[`${c.key}|${d}|${hr}`] = k;
          const blocked = (d + hi * 2 + ci) % 11 === 0;
          run('INSERT INTO slots (id, counselor_id, start_at, end_at, status) VALUES (?,?,?,?,?)', k, cid[c.key], s, end(s), blocked ? 'blocked' : 'open');
        });
      }
    });
    const ensureSlot = (key: string, d: number, hr: number, status: string) => {
      const k = slotId[`${key}|${d}|${hr}`];
      if (k) { run('UPDATE slots SET status = ? WHERE id = ?', status, k); return k; }
      const s = cn(d, hr); const n = id('s');
      run('INSERT INTO slots (id, counselor_id, start_at, end_at, status) VALUES (?,?,?,?,?)', n, cid[key], s, end(s), status);
      return n;
    };

    // demo client 小周 — referred by 阿屿
    const zhou = user('13800000001', '小周', '/assets/u-asian-woman.jpg', ['client'], crId.AYU2026, cn(-12, 23));
    const uc = id('uc');
    run('INSERT INTO user_coupons (id, user_id, coupon_id, status, expires_at, used_at) VALUES (?,?,?,?,?,?)', uc, zhou, newCoupon, 'used', cn(-5, 23), cn(-1, 22));

    // 小周's intake session (ended) with summary
    const intakeId = id('is');
    run('INSERT INTO intake_sessions (id, user_id, status, risk, crisis, summary, created_at, ended_at) VALUES (?,?,?,?,?,?,?,?)', intakeId, zhou, 'ended', 'low', 0,
      JSON.stringify({ mood: '焦虑 · 疲惫', moodScore: 38, topics: ['职场压力', '失眠', '情绪低落'], duration: '1 个多月', risk: 'low', riskNote: '未报告自伤念头，建议常规咨询',
        scales: [{ scale: 'phq9', score: 9, max: 27, level: '轻度' }, { scale: 'gad7', score: 11, max: 21, level: '中度' }, { scale: 'isi', score: 16, max: 28, level: '中度' }],
        plan: '睡眠与压力评估 → CBT-I 失眠认知行为干预 6 次 → 每周情绪追踪', modality: 'voice', recommendedCounselorIds: [cid.lin, cid.he, cid.chen] }),
      cn(-1, 22, 5), cn(-1, 22, 12));
    const lines: [string, string][] = [
      ['assistant', '晚上好，我是听屿的接待助手小屿。这里很安全，你说的内容只有你和为你服务的咨询师能看到。今晚想聊点什么？'],
      ['user', '最近工作压力特别大，晚上总是睡不着，一躺下脑子就停不下来。'],
      ['assistant', '听起来你这段时间一直绷得很紧，连休息的时候都放松不下来。这种睡不着的情况大概持续多久了？'],
      ['user', '差不多一个多月了吧，白天也没精神，有时候会莫名想哭。'],
      ['assistant', '谢谢你愿意告诉我这些。一个多月的失眠加上情绪低落，确实很消耗人。我想确认一下，最近有没有出现过伤害自己的念头？'],
      ['user', '没有，就是觉得很累。'],
      ['assistant', '好的，我记下了。我为你推荐了擅长失眠和职场压力的林知夏老师，可以先预约一次语音咨询。'],
    ];
    lines.forEach(([role, content], i) => run('INSERT INTO intake_messages (id, session_id, role, content, created_at) VALUES (?,?,?,?,?)', id('im'), intakeId, role, content, cn(-1, 22, 5 + i)));

    // 小周's paid appointment: 林知夏 tomorrow 20:00, NEW100 used, attributed to 阿屿
    const s1 = ensureSlot('lin', 1, 20, 'booked');
    const appt = id('a');
    run(`INSERT INTO appointments (id, user_id, counselor_id, slot_id, start_at, end_at, mode, status, price, discount, amount, user_coupon_id, intake_session_id, share_intake, creator_id, created_at, paid_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, appt, zhou, cid.lin, s1, cn(1, 20), end(cn(1, 20)), 'voice', 'paid', 400, 100, 300, uc, intakeId, 1, crId.AYU2026, cn(-1, 22, 15), cn(-1, 22, 16));
    run('INSERT INTO payments (id, appointment_id, method, amount, status, transaction_no, created_at) VALUES (?,?,?,?,?,?,?)', id('p'), appt, 'wechat', 300, 'succeeded', 'WX' + Date.now(), cn(-1, 22, 16));
    run('INSERT INTO commissions (id, creator_id, appointment_id, amount, status, created_at) VALUES (?,?,?,?,?,?)', id('cm'), crId.AYU2026, appt, 30, 'pending', cn(-1, 22, 16));

    // 小周's assessments and mood
    for (const [scale, score, max, level, interp] of [['phq9', 9, 27, '轻度', '存在轻度抑郁症状，建议关注情绪变化，必要时寻求咨询。'], ['gad7', 11, 21, '中度', '存在中度焦虑症状，建议与咨询师一起制定应对计划。'], ['isi', 16, 28, '中度', '存在中度失眠，建议进行睡眠评估与 CBT-I 干预。']] as const) {
      run('INSERT INTO assessment_results (id, user_id, scale, answers, score, max, level, interpretation, created_at) VALUES (?,?,?,?,?,?,?,?,?)', id('ar'), zhou, scale, '[]', score, max, level, interp, cn(-1, 22, 13));
    }
    const moods = [2, 2, 3, 2, 3, 3, 2, 3, 4, 3, 3, 4, 3, 4];
    moods.forEach((m, i) => run('INSERT INTO mood_checkins (id, user_id, mood, tags, note, created_at) VALUES (?,?,?,?,?,?)', id('m'), zhou, m,
      JSON.stringify(m <= 2 ? ['工作', '睡眠'] : ['工作']), m <= 2 ? '又加班到很晚，躺下睡不着。' : '今天还行，下班走了一会儿路。', cn(-13 + i, 22, 30)));

    // conversation with 林知夏
    const conv = id('cv');
    run('INSERT INTO conversations (id, user_id, counselor_id, created_at, updated_at) VALUES (?,?,?,?,?)', conv, zhou, cid.lin, cn(-1, 22, 20), cn(0, 9, 12));
    const linUserRow = one('SELECT user_id FROM counselors WHERE id = ?', cid.lin)!.user_id as string;
    run('INSERT INTO messages (id, conversation_id, sender_id, content, created_at, read_at) VALUES (?,?,?,?,?,?)', id('msg'), conv, zhou, '林老师您好，我预约了明晚的咨询，想先问一下需要准备什么吗？', cn(-1, 22, 20), cn(0, 9, 0));
    run('INSERT INTO messages (id, conversation_id, sender_id, content, created_at, read_at) VALUES (?,?,?,?,?,?)', id('msg'), conv, linUserRow, '你好小周，我已经看过接待小结了。明晚找一个安静的地方、戴上耳机就好。睡前可以先试试 4-7-8 呼吸，明天见。', cn(0, 9, 12), null);

    // notifications for 小周
    run('INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)', id('n'), zhou, 'appointment', '预约成功', '林知夏 · 明天 20:00 语音咨询，开始前 10 分钟可进入咨询室。', `/m/orders/${appt}`, cn(-1, 22, 16));
    run('INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)', id('n'), zhou, 'message', '林知夏给你发来消息', '你好小周，我已经看过接待小结了……', `/m/messages/${conv}`, cn(0, 9, 12));

    // history: other clients, past completed appointments with reviews (drives ratings, admin charts, creator stats)
    const refs = [crId.AYU2026, crId.WORK2026, crId.LOVE2026, null, null];
    const keys = COUNSELORS.map((c) => c.key);
    let n = 0;
    for (let d = 1; d <= 30; d++) {
      const perDay = 1 + ((d * 7) % 4);
      for (let k = 0; k < perDay; k++) {
        n++;
        const ref = refs[n % refs.length];
        const cu = user(`1880000${String(n).padStart(4, '0')}`, CLIENT_NAMES[n % CLIENT_NAMES.length] + '同学', null, ['client'], ref, cn(-d - 2, 12));
        if (d > 14 && k > 0) continue;                         // older users: signup only
        const key = keys[(n * 5) % keys.length];
        const c = COUNSELORS.find((x) => x.key === key)!;
        const start = cn(-d, [10, 15, 19, 20][n % 4]);
        const sid = id('s');
        run('INSERT INTO slots (id, counselor_id, start_at, end_at, status) VALUES (?,?,?,?,?)', sid, cid[key], start, end(start), 'booked');
        const a = id('a');
        const discount = ref ? 100 : 0;
        const amount = c.price - discount;
        run(`INSERT INTO appointments (id, user_id, counselor_id, slot_id, start_at, end_at, mode, status, price, discount, amount, share_intake, creator_id, reviewed, created_at, paid_at, completed_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, a, cu, cid[key], sid, start, end(start), c.modes[0], 'completed', c.price, discount, amount, 1, ref, 1, cn(-d - 1, 21), cn(-d - 1, 21), end(start));
        run('INSERT INTO payments (id, appointment_id, method, amount, status, transaction_no, created_at) VALUES (?,?,?,?,?,?,?)', id('p'), a, n % 3 ? 'wechat' : 'alipay', amount, 'succeeded', 'WX' + (Date.now() + n), cn(-d - 1, 21));
        if (ref) run('INSERT INTO commissions (id, creator_id, appointment_id, amount, status, created_at) VALUES (?,?,?,?,?,?)', id('cm'), ref, a, Math.round(amount * 0.1), d > 7 ? 'settled' : 'pending', cn(-d - 1, 21));
        const [text, tags] = REVIEW_TEXTS[n % REVIEW_TEXTS.length];
        run('INSERT INTO reviews (id, appointment_id, user_id, counselor_id, rating, content, tags, created_at) VALUES (?,?,?,?,?,?,?,?)', id('r'), a, cu, cid[key], n % 9 === 0 ? 4 : 5, text, JSON.stringify(tags), end(start));
        run('INSERT INTO intake_sessions (id, user_id, status, risk, crisis, created_at, ended_at) VALUES (?,?,?,?,?,?,?)', id('is'), cu, 'ended', 'low', 0, cn(-d - 1, 20), cn(-d - 1, 20, 9));
      }
    }
    run('UPDATE counselors SET review_count = (SELECT COUNT(*) FROM reviews r WHERE r.counselor_id = counselors.id)');

    // referral landing visits over the last 30 days
    for (let d = 0; d < 30; d++) {
      for (const [ref, base] of [[crId.AYU2026, 40], [crId.WORK2026, 22], [crId.LOVE2026, 28]] as const) {
        const count = base + ((d * 13) % 17);
        for (let v = 0; v < count; v++) run('INSERT INTO referral_visits (id, creator_id, created_at) VALUES (?,?,?)', id('rv'), ref, cn(-d, 8 + (v % 14)));
      }
    }

    // an open crisis alert from an anonymous intake (for the admin console)
    const anon = id('is');
    run('INSERT INTO intake_sessions (id, user_id, status, risk, crisis, created_at) VALUES (?,?,?,?,?,?)', anon, null, 'active', 'high', 1, cn(0, 1, 40));
    run('INSERT INTO intake_messages (id, session_id, role, content, created_at) VALUES (?,?,?,?,?)', id('im'), anon, 'user', '最近真的撑不下去了，有时候觉得不想活了。', cn(0, 1, 42));
    run('INSERT INTO crisis_alerts (id, user_id, session_id, source, excerpt, status, created_at) VALUES (?,?,?,?,?,?,?)', id('ca'), null, anon, 'intake', '最近真的撑不下去了，有时候觉得不想活了。', 'open', cn(0, 1, 42));
  });
}

// CLI: `npm run seed`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { rmSync(config.dbPath, { force: true }); rmSync(config.dbPath + '-wal', { force: true }); rmSync(config.dbPath + '-shm', { force: true }); } catch { /* ignore */ }
  openDb(config.dbPath);
  seed();
  console.log(`seeded ${config.dbPath}`);
}
