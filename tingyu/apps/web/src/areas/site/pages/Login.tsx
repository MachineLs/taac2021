import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { peekRefCode } from '../../../lib/ref';
import { useToast } from '../../../components/Toast';
import { Loading } from '../../../components/states';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Layout';
import { errMsg, INTAKE_KEY } from '../util';

/** Only allow same-origin relative paths as the post-login destination. */
function safeNext(v: string | null) {
  if (!v || !v.startsWith('/') || v.startsWith('//')) return '/';
  if (v.startsWith('/login')) return '/';
  return v;
}

export default function Login() {
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const { user, ready, login } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [cd, setCd] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ isNew: boolean } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const ref = peekRefCode();

  useEffect(() => { document.title = '登录 / 注册 · 听屿心理'; }, []);
  useEffect(() => {
    if (cd <= 0) return;
    const t = window.setTimeout(() => setCd(cd - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cd]);

  if (!ready) return <Loading full />;
  if (user && !done && !submitting) return <Navigate to={next} replace />;

  const phoneOk = /^1[3-9]\d{9}$/.test(phone);
  const codeOk = /^\d{6}$/.test(code);

  const send = async () => {
    setErr(null);
    if (!phoneOk) { setErr('请输入正确的 11 位手机号'); return; }
    setSending(true);
    try {
      const r = await api.sendCode({ phone });
      setDevCode(r.devCode ?? null);
      setCd(60);
      toast('验证码已发送');
      codeRef.current?.focus();
    } catch (e) { setErr(errMsg(e, '验证码发送失败')); } finally { setSending(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!phoneOk) { setErr('请输入正确的 11 位手机号'); return; }
    if (!codeOk) { setErr('请输入 6 位验证码'); return; }
    if (!agree) { setErr('请先阅读并同意用户协议与隐私政策'); return; }
    setSubmitting(true);
    try {
      const r = await login(phone, code);
      // An anonymous 小屿 session started before login belongs to this user now.
      try { const sid = sessionStorage.getItem(INTAKE_KEY); if (sid) await api.intakeClaim(sid).catch(() => {}); } catch { /* ignore */ }
      if (r.isNew) {
        setDone({ isNew: true });
        window.setTimeout(() => nav(next, { replace: true }), 1800);
      } else nav(next, { replace: true });
    } catch (e2) { setErr(errMsg(e2, '登录失败，请重试')); setSubmitting(false); }
  };

  return (
    <div className="site-login">
      <div className="site-login-side">
        <Logo sub={false} />
        <div className="site-login-copy">
          <h1>说出来，<br />就是改变的开始</h1>
          <p>登录后可以预约咨询、保存小屿接待小结、记录情绪和测评结果。</p>
          <ul>
            <li><Icon name="gift" size={18} />新用户注册即送 <b>100 元</b> 首单券</li>
            <li><Icon name="shield" size={18} />咨询师全部持证，平台担保交易</li>
            <li><Icon name="lock" size={18} />手机号仅用于登录与预约提醒，严格保密</li>
          </ul>
        </div>
        <span className="site-login-foot">需要紧急帮助？请拨打 12356（24 小时免费）</span>
      </div>

      <div className="site-login-main">
        <div className="site-login-card card">
          {done?.isNew ? (
            <div className="site-login-done">
              <span className="site-success-ic"><Icon name="gift" size={28} /></span>
              <h2>欢迎来到听屿</h2>
              <p>新人券「首单立减 100 元」已发放到你的账户，预约时自动使用。</p>
              <button className="btn btn-blue btn-block" type="button" onClick={() => nav(next, { replace: true })}>继续</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2>手机号登录 / 注册</h2>
              <p className="muted site-small">未注册的手机号验证后将自动创建账号{ref ? ` · 邀请码 ${ref}` : ''}</p>
              <label className="field"><span>手机号</span>
                <div className="site-phone"><span>+86</span>
                  <input className="input" inputMode="numeric" autoComplete="tel" maxLength={11} placeholder="请输入手机号" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} aria-invalid={!!phone && !phoneOk} autoFocus />
                </div>
              </label>
              <label className="field"><span>验证码</span>
                <div className="site-codebox">
                  <input ref={codeRef} className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 位验证码" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                  <button className="btn btn-soft" type="button" disabled={sending || cd > 0 || !phoneOk} onClick={send}>{sending ? '发送中…' : cd > 0 ? `${cd} 秒后重发` : devCode ? '重新发送' : '获取验证码'}</button>
                </div>
              </label>
              {devCode && <div className="site-devcode"><Icon name="info" size={15} />测试验证码 <b className="num">{devCode}</b><button type="button" className="btn btn-text btn-sm" onClick={() => setCode(devCode)}>一键填入</button></div>}
              <label className="site-agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>我已阅读并同意《用户协议》《隐私政策》，了解 AI 助理不提供诊断与治疗</span>
              </label>
              {err && <p className="form-error" role="alert">{err}</p>}
              <button className="btn btn-blue btn-lg btn-block" type="submit" disabled={submitting}>{submitting ? <><span className="spinner site-spin-w" />登录中…</> : '登录'}</button>
              <p className="muted site-small site-center">演示账号：来访者 13800000001 · 验证码 123456</p>
            </form>
          )}
        </div>
        <Link className="site-login-back" to="/"><Icon name="left" size={14} />返回首页</Link>
      </div>
      {toast.node}
    </div>
  );
}
