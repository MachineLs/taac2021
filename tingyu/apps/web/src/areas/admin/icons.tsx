// Inline stroke icons for the admin console (F4). 20×20, currentColor.
import type { ReactNode } from 'react';

const P = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconHome = () => <P><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></P>;
export const IconChart = () => <P><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="11" width="3" height="6" rx="1" /><rect x="12" y="7" width="3" height="10" rx="1" /><rect x="17" y="13" width="3" height="4" rx="1" /></P>;
export const IconShield = () => <P><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></P>;
export const IconReceipt = () => <P><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></P>;
export const IconAlert = () => <P><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.5" /></P>;
export const IconMegaphone = () => <P><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></P>;
export const IconUsers = () => <P><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></P>;
export const IconCoin = () => <P><circle cx="12" cy="12" r="9" /><path d="M9 8l3 4 3-4M12 12v6M9 13h6M9 16h6" /></P>;
export const IconCalendar = () => <P><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></P>;
export const IconMic = () => <P><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></P>;
export const IconMenu = () => <P size={20}><path d="M4 7h16M4 12h16M4 17h16" /></P>;
export const IconClose = () => <P size={20}><path d="M6 6l12 12M18 6 6 18" /></P>;
export const IconLogout = () => <P size={16}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></P>;
export const IconRefresh = () => <P size={16}><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></P>;
export const IconPhone = () => <P size={16}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></P>;
export const IconArrow = () => <P size={16}><path d="M5 12h14M13 6l6 6-6 6" /></P>;
export const IconStar = () => <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8Z" /></svg>;
