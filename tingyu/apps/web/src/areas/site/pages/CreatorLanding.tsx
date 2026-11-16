import { useEffect, useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { useAsync } from '../../../lib/useAsync';
import { rememberRefCode } from '../../../lib/ref';
import { Empty, ErrorState, Loading } from '../../../components/states';
import { Icon } from '../components/Icon';
import { CounselorCard, CounselorCardSkeleton } from '../components/CounselorCard';

const fans = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)} 万` : n.toLocaleString('zh-CN'));

export default function CreatorLanding() {
  const { refCode = '' } = useParams();
  const { user } = useAuth();
  const isSmall = typeof window !== 'undefined' && window.innerWidth < 768;
  const creator = useAsync(() => (isSmall ? Promise.resolve(null) : api.creator(refCode)), [refCode]);
  const recs = useAsync(() => (isSmall ? Promise.resolve([]) : api.creatorCounselors(refCode)), [refCode]);
  const visited = useRef('');

  useEffect(() => {
    if (isSmall || !creator.data || visited.current === refCode) return;
    visited.current = refCode;
    rememberRefCode(creator.data.refCode);
    api.creatorVisit(refCode).catch(() => {});
    document.title = `${creator.data.name} 推荐 · 听屿心理`;
  }, [creator.data, refCode, isSmall]);

  if (isSmall) return <Navigate to={`/m/r/${encodeURIComponent(refCode)}`} replace />;
  if (creator.error) return <div className="site-wrap site-pad"><ErrorState error={creator.error} onRetry={creator.reload} /><div className="site-center"><Link className="btn btn-blue" to="/">去首页看看</Link></div></div>;
  if (!creator.data) return <Loading full />;
  const c = creator.data;

  return (
    <div className="site-cr">
      <section className="site-cr-hero">
        <div className="site-wrap site-cr-hero-in">
          <div>
            <div className="site-cr-by">
              <img className="avatar" src={c.avatar} alt="" width={56} height={56} />
              <div><b>{c.name}</b><span>{c.platform} · {fans(c.followers)} 粉丝 · 听屿合作达人</span></div>
            </div>
            <h1>“{c.bio}”</h1>
            <p className="site-lead">通过 {c.name} 的邀请来到听屿：先和 AI 助理小屿聊 3 分钟，理清困扰、免费匹配持证咨询师。新用户首单立减 <b>100 元</b>。</p>
            <div className="site-row-gap">
              <Link className="btn btn-blue btn-lg" to="/intake"><Icon name="mic" />去和小屿聊聊</Link>
              {user ? <Link className="btn btn-line btn-lg" to="/counselors">浏览咨询师</Link>
                : <Link className="btn btn-orange btn-lg" to="/login?next=%2Fcounselors"><Icon name="gift" />注册领 100 元券</Link>}
            </div>
            <p className="muted site-small site-mt12">邀请码 <b className="num">{c.refCode}</b> 已记录，注册后自动生效</p>
          </div>
          <div className="site-cr-coupon">
            <span>新人专享</span>
            <b className="num">¥100</b>
            <small>首单立减 · 满 300 可用</small>
            <ul><li><Icon name="check" size={14} />AI 语音接待永久免费</li><li><Icon name="check" size={14} />咨询师全部持证审核</li><li><Icon name="check" size={14} />开始前 24 小时可全额退款</li></ul>
          </div>
        </div>
      </section>

      <section className="site-sec site-wrap">
        <div className="site-sec-h"><div><h2>{c.name} 推荐的咨询师</h2><p>根据粉丝最常聊到的困扰挑选，点击时间即可预约</p></div><Link to="/counselors">查看全部 →</Link></div>
        {recs.error ? <ErrorState error={recs.error} onRetry={recs.reload} />
          : !recs.data ? <div className="site-plist">{[0, 1].map((i) => <CounselorCardSkeleton key={i} />)}</div>
          : recs.data.length === 0 ? <Empty title="暂无推荐" action={<Link className="btn btn-blue" to="/counselors">浏览全部咨询师</Link>} />
          : <div className="site-plist">{recs.data.map((x) => <CounselorCard key={x.id} c={x} />)}</div>}
      </section>

      <section className="site-sec site-wrap">
        <div className="site-steps">
          <div className="site-step"><div className="site-step-n">1</div><h3>和小屿聊聊</h3><p>语音说出困扰，3 分钟完成初步筛查，免费。</p></div>
          <div className="site-step"><div className="site-step-n">2</div><h3>获得匹配</h3><p>小屿生成接待小结，推荐 1–3 位合适的咨询师。</p></div>
          <div className="site-step"><div className="site-step-n">3</div><h3>预约咨询</h3><p>选择时间在线支付，新人券自动抵扣 100 元。</p></div>
          <div className="site-step"><div className="site-step-n">4</div><h3>开始改变</h3><p>持证咨询师一对一，咨询内容全程保密。</p></div>
        </div>
        <p className="site-disclaimer site-mt12">达人仅做内容分享与推荐，不提供心理咨询服务；AI 助理小屿只做接待、初筛与匹配，不提供诊断和治疗。</p>
      </section>
    </div>
  );
}
