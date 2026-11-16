// /m/login — phone + SMS code login, ?next= redirect.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthContext';
import { peekRefCode } from '../../../lib/ref';
import { Icon } from '../icons';
import { errMsg, intakeStore, invalidateUnread, NavBar, Spin } from '../ui';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/m/me');

export default function Login() {
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const nav = useNavigate();
  const { user, ready, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cd, setCd] = useState(0);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { if (cd <= 0) return; const t = window.setTimeout(() => setCd(cd - 1), 1000); return () => window.clearTimeout(t); }, [cd]);

  if (ready && user && !done) return <Navigate to={next} replace />;
  const validPhone = /^1\d{10}$/.test(phone);
  const ref = peekRefCode();

  const send = async () => {
    if (!validPhone) { setErr('请输入正确的 11 位手机号'); return; }
    setSending(true); setErr(null);
    try { const r = await api.sendCode({ phone }); setDevCode(r.devCode ?? null); setCd(60); }
    catch (e) { setErr(errMsg(e, '验证码发送失败')); }
    finally { setSending(false); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validPhone) { setErr('请输入正确的 11 位手机号'); return; }
    if (!/^\d{4,6}$/.test(code)) { setErr('请输入验证码'); return; }
    if (!agree) { setErr('请先阅读并同意用户协议和隐私政策'); return; }
    setBusy(true); setErr(null);
    try {
      await login(phone, code);
      setDone(true); invalidateUnread();
      const pending = intakeStore.get() ?? intakeStore.last();
      if (pending) await api.intakeClaim(pending).catch(() => { /* already bound or not anonymous */ });
      nav(next, { replace: true });
    } catch (e2) { setErr(errMsg(e2, '登录失败，请重试')); setBusy(false); }
  };

  return (
    <div className="m-login">
      <NavBar title="" />
      <div className="m-login-in">
        <span className="m-logo m-login-logo"><i>屿</i>听屿心理</span>
        <h1>手机号登录</h1>
        <p>未注册的手机号验证后自动创建账号{ref ? '，并领取新人首单立减 100 元' : ''}</p>
        <form onSubmit={submit} noValidate>
          <label className="m-login-f">
            <span className="num">+86</span>
            <input inputMode="numeric" autoComplete="tel" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="请输入手机号" aria-label="手机号" />
          </label>
          <label className="m-login-f">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="请输入验证码" aria-label="验证码" />
            <button type="button" className="m-login-code" disabled={cd > 0 || sending || !validPhone} onClick={send}>{sending ? <Spin /> : cd > 0 ? <span className="num">{cd}s 后重发</span> : devCode ? '重新获取' : '获取验证码'}</button>
          </label>
          {devCode && <div className="m-login-dev"><Icon name="info" size={14} />开发环境验证码：<b className="num">{devCode}</b><button type="button" onClick={() => setCode(devCode)}>一键填入</button></div>}
          {err && <div className="m-form-err" role="alert">{err}</div>}
          <button type="submit" className="btn btn-blue btn-lg btn-block btn-pill m-login-go" disabled={busy}>{busy && <Spin />}登录</button>
          <label className="m-login-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>我已阅读并同意《用户协议》《隐私政策》《知情同意书》</span>
          </label>
        </form>
        <ul className="m-login-trust">
          <li><Icon name="lock" size={16} />手机号仅用于登录，咨询全程隐私保护</li>
          <li><Icon name="shield" size={16} />咨询师 100% 持证 · 平台担保交易</li>
        </ul>
      </div>
    </div>
  );
}
