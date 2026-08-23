import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconSearch = (p: IconProps) => <svg {...svg} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconX = (p: IconProps) => <svg {...svg} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const IconChevron = (p: IconProps) => <svg {...svg} {...p}><path d="m6 9 6 6 6-6" /></svg>;
export const IconCheck = (p: IconProps) => <svg {...svg} {...p}><path d="m20 6-11 11-5-5" /></svg>;
export const IconClock = (p: IconProps) => <svg {...svg} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconPin = (p: IconProps) => <svg {...svg} {...p}><path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.8" /></svg>;
export const IconBookmark = (p: IconProps) => <svg {...svg} {...p}><path d="M6 4h12v17l-6-4.2L6 21V4Z" /></svg>;
export const IconPlus = (p: IconProps) => <svg {...svg} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconRoute = (p: IconProps) => <svg {...svg} {...p}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M15.5 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8.5" /></svg>;
export const IconShare = (p: IconProps) => <svg {...svg} {...p}><path d="M12 15V3m0 0L8 7m4-4 4 4" /><path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /></svg>;
export const IconSun = (p: IconProps) => <svg {...svg} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IconMoon = (p: IconProps) => <svg {...svg} {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>;
export const IconExternal = (p: IconProps) => <svg {...svg} {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
export const IconSparkle = (p: IconProps) => <svg {...svg} {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /></svg>;
export const IconTicket = (p: IconProps) => <svg {...svg} {...p}><path d="M4 9V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a3 3 0 0 0 0 6v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a3 3 0 0 0 0-6Z" /></svg>;
export const IconCopy = (p: IconProps) => <svg {...svg} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></svg>;
