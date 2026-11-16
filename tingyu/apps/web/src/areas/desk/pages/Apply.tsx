// /desk/apply — counselor onboarding application (any signed-in user).
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ApplyCounselorReq, ConsultMode, CounselorDetail } from '@tingyu/shared';
import { ISSUE_TAGS, MODE_LABEL } from '@tingyu/shared';
import { api, ApiError } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { Loading } from '../../../components/states';
import { yuan } from '../../../lib/format';
import { DeskBare } from '../DeskLayout';
import { Icon, Spin, errMsg } from '../ui';

const TITLES = ['国家二级心理咨询师', '国家三级心理咨询师', '注册心理师（中国心理学会）', '注册督导师（中国心理学会）', '心理治疗师（卫健委）', '精神科医师', '婚姻家庭咨询师'];
const METHODS = ['认知行为疗法 CBT', '接纳承诺疗法 ACT', '精神动力学', '人本主义', '情绪聚焦疗法 EFT', '家庭系统治疗', '正念疗法', '叙事疗法', '焦点解决短期治疗', '催眠疗法', '沙盘游戏'];
const MODES: ConsultMode[] = ['video', 'voice', 'text', 'offline'];

type Form = { name: string; title: string; headline: string; years: string; intro: string; tags: string[]; methods: string[]; modes: ConsultMode[]; price: string; city: string; gender: 'female' | 'male' | '' };
const EMPTY: Form = { name: '', title: '', headline: '', years: '', intro: '', tags: [], methods: [], modes: ['video', 'voice'], price: '', city: '', gender: '' };

export default function Apply() {
  const { user, refresh } = useAuth();
  const [existing, setExisting] = useState<CounselorDetail | 'unknown' | null>(null);
  const [checking, setChecking] = useState(!!user?.counselorId);
  const [submitted, setSubmitted] = useState<CounselorDetail | null>(null);
  const [reapply, setReapply] = useState(false);

  useEffect(() => {
    if (!user?.counselorId) { setChecking(false); return; }
    setChecking(true);
    api.counselor(user.counselorId)
      .then(setExisting)
      // public detail may hide non-approved profiles → treat as under review
      .catch(() => setExisting('unknown'))
      .finally(() => setChecking(false));
  }, [user?.counselorId]);

  let body;
  if (checking) body = <Loading full />;
  else if (submitted) body = <Pending detail={submitted} />;
  else if (existing && !reapply && (existing === 'unknown' || existing.status === 'pending')) body = <Pending detail={existing === 'unknown' ? null : existing} />;
  else if (existing && existing !== 'unknown' && existing.status === 'approved') body = <Approved detail={existing} />;
  else body = (
    <ApplyForm
      rejected={!!existing && existing !== 'unknown' && existing.status === 'rejected'}
      defaults={user?.name ? { ...EMPTY, name: user.name } : EMPTY}
      onDone={(d) => { setSubmitted(d); setReapply(false); refresh(); }}
    />
  );
  return <DeskBare>{body}</DeskBare>;
}

function Pending({ detail }: { detail: CounselorDetail | null }) {
  return (
    <div className="card desk-apply-state">
      <span className="desk-apply-ic pending"><Icon name="clock" size={30} /></span>
      <h1>入驻申请审核中</h1>
      <p>平台会在 <b>1–3 个工作日</b>内完成资质核验与视频面试邀约，结果将通过短信和站内通知告知你。</p>
      <ol className="desk-steps">
        <li className="done"><i><Icon name="check" size={14} /></i><b>提交申请</b><small>已提交</small></li>
        <li className="cur"><i>2</i><b>资质审核</b><small>进行中</small></li>
        <li><i>3</i><b>视频面试</b><small>待安排</small></li>
        <li><i>4</i><b>开通主页</b><small>审核通过后</small></li>
      </ol>
      {detail && (
        <dl className="desk-dl desk-apply-sum">
          <div><dt>姓名</dt><dd>{detail.name}</dd></div>
          <div><dt>资质</dt><dd>{detail.title}</dd></div>
          <div><dt>从业年限</dt><dd>{detail.years} 年</dd></div>
          <div><dt>擅长</dt><dd>{detail.tags.join('、')}</dd></div>
          <div><dt>咨询方式</dt><dd>{detail.modes.map((m) => MODE_LABEL[m]).join('、')}</dd></div>
          <div><dt>价格</dt><dd className="num">{yuan(detail.price)} / 50 分钟</dd></div>
        </dl>
      )}
      <div className="desk-apply-actions">
        <a className="btn btn-line" href="/">返回官网</a>
        <Link className="btn btn-soft" to="/desk">先看看工作台</Link>
      </div>
    </div>
  );
}

function Approved({ detail }: { detail: CounselorDetail }) {
  return (
    <div className="card desk-apply-state">
      <span className="desk-apply-ic ok"><Icon name="check" size={30} /></span>
      <h1>{detail.name}，你已成功入驻听屿</h1>
      <p>你的主页已对来访者开放。去排班页发布可约时段，就可以开始接诊了。</p>
      <div className="desk-apply-actions">
        <Link className="btn btn-blue" to="/desk">进入工作台</Link>
        <Link className="btn btn-line" to="/desk/schedule">管理排班</Link>
      </div>
    </div>
  );
}

function ApplyForm({ defaults, rejected, onDone }: { defaults: Form; rejected: boolean; onDone: (d: CounselorDetail) => void }) {
  const [f, setF] = useState<Form>(defaults);
  const [errs, setErrs] = useState<Partial<Record<keyof Form | 'agree', string>>>({});
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: undefined })); };
  const toggle = <K extends 'tags' | 'methods' | 'modes'>(k: K, v: Form[K][number], max = 99) => {
    const cur = f[k] as string[];
    if (!cur.includes(v) && cur.length >= max) return;
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) as Form[K]);
  };

  function validate() {
    const e: typeof errs = {};
    if (!f.name.trim()) e.name = '请填写真实姓名';
    if (!f.title.trim()) e.title = '请填写或选择资质';
    if (!f.headline.trim()) e.headline = '请用一句话介绍自己';
    else if (f.headline.trim().length > 40) e.headline = '一句话介绍不超过 40 字';
    const y = Number(f.years);
    if (!f.years || !Number.isInteger(y) || y < 0 || y > 60) e.years = '请填写 0–60 的整数';
    if (f.intro.trim().length < 30) e.intro = '个人简介至少 30 字，帮助来访者了解你';
    if (!f.tags.length) e.tags = '至少选择 1 个擅长方向';
    if (!f.methods.length) e.methods = '至少选择 1 个咨询流派';
    if (!f.modes.length) e.modes = '至少选择 1 种咨询方式';
    const p = Number(f.price);
    if (!f.price || !Number.isInteger(p) || p < 50 || p > 5000) e.price = '价格需为 50–5000 的整数';
    if (f.modes.includes('offline') && !f.city.trim()) e.city = '提供面询需填写所在城市';
    if (!f.gender) e.gender = '请选择性别';
    if (!agree) e.agree = '请确认资质信息真实有效';
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) { setErr('请检查标红的字段'); return; }
    setBusy(true); setErr('');
    const body: ApplyCounselorReq = {
      name: f.name.trim(), title: f.title.trim(), headline: f.headline.trim(), years: Number(f.years), intro: f.intro.trim(),
      tags: f.tags, methods: f.methods, modes: f.modes, price: Number(f.price), city: f.city.trim() || null, gender: f.gender as 'female' | 'male',
    };
    try { onDone(await api.applyCounselor(body)); }
    catch (e) {
      setErr(e instanceof ApiError && e.status === 409 ? '你已提交过入驻申请，请等待审核结果' : errMsg(e, '提交失败，请稍后再试'));
    } finally { setBusy(false); }
  }

  const E = ({ k }: { k: keyof typeof errs }) => (errs[k] ? <span className="form-error">{errs[k]}</span> : null);

  return (
    <div className="desk-apply">
      <div className="desk-apply-intro">
        <h1>成为听屿签约咨询师</h1>
        <p>AI 助理「小屿」负责接待、初筛与匹配，你专注于专业咨询。平台承担获客、支付、排班提醒与来访者保障。</p>
        <ul>
          <li><Icon name="check" size={16} />来访者经 AI 接待后精准匹配，附带接待小结</li>
          <li><Icon name="check" size={16} />透明结算：平台服务费 30%，每月 10 日结算</li>
          <li><Icon name="check" size={16} />自主排班，随时开放或关闭可约时段</li>
        </ul>
        {rejected && <div className="desk-warn-box"><Icon name="alert" size={16} />你之前的申请未通过审核，可完善资料后重新提交。</div>}
      </div>

      <form className="card desk-apply-form" onSubmit={submit} noValidate>
        <h2>基本信息</h2>
        <div className="desk-form-grid">
          <label className="field"><span>真实姓名 *</span><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={20} aria-invalid={!!errs.name} /><E k="name" /></label>
          <div className="field"><span>性别 *</span>
            <div className="desk-radios" role="radiogroup" aria-label="性别">
              {(['female', 'male'] as const).map((g) => <button key={g} type="button" role="radio" aria-checked={f.gender === g} className={`chip${f.gender === g ? ' on' : ''}`} onClick={() => set('gender', g)}>{g === 'female' ? '女' : '男'}</button>)}
            </div><E k="gender" />
          </div>
          <label className="field"><span>资质 *</span>
            <input className="input" list="desk-titles" placeholder="如：国家二级心理咨询师" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={40} aria-invalid={!!errs.title} />
            <datalist id="desk-titles">{TITLES.map((t) => <option key={t} value={t} />)}</datalist><E k="title" />
          </label>
          <label className="field"><span>从业年限 *</span><input className="input" type="number" min={0} max={60} inputMode="numeric" placeholder="年" value={f.years} onChange={(e) => set('years', e.target.value)} aria-invalid={!!errs.years} /><E k="years" /></label>
          <label className="field span2"><span>一句话介绍 *</span><input className="input" placeholder="如：临床心理学硕士 · 认知行为疗法（CBT）" value={f.headline} onChange={(e) => set('headline', e.target.value)} maxLength={40} aria-invalid={!!errs.headline} /><E k="headline" /></label>
          <label className="field span2"><span>个人简介 *</span><textarea className="textarea" rows={5} placeholder="教育背景、受训经历、咨询理念、擅长处理的议题…" value={f.intro} onChange={(e) => set('intro', e.target.value)} maxLength={1000} aria-invalid={!!errs.intro} />
            <span className="desk-field-foot"><E k="intro" /><small className="muted num">{f.intro.trim().length}/1000</small></span>
          </label>
        </div>

        <h2>专业方向</h2>
        <div className="field"><span>擅长方向 *（最多 6 个）</span>
          <div className="desk-chips">{ISSUE_TAGS.map((t) => <button key={t} type="button" aria-pressed={f.tags.includes(t)} className={`chip${f.tags.includes(t) ? ' on' : ''}`} onClick={() => toggle('tags', t, 6)}>{t}</button>)}</div><E k="tags" />
        </div>
        <div className="field"><span>咨询流派 *</span>
          <div className="desk-chips">{METHODS.map((t) => <button key={t} type="button" aria-pressed={f.methods.includes(t)} className={`chip${f.methods.includes(t) ? ' on' : ''}`} onClick={() => toggle('methods', t, 5)}>{t}</button>)}</div><E k="methods" />
        </div>

        <h2>服务设置</h2>
        <div className="desk-form-grid">
          <div className="field span2"><span>咨询方式 *</span>
            <div className="desk-chips">{MODES.map((m) => <button key={m} type="button" aria-pressed={f.modes.includes(m)} className={`chip${f.modes.includes(m) ? ' on' : ''}`} onClick={() => toggle('modes', m)}>{MODE_LABEL[m]}</button>)}</div><E k="modes" />
          </div>
          <label className="field"><span>价格（元 / 50 分钟）*</span><input className="input" type="number" min={50} max={5000} inputMode="numeric" placeholder="如 400" value={f.price} onChange={(e) => set('price', e.target.value)} aria-invalid={!!errs.price} /><E k="price" /></label>
          <label className="field"><span>所在城市{f.modes.includes('offline') ? ' *' : '（提供面询时必填）'}</span><input className="input" placeholder="如：北京" value={f.city} onChange={(e) => set('city', e.target.value)} maxLength={20} aria-invalid={!!errs.city} /><E k="city" /></label>
        </div>

        <label className="desk-agree">
          <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrs((x) => ({ ...x, agree: undefined })); }} />
          <span>我承诺所填资质与经历真实有效，同意平台进行资质核验，并遵守《心理咨询师职业伦理守则》。</span>
        </label>
        <E k="agree" />
        {err && <div className="desk-form-err" role="alert">{err}</div>}
        <div className="desk-apply-submit">
          <span className="muted desk-small">提交后 1–3 个工作日内完成审核，结果将短信通知你</span>
          <button className="btn btn-blue btn-lg" type="submit" disabled={busy}>{busy && <Spin />}提交申请</button>
        </div>
      </form>
    </div>
  );
}
