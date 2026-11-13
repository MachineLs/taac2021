/*
 * 听屿 Tingyu — voice reception engine (prototype, no backend).
 *
 * Two modes, chosen at runtime:
 *   live  — the viewer's own voice (dictation capability) -> Claude reply (sample)
 *           -> spoken aloud (tts). Only when the viewing platform grants all three.
 *   demo  — a scripted intake session that plays itself, spoken with the platform
 *           voice when available, else the browser's speechSynthesis.
 *
 * Pages only listen to events and render; they never touch the capabilities.
 *   const vr = TingyuVoice.create();
 *   vr.on('state',   s => ...)   // 'idle' | 'listening' | 'thinking' | 'speaking'
 *   vr.on('message', m => ...)   // { role: 'ai'|'user', text, id }
 *   vr.on('partial', p => ...)   // { role, text, id }  text grows while spoken
 *   vr.on('level',   l => ...)   // 0..1, every animation frame
 *   vr.on('summary', s => ...)   // intake summary object (see DEMO_SUMMARY)
 *   vr.on('crisis',  c => ...)   // { hotlines } when risk words are detected
 *   vr.on('mode',    m => ...)   // 'demo' | 'live'
 *   vr.toggle()  // call from a click
 *   vr.send(text) / vr.stop() / vr.reset() / vr.setSound(bool)
 */
(function () {
  'use strict';

  var COUNSELORS = [
    { id: 'lin', name: '林知夏', title: '国家二级心理咨询师 · 临床心理学硕士', years: 8, rating: 4.97, sessions: 2310, price: 400, img: 'assets/c-lin.jpg', tags: ['焦虑', '失眠', '职场压力'], method: '认知行为疗法 CBT' },
    { id: 'zhou', name: '周以宁', title: '婚姻家庭治疗师 · EFT 认证', years: 11, rating: 4.95, sessions: 3480, price: 600, img: 'assets/c-zhou.jpg', tags: ['亲密关系', '婚姻', '家庭沟通'], method: '情绪聚焦疗法 EFT' },
    { id: 'he', name: '何清', title: '正念减压导师 · ACT 治疗师', years: 9, rating: 4.96, sessions: 2890, price: 450, img: 'assets/c-he.jpg', tags: ['情绪调节', '正念', '自我关怀'], method: '接纳承诺疗法 ACT' },
    { id: 'xu', name: '许蔓', title: '青少年与亲子咨询师', years: 6, rating: 4.93, sessions: 1520, price: 380, img: 'assets/c-xu.jpg', tags: ['青少年', '亲子', '学业压力'], method: '家庭系统治疗' },
    { id: 'song', name: '宋语棠', title: '创伤治疗师 · EMDR 认证', years: 12, rating: 4.98, sessions: 4120, price: 680, img: 'assets/c-song.jpg', tags: ['创伤', '哀伤', '惊恐'], method: 'EMDR 眼动脱敏' },
    { id: 'chen', name: '陈牧', title: '精神科主治医师 · 医学博士', years: 15, rating: 4.96, sessions: 5260, price: 800, img: 'assets/c-chen.jpg', tags: ['抑郁评估', '药物咨询', '双相'], method: '精神科评估与转介' },
    { id: 'fang', name: '方宁', title: '企业 EAP 顾问 · 职业发展教练', years: 7, rating: 4.94, sessions: 1980, price: 420, img: 'assets/c-fang.jpg', tags: ['职业倦怠', '领导力', '团队冲突'], method: '焦点解决短程治疗' },
    { id: 'wang', name: '王屿川', title: '精神分析取向咨询师', years: 10, rating: 4.92, sessions: 2640, price: 550, img: 'assets/c-wang.jpg', tags: ['自我探索', '男性心理', '关系模式'], method: '精神动力学' },
    { id: 'gu', name: '顾言', title: '高校心理咨询师', years: 5, rating: 4.91, sessions: 1170, price: 300, img: 'assets/c-gu.jpg', tags: ['大学生', '人际', '职业迷茫'], method: '人本主义疗法' }
  ];

  var HOTLINES = [
    { name: '全国心理援助热线', number: '12356', note: '7×24 小时 · 免费' },
    { name: '希望 24 热线', number: '400-161-9995', note: '7×24 小时' },
    { name: '紧急情况', number: '120 / 110', note: '有生命危险时立即拨打' }
  ];

  var GREETING = '晚上好，我是听屿的接待助手小屿。这里很安全，你说的内容只有你和为你服务的咨询师能看到。今晚想聊点什么？';

  var DEMO_SCRIPT = [
    { role: 'ai', text: GREETING },
    { role: 'user', text: '最近工作压力特别大，晚上总是睡不着，一躺下脑子就停不下来。' },
    { role: 'ai', text: '听起来你这段时间一直绷得很紧，连休息的时候都放松不下来。这种睡不着的情况大概持续多久了？' },
    { role: 'user', text: '差不多一个多月了吧，白天也没精神，有时候会莫名想哭。' },
    { role: 'ai', text: '谢谢你愿意告诉我这些。一个多月的失眠加上情绪低落，确实很消耗人。我想确认一下，最近有没有出现过伤害自己的念头？' },
    { role: 'user', text: '没有，就是觉得很累。' },
    { role: 'ai', text: '好的，我记下了。我建议先做一次 15 分钟的睡眠与压力评估，再为你匹配擅长职场压力和失眠的咨询师。你更习惯语音咨询还是视频咨询？' },
    { role: 'user', text: '语音吧，我不太想露脸。' },
    { role: 'ai', text: '没问题。我为你找到了林知夏老师，8 年经验，擅长认知行为疗法和失眠干预，明晚 8 点有空档。需要我先帮你预约吗？' }
  ];

  var DEMO_SUMMARY = {
    mood: '焦虑 · 疲惫',
    moodScore: 38,            // 0 (very low) .. 100 (very good)
    topics: ['职场压力', '失眠', '情绪低落'],
    duration: '1 个多月',
    risk: 'low',              // low | medium | high
    riskLabel: '低风险',
    riskNote: '未报告自伤念头，建议常规咨询',
    scales: [{ name: 'PHQ-9 抑郁筛查', value: 9, max: 27, label: '轻度' }, { name: 'GAD-7 焦虑筛查', value: 11, max: 21, label: '中度' }, { name: 'ISI 失眠严重度', value: 16, max: 28, label: '中度' }],
    plan: '睡眠与压力评估 → CBT-I 失眠认知行为干预 6 次 → 每周情绪追踪',
    modality: '语音咨询',
    counselor: 'lin',
    slot: '明天 20:00'
  };

  var CRISIS_WORDS = ['自杀', '不想活', '活不下去', '结束生命', '轻生', '伤害自己', '自残', '割腕', '跳楼', '想死', '去死'];

  var SYSTEM_PROMPT = [
    '你是「听屿」心理服务平台的语音接待助手，名字叫小屿。你在做来访前的初始接待（intake），不是在做心理治疗。',
    '要求：',
    '1. 用简体中文口语回答，温暖、平静、不评判，每次 1–3 句话，不超过 80 个字，适合朗读。不要用列表、表情符号或 Markdown。',
    '2. 先共情复述对方的感受，再只问一个问题。依次了解：主要困扰、持续多久、对睡眠/工作/关系的影响、是否有自伤或伤人念头、偏好的咨询方式（语音/视频/文字）。',
    '3. 了解足够后，推荐一位平台咨询师并提议预约。可选咨询师：' + COUNSELORS.map(function (c) { return c.name + '（' + c.tags.join('、') + '，' + c.method + '）'; }).join('；') + '。',
    '4. 如果对方提到自杀、自伤或伤害他人的想法，先表达关心，明确建议立即拨打全国心理援助热线 12356（24 小时免费），有生命危险请拨打 120 或 110，并询问对方现在是否安全。',
    '5. 不做诊断，不推荐药物，不承诺疗效。'
  ].join('\n');

  function nowId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function sleep(ms, token) {
    return new Promise(function (res, rej) {
      setTimeout(function () { token && token.cancelled ? rej({ cancelled: true }) : res(); }, ms);
    });
  }

  function create(options) {
    options = options || {};
    var handlers = {};
    var state = 'idle';
    var mode = 'demo';
    var sound = options.sound !== false;
    var history = [];          // {role, text}
    var token = null;          // cancellation token for demo playback
    var level = 0, target = 0, t0 = performance.now();
    var cap = { dictation: null, sample: null, tts: null };
    var live = { buffer: '', partial: '', silenceTimer: null, msgId: null };
    var demoStep = 0;

    function emit(evt, data) { (handlers[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
    function setState(s) { if (s !== state) { state = s; emit('state', s); } }

    // ---- ambient level animation (simulated amplitude) ----
    function frame(t) {
      var k = (t - t0) / 1000;
      if (state === 'speaking') target = 0.45 + 0.35 * Math.abs(Math.sin(k * 7.3) * Math.sin(k * 2.1 + 1)) + 0.15 * Math.random();
      else if (state === 'listening') target = 0.25 + 0.4 * Math.abs(Math.sin(k * 5.1) * Math.cos(k * 1.7)) + 0.12 * Math.random();
      else if (state === 'thinking') target = 0.18 + 0.08 * Math.sin(k * 3);
      else target = 0.08 + 0.05 * Math.sin(k * 1.2);
      level += (target - level) * 0.18;
      emit('level', Math.max(0, Math.min(1, level)));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ---- capabilities (never block first paint) ----
    if (window.claude && typeof window.claude.use === 'function') {
      Promise.all(['dictation', 'sample', 'tts'].map(function (n) {
        return window.claude.use(n).catch(function () { return null; });
      })).then(function (r) {
        cap.dictation = r[0]; cap.sample = r[1]; cap.tts = r[2];
        if (cap.dictation && cap.sample) { mode = 'live'; emit('mode', mode); wireDictation(); }
      });
    }

    // ---- speech output ----
    var zhVoice = null;
    function pickVoice() {
      if (!('speechSynthesis' in window)) return;
      var vs = window.speechSynthesis.getVoices() || [];
      zhVoice = vs.filter(function (v) { return /zh[-_]CN/i.test(v.lang) && /female|Xiaoxiao|Tingting|Ting-Ting|Google/i.test(v.name); })[0]
        || vs.filter(function (v) { return /^zh/i.test(v.lang); })[0] || null;
    }
    if ('speechSynthesis' in window) { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; }

    function browserSpeak(text, est) {
      if (!('speechSynthesis' in window) || !zhVoice) return sleep(est);
      return new Promise(function (res) {
        try {
          window.speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance(text);
          u.lang = 'zh-CN'; u.voice = zhVoice; u.rate = 1.02; u.pitch = 1.05;
          var done = false, fin = function () { if (!done) { done = true; res(); } };
          u.onend = fin; u.onerror = fin;
          setTimeout(fin, est + 4000);
          window.speechSynthesis.speak(u);
        } catch (e) { sleep(est).then(res); }
      });
    }
    function speak(text) {
      var est = Math.max(1600, text.length * 230);
      if (!sound) return sleep(est);
      if (cap.tts) {
        return cap.tts.speak(text, { voice: 'airy', language: 'zh-CN', rate: 1.05 }).catch(function (e) {
          var code = e && e.code;
          if (code === 'stopped') throw { cancelled: true };
          // The viewer turned reading aloud off: respect it and stay silent.
          if (code === 'not_granted') { cap.tts = null; sound = false; emit('sound', sound); return sleep(est); }
          if (code === 'unavailable') cap.tts = null;
          return browserSpeak(text, est);
        });
      }
      return browserSpeak(text, est);
    }
    function silence() {
      try { cap.tts && cap.tts.stop(); } catch (e) { /* ignore */ }
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }

    // Stream text on screen while the voice speaks it.
    function sayAI(text, tk) {
      var id = nowId();
      setState('speaking');
      var shown = 0, spoken = speak(text), streamDone;
      var per = Math.max(28, Math.min(70, 9000 / text.length));
      streamDone = new Promise(function (res) {
        (function step() {
          if (tk && tk.cancelled) return res();
          shown = Math.min(text.length, shown + 1);
          emit('partial', { role: 'ai', text: text.slice(0, shown), id: id });
          if (shown < text.length) setTimeout(step, per); else res();
        })();
      });
      return Promise.all([spoken, streamDone]).then(function () {
        if (tk && tk.cancelled) throw { cancelled: true };
        history.push({ role: 'ai', text: text });
        emit('message', { role: 'ai', text: text, id: id });
      });
    }

    function checkCrisis(text) {
      for (var i = 0; i < CRISIS_WORDS.length; i++) if (text.indexOf(CRISIS_WORDS[i]) >= 0) { emit('crisis', { hotlines: HOTLINES }); return true; }
      return false;
    }

    // ---- demo mode ----
    function playDemo() {
      var tk = token = { cancelled: false };
      if (demoStep >= DEMO_SCRIPT.length) { demoStep = 0; history = []; emit('reset'); }
      (function next() {
        if (tk.cancelled) return;
        if (demoStep >= DEMO_SCRIPT.length) {
          setState('idle');
          emit('summary', DEMO_SUMMARY);
          return;
        }
        var line = DEMO_SCRIPT[demoStep];
        var p;
        if (line.role === 'ai') p = sayAI(line.text, tk);
        else p = typeUser(line.text, tk).then(function () { setState('thinking'); return sleep(900, tk); });
        p.then(function () { demoStep++; return sleep(line.role === 'ai' ? 500 : 0, tk); })
          .then(next)
          .catch(function () { /* cancelled */ });
      })();
    }
    function typeUser(text, tk) {
      setState('listening');
      var id = nowId();
      return new Promise(function (res, rej) {
        var i = 0;
        (function step() {
          if (tk.cancelled) return rej({ cancelled: true });
          i = Math.min(text.length, i + 1 + (Math.random() < 0.3 ? 1 : 0));
          emit('partial', { role: 'user', text: text.slice(0, i), id: id });
          if (i < text.length) setTimeout(step, 85 + Math.random() * 60);
          else setTimeout(function () {
            history.push({ role: 'user', text: text });
            emit('message', { role: 'user', text: text, id: id });
            res();
          }, 420);
        })();
      });
    }
    var DEMO_REPLIES = [
      '我听到了。能多说一点，这种感觉通常在什么时候最明显吗？',
      '谢谢你的信任。这件事对你的睡眠和工作有影响吗？',
      '这听起来真的不容易，你已经撑了很久。你更希望通过语音、视频还是文字和咨询师交流？',
      '好的。根据你说的，我会为你匹配一位合适的咨询师，并先安排一次免费的初始评估。'
    ];
    var demoReplyIdx = 0;

    // ---- live mode ----
    function wireDictation() {
      var d = cap.dictation;
      d.onPartial(function (e) {
        live.partial = e.text || '';
        if (!live.msgId) live.msgId = nowId();
        emit('partial', { role: 'user', text: (live.buffer + live.partial).trim(), id: live.msgId });
        armSilence();
      });
      d.onFinal(function (e) {
        live.buffer += e.text;
        live.partial = '';
        if (!live.msgId) live.msgId = nowId();
        emit('partial', { role: 'user', text: live.buffer.trim(), id: live.msgId });
        armSilence();
      });
      d.onState(function (e) {
        if (e.state === 'listening') setState('listening');
        if (e.state === 'idle') {
          clearTimeout(live.silenceTimer);
          var text = live.buffer.trim();
          var id = live.msgId;
          live.buffer = ''; live.partial = ''; live.msgId = null;
          if (text) commitUser(text, id);
          else if (state === 'listening') setState('idle');
          if (e.reason === 'not_granted' || e.reason === 'unavailable') { mode = 'demo'; emit('mode', mode); }
        }
      });
    }
    function armSilence() {
      clearTimeout(live.silenceTimer);
      live.silenceTimer = setTimeout(function () {
        if (cap.dictation && cap.dictation.active() && live.buffer.trim()) cap.dictation.stop();
      }, 1800);
    }
    function commitUser(text, id) {
      history.push({ role: 'user', text: text });
      emit('message', { role: 'user', text: text, id: id || nowId() });
      reply(checkCrisis(text));
    }
    function buildInput() {
      var msgs = [{ role: 'user', content: SYSTEM_PROMPT + '\n\n请以接待助手身份开始。' }, { role: 'assistant', content: GREETING }];
      history.forEach(function (h, i) {
        if (i === 0 && h.role === 'ai' && h.text === GREETING) return;
        var role = h.role === 'ai' ? 'assistant' : 'user';
        var last = msgs[msgs.length - 1];
        if (last.role === role) last.content += '\n' + h.text; else msgs.push({ role: role, content: h.text });
      });
      return msgs;
    }
    var CRISIS_REPLY = '听到你这么说，我很担心你。你现在安全吗？请马上拨打全国心理援助热线 12356，24 小时免费；如果有危险，请立即拨打 120 或 110。值班咨询师也会在 3 分钟内联系你。';
    function reply(crisis) {
      var tk = token = { cancelled: false };
      setState('thinking');
      var p;
      if (mode === 'live' && cap.sample) {
        p = cap.sample(buildInput(), { modelTier: 'quick', cache: false }).then(function (r) {
          return (r && r.text ? r.text : '').replace(/[*#>`]/g, '').trim() || DEMO_REPLIES[0];
        }).catch(function () { return crisis ? CRISIS_REPLY : DEMO_REPLIES[(demoReplyIdx++) % DEMO_REPLIES.length]; });
      } else {
        p = sleep(800).then(function () { return crisis ? CRISIS_REPLY : DEMO_REPLIES[(demoReplyIdx++) % DEMO_REPLIES.length]; });
      }
      return p.then(function (text) { if (!tk.cancelled) return sayAI(text, tk); })
        .then(function () { if (!tk.cancelled) setState('idle'); })
        .catch(function () { /* cancelled */ });
    }

    function summarize() {
      if (mode !== 'live' || !cap.sample || history.filter(function (h) { return h.role === 'user'; }).length < 1) {
        emit('summary', DEMO_SUMMARY); return Promise.resolve(DEMO_SUMMARY);
      }
      var transcript = history.map(function (h) { return (h.role === 'ai' ? '接待：' : '来访者：') + h.text; }).join('\n');
      var ask = '以下是心理服务平台的接待对话。请输出 JSON（不要任何其它文字），字段：mood（2-4字情绪，用「 · 」分隔两个词）、moodScore（0-100整数，越低越差）、topics（最多3个中文短语数组）、duration（字符串）、risk（low/medium/high）、riskLabel（低风险/需关注/高风险）、riskNote（一句话）、plan（一句话服务方案，用 → 分隔步骤）、modality（语音咨询/视频咨询/文字咨询）、counselor（从 ' + COUNSELORS.map(function (c) { return c.id + '=' + c.name + '(' + c.tags.join('/') + ')'; }).join(', ') + ' 中选一个 id）。\n\n' + transcript;
      return cap.sample.json(ask, { modelTier: 'quick' }).then(function (s) {
        var out = Object.assign({}, DEMO_SUMMARY, s || {}, { scales: DEMO_SUMMARY.scales, slot: DEMO_SUMMARY.slot });
        emit('summary', out); return out;
      }).catch(function () { emit('summary', DEMO_SUMMARY); return DEMO_SUMMARY; });
    }

    var api = {
      on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); if (evt === 'mode') fn(mode); if (evt === 'state') fn(state); return api; },
      get mode() { return mode; },
      get state() { return state; },
      get history() { return history.slice(); },
      counselors: COUNSELORS,
      hotlines: HOTLINES,
      demoSummary: DEMO_SUMMARY,
      script: DEMO_SCRIPT,
      setSound: function (on) { sound = !!on; if (!sound) silence(); emit('sound', sound); },
      get sound() { return sound; },
      /** Call from a click. */
      toggle: function () {
        if (mode === 'live') {
          if (state === 'listening') { cap.dictation.stop(); return; }
          if (state === 'speaking' || state === 'thinking') { api.stop(); return; }
          if (!history.length) {
            // greet first, then the next click talks
            var tk = token = { cancelled: false };
            sayAI(GREETING, tk).then(function () { setState('idle'); }).catch(function () {});
            return;
          }
          setState('listening');
          cap.dictation.start({ language: 'zh' }).catch(function (e) {
            setState('idle');
            if (e && (e.code === 'not_granted' || e.code === 'unavailable')) { mode = 'demo'; emit('mode', mode); }
          });
          return;
        }
        if (state === 'idle') playDemo(); else api.stop();
      },
      send: function (text) {
        text = String(text || '').trim().slice(0, 500);
        if (!text) return;
        if (token) token.cancelled = true;
        silence();
        var id = nowId();
        if (!history.length) history.push({ role: 'ai', text: GREETING });
        commitUser(text, id);
      },
      stop: function () {
        if (token) token.cancelled = true;
        silence();
        if (cap.dictation && cap.dictation.active && cap.dictation.active()) cap.dictation.stop();
        setState('idle');
      },
      reset: function () { api.stop(); history = []; demoStep = 0; emit('reset'); },
      summarize: summarize,
      counselor: function (id) { return COUNSELORS.filter(function (c) { return c.id === id; })[0] || COUNSELORS[0]; }
    };
    return api;
  }

  window.TingyuVoice = { create: create, COUNSELORS: COUNSELORS, HOTLINES: HOTLINES, DEMO_SUMMARY: DEMO_SUMMARY, DEMO_SCRIPT: DEMO_SCRIPT };
})();
