import { it } from 'vitest';
import { setup } from './helpers';
it('smoke', async () => {
  const { api } = setup();
  const s = (await api.post('/api/intake/sessions')).body;
  console.log('A:', s.messages[0].content);
  for (const t of ['最近工作压力特别大，晚上总是睡不着，一躺下脑子就停不下来。', '差不多一个多月了吧，白天也没精神，有时候会莫名想哭。', '你是机器人吗', '没有，就是觉得很累。', '语音吧', '好的', '谢谢']) {
    const r = await api.post(`/api/intake/sessions/${s.id}/reply`).send({ content: t });
    console.log('U:', t, '\nA:', r.body.reply?.content, r.body.reply?.content.length, r.status);
  }
  const e = await api.post(`/api/intake/sessions/${s.id}/end`);
  console.log(JSON.stringify(e.body.summary, null, 1));
  const s2 = (await api.post('/api/intake/sessions')).body;
  for (const t of ['嗯', '不知道', '和男朋友分手了，很难过', '半年', '还好', '说不好', '不清楚', '都可以', '再想想']) {
    const r = await api.post(`/api/intake/sessions/${s2.id}/reply`).send({ content: t });
    console.log('U:', t, '\nA:', r.body.reply?.content, r.body.reply?.content.length);
  }
});
