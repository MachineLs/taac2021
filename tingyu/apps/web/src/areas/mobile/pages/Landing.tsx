// /m/r/:refCode — creator (达人) H5 landing page, opened from 抖音 / 小红书.
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAsync } from '../../../lib/useAsync';
import { rememberRefCode } from '../../../lib/ref';
import { ErrorState, Loading } from '../../../components/states';
import { Icon } from '../icons';
import { CounselorCard } from '../CounselorCard';
import { BottomBar, errMsg } from '../ui';

const visited = new Set<string>();
const fans = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)} 万` : String(n));
const STEPS = [
  { t: '和小屿语音聊 3 分钟', d: '说说最近的困扰，可以匿名' },
  { t: '生成你的接待小结', d: '情绪状态、主要困扰、建议方案' },
  { t: '匹配持证咨询师', d: '按困扰、方式、价格推荐 1–3 位' },
  { t: '预约 50 分钟咨询', d: '视频 / 语音 / 文字，新人立减 100' },
];

export default function Landing() {
  const { refCode = '' } = useParams();
  const nav = useNavigate();
  const creator = useAsync(() => api.creator(refCode), [refCode]);
  const recs = useAsync(() => api.creatorCounselors(refCode), [refCode]);
  useEffect(() => {
    if (!refCode) return;
    rememberRefCode(refCode);
    if (visited.has(refCode)) return;
    visited.add(refCode);
    try { const k = `tingyu.m.visit.${refCode}`; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch { /* ignore */ }
    api.creatorVisit(refCode).catch(() => { /* attribution is best-effort */ });
  }, [refCode]);

  if (creator.loading && !creator.data) return <Loading full />;
  if (creator.error || !creator.data) {
    return (
      <div className="m-land">
        <div className="st st-full"><b>链接已失效</b><span>{errMsg(creator.error, '没有找到这位推荐人')}</span>
          <div className="m-row-gap"><Link className="btn btn-line btn-pill" to="/m">逛逛听屿</Link><Link className="btn btn-blue btn-pill" to="/m/voice">和小屿聊聊</Link></div></div>
      </div>
    );
  }
  const c = creator.data;
  return (
    <div className="m-land">
      <section className="m-land-hero">
        <div className="m-land-brand"><span className="m-logo"><i>屿</i>听屿心理</span><span className="m-land-from">来自{c.platform}的推荐</span></div>
        <div className="m-land-creator">
          <img className="avatar" src={c.avatar} alt="" width={64} height={64} />
          <div>
            <b>{c.name}</b>
            <span><em className={`m-plat ${c.platform === '抖音' ? 'dy' : 'xhs'}`}>{c.platform}</em>{fans(c.followers)} 粉丝</span>
          </div>
        </div>
        <blockquote className="m-land-quote">
          <p>“{c.bio}”</p>
          <cite>{c.name} 推荐你：心里有事的时候，先和 AI 助理小屿聊 3 分钟，再找到适合你的持证咨询师。</cite>
        </blockquote>
      </section>

      <section className="m-land-video">
        <div className="m-land-cover" style={{ backgroundImage: 'url(/assets/headphones.jpg)' }}>
          <span className="m-land-play"><Icon name="play" size={26} fill /></span>
          <span className="m-land-dur num">03:12</span>
        </div>
        <div className="m-land-vt"><b>睡不着的夜里，你在想什么？</b><small>{c.name} · {c.platform}同款视频</small></div>
      </section>

      <section className="m-land-cta">
        <button type="button" className="m-land-big" onClick={() => nav('/m/voice')}>
          <span className="m-land-orb"><Icon name="mic" size={26} /></span>
          <span><b>和小屿说说</b><small>免费 · 匿名 · 3 分钟帮你理清困扰</small></span>
          <Icon name="right" size={20} />
        </button>
        <div className="m-land-gift"><Icon name="gift" size={16} />通过 {c.name} 的链接注册，新人首单立减 <b>¥100</b></div>
      </section>

      <section className="m-card">
        <h3>接待流程</h3>
        <ol className="m-timeline">{STEPS.map((s, i) => <li key={i}><span className="num">{i + 1}</span><div><b>{s.t}</b><small>{s.d}</small></div></li>)}</ol>
      </section>

      <h2 className="m-section-t">{c.name} 推荐的咨询师</h2>
      <div className="m-pad-t">
        {recs.loading && !recs.data ? <Loading /> : recs.error ? <ErrorState error={new Error(errMsg(recs.error, '加载失败'))} onRetry={recs.reload} />
          : recs.data?.length ? recs.data.map((x) => <CounselorCard key={x.id} c={x} />)
          : <p className="m-slots-empty" style={{ margin: '0 16px' }}>暂时没有推荐，<Link className="m-link" to="/m/counselors">浏览全部咨询师 ›</Link></p>}
      </div>

      <section className="m-card m-land-privacy">
        <h3><Icon name="lock" size={18} />我们的隐私承诺</h3>
        <ul>
          <li>和小屿的对话加密保存，不会分享给推荐人或任何第三方</li>
          <li>只有你在预约时授权的咨询师，才能看到你的接待小结</li>
          <li>小屿是 AI 助理，只做接待与匹配，不做诊断和治疗；咨询由持证咨询师提供</li>
          <li>如遇紧急情况，请立即拨打 12356 心理援助热线或 120</li>
        </ul>
      </section>
      <p className="m-foot-note">推荐人只能看到访问和下单数量，看不到你的任何个人信息与对话内容</p>

      <BottomBar>
        <button type="button" className="btn btn-blue btn-lg btn-block m-land-bar" onClick={() => nav('/m/voice')}><Icon name="mic" size={20} />开始语音接待</button>
      </BottomBar>
    </div>
  );
}
