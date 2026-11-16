// Line icons for the mobile app (stroke = currentColor). Paths follow design3/app-home.html.
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6',
  people: 'C9 8 3.5|M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5|M16 4.5a3.5 3.5 0 0 1 0 7|M18 14.8c1.8.8 3 2.5 3.5 5.2',
  mic: 'R9 3 6 11 3|M5 11a7 7 0 0 0 14 0|M12 18v3',
  chat: 'M4 5h16v11H9l-5 4V5Z|M8 9.5h8|M8 12.5h5',
  bubble: 'M4 5h16v11H9l-5 4V5Z',
  user: 'C12 8 4|M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z|M10 20.5a2 2 0 0 0 4 0',
  search: 'C11 11 7|m20 20-4-4',
  down: 'm6 9 6 6 6-6',
  back: 'm15 5-7 7 7 7',
  right: 'm9 5 7 7-7 7',
  close: 'M6 6l12 12|M18 6 6 18',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  doc: 'M6 3h8.5L19 7.5V21H6V3Z|M9 12.5h7|M9 16h5',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z',
  family: 'C9 8 3.5|C17 10 2.5|M3 20c1-3.5 3.3-5.5 6-5.5s5 2 6 5.5|M15 15.5c2.4 0 4.3 1.5 5 4.5',
  briefcase: 'R3.5 7 17 12.5 2|M9 7V5h6v2|M3.5 12h17',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z',
  star: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.5 8 12 3Z',
  store: 'M4 21V9l8-6 8 6v12|M9 21v-6h6v6',
  grid: 'R4 4 7 7 1.5|R13 4 7 7 1.5|R4 13 7 7 1.5|R13 13 7 7 1.5',
  shield: 'M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z|m9 12 2 2 4-4',
  clock: 'C12 12 8.5|M12 7.5V12l3 2',
  wave: 'M3 12h2|M7 8v8|M11 5v14|M15 8v8|M19 11v2',
  cloud: 'M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5H7Z',
  sprout: 'M12 21v-8|M12 13c0-4 3-6 7-6 0 4-3 6-7 6Z|M12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z',
  filter: 'M4 6h16|M7 12h10|M10 18h4',
  sort: 'M7 4v16|m3 8 4-4 4 4|M17 20V4|m21 16-4 4-4-4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  checkCircle: 'C12 12 9|m8 12.5 3 3 5-6',
  calendar: 'R3.5 5 17 15.5 2|M3.5 10h17|M8 3v4|M16 3v4',
  video: 'R3 6.5 13 11 2|m16 10.5 5-3v9l-5-3',
  ticket: 'M3.5 7.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2.5a2 2 0 0 0 0 4v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4V7.5Z|M14 7v10',
  wallet: 'R3 6 18 13 2.5|M16 12.5h2|M3 9.5h18',
  smile: 'C12 12 9|M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8|M9 9.5h.01|M15 9.5h.01',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3|M10 16l-4-4 4-4|M6 12h10',
  lock: 'R5 10.5 14 10 2|M8 10.5V8a4 4 0 0 1 8 0v2.5',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  keyboard: 'R3 6 18 12 2|M7 10h.01|M11 10h.01|M15 10h.01|M8 14h8',
  speaker: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z|M15.5 9a4 4 0 0 1 0 6|M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z|m16 9.5 5 5|m21 9.5-5 5',
  send: 'M4 12 20 4l-6 16-3-7-7-1Z',
  camera: 'R3 6.5 13 11 2|m16 10.5 5-3v9l-5-3',
  cameraOff: 'R3 6.5 13 11 2|m16 10.5 5-3v9l-5-3|M3 3l18 18',
  micOff: 'R9 3 6 11 3|M5 11a7 7 0 0 0 14 0|M12 18v3|M3 3l18 18',
  hangup: 'M3.5 14.5c4.8-4.6 12.2-4.6 17 0l-2 2.5-3.2-1.2-.4-2.6a10 10 0 0 0-5.8 0l-.4 2.6L5.5 17l-2-2.5Z',
  flip: 'M4 12a8 8 0 0 1 14-5.3|M18 3v4h-4|M20 12a8 8 0 0 1-14 5.3|M6 21v-4h4',
  pin: 'M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z|C12 10 2.2',
  award: 'C12 9 5.5|m8.5 13.5-1.5 7.5 5-2.5 5 2.5-1.5-7.5',
  info: 'C12 12 9|M12 11v5|M12 8h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z|M13.5 6.5l4 4',
  sparkle: 'M12 3v4|M12 17v4|M3 12h4|M17 12h4|m6 6 2.5 2.5|m15.5 15.5 2.5 2.5|m18 6-2.5 2.5|m8.5 15.5-2.5 2.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7|M20 4v7h-7',
  gift: 'R4 9 16 4 1|M5 13v8h14v-8|M12 9v12|M12 9c-2-4-6-3.5-6-1.5S9 9 12 9Zm0 0c2-4 6-3.5 6-1.5S15 9 12 9Z',
  share: 'C6 12 2.5|C18 6 2.5|C18 18 2.5|m8.2 10.8 7.6-3.6|m8.2 13.2 7.6 3.6',
  plus: 'M12 5v14|M5 12h14',
  life: 'C12 12 9|C12 12 3.5|m5.6 5.6 3.9 3.9|m14.5 14.5 3.9 3.9|m18.4 5.6-3.9 3.9|m9.5 14.5-3.9 3.9',
};

function parts(spec: string) {
  return spec.split('|').map((s, i) => {
    if (s.startsWith('C')) { const [cx, cy, r] = s.slice(1).split(' ').map(Number); return <circle key={i} cx={cx} cy={cy} r={r} />; }
    if (s.startsWith('R')) { const [x, y, w, h, rx] = s.slice(1).split(' ').map(Number); return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />; }
    return <path key={i} d={s} />;
  });
}

export type IconName = keyof typeof P;
export function Icon({ name, size = 20, className, style, fill }: { name: IconName; size?: number; className?: string; style?: CSSProperties; fill?: boolean }) {
  return (
    <svg className={`m-i${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" width={size} height={size} style={style} aria-hidden="true"
      fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {parts(P[name])}
    </svg>
  );
}
