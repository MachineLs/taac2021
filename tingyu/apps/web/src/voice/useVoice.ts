// Browser voice I/O for the 小屿 intake. Owned by the lead.
// - Speech recognition: Web Speech API (Chrome / Edge / Safari 14.1+), zh-CN, one utterance per start().
// - Speech synthesis: speechSynthesis with a Chinese voice when available.
// - level: 0..1 microphone loudness while listening (real, via Web Audio) or a gentle simulated value while speaking.
// Where recognition is unsupported, `supported.recognition` is false and the UI should offer text input.
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState = 'idle' | 'listening' | 'speaking';
interface Options { lang?: string; onFinal?: (text: string) => void; onError?: (message: string) => void }

type SR = any;
const getSR = (): (new () => SR) | null => (typeof window === 'undefined' ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null));

export function useVoice({ lang = 'zh-CN', onFinal, onError }: Options = {}) {
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const [level, setLevel] = useState(0);
  const recRef = useRef<SR | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const simRef = useRef<number | null>(null);
  const finalRef = useRef(onFinal); finalRef.current = onFinal;
  const errRef = useRef(onError); errRef.current = onError;

  const supported = {
    recognition: !!getSR(),
    synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };

  const stopMeter = useCallback(() => {
    const a = audioRef.current; audioRef.current = null;
    if (a) { cancelAnimationFrame(a.raf); a.stream.getTracks().forEach((t) => t.stop()); a.ctx.close().catch(() => {}); }
    if (simRef.current) { cancelAnimationFrame(simRef.current); simRef.current = null; }
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        if (audioRef.current) audioRef.current.raf = requestAnimationFrame(tick);
      };
      audioRef.current = { ctx, stream, raf: requestAnimationFrame(tick) };
    } catch { /* meter is optional */ }
  }, []);

  const simulate = useCallback(() => {
    const t0 = performance.now();
    const tick = () => {
      const k = (performance.now() - t0) / 1000;
      setLevel(0.35 + 0.3 * Math.abs(Math.sin(k * 7.3) * Math.sin(k * 2.1 + 1)) + 0.1 * Math.random());
      simRef.current = requestAnimationFrame(tick);
    };
    simRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  /** Start listening for one utterance. Call from a click. */
  const start = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) { errRef.current?.('当前浏览器不支持语音识别，请使用文字输入'); return; }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    stopMeter();
    const rec: SR = new Ctor();
    rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e: any) => {
      let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else inter += r[0].transcript;
      }
      setInterim(finalText + inter);
    };
    rec.onerror = (e: any) => {
      const map: Record<string, string> = { 'not-allowed': '没有麦克风权限，请在浏览器设置里允许使用麦克风', 'no-speech': '没有听到声音，请再试一次', network: '语音识别需要联网，请检查网络' };
      errRef.current?.(map[e.error] ?? '语音识别出错了，可以改用文字输入');
    };
    rec.onend = () => {
      recRef.current = null; stopMeter(); setState('idle'); setInterim('');
      const t = finalText.trim(); if (t) finalRef.current?.(t);
    };
    recRef.current = rec;
    setInterim(''); setState('listening');
    try { rec.start(); startMeter(); } catch { setState('idle'); }
  }, [lang, startMeter, stopMeter]);

  /** Speak text aloud; resolves when finished (or immediately if synthesis is unavailable). */
  const speak = useCallback((text: string) => new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    const synth = window.speechSynthesis; synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 1.02; u.pitch = 1.05;
    const voices = synth.getVoices();
    const v = voices.find((x) => /zh[-_]CN/i.test(x.lang) && /Xiaoxiao|Tingting|Ting-Ting|female|Google/i.test(x.name)) || voices.find((x) => /^zh/i.test(x.lang));
    if (v) u.voice = v;
    let done = false;
    const finish = () => { if (done) return; done = true; stopMeter(); setState('idle'); resolve(); };
    u.onend = finish; u.onerror = finish;
    setTimeout(finish, Math.max(3000, text.length * 320));    // safety net
    setState('speaking'); simulate();
    synth.speak(u);
  }), [lang, simulate, stopMeter]);

  const cancelSpeak = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); stopMeter(); setState('idle'); }, [stopMeter]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } if ('speechSynthesis' in window) window.speechSynthesis.cancel(); stopMeter(); }, [stopMeter]);

  return { state, interim, level, supported, start, stop, speak, cancelSpeak };
}
