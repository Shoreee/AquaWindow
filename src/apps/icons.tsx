import type { ReactNode } from 'react';

const G: Record<string, [string, string]> = {
  finder: ['#6fd3ff', '#2f7bff'],
  preview: ['#ffffff', '#d7e1ee'],
  writer: ['#ffb14a', '#ff6a3d'],
  browser: ['#7ee2ff', '#3a6bff'],
  chat: ['#7cf29a', '#1fb85a'],
  meeting: ['#6f8cff', '#4127d9'],
  share: ['#8fa7ff', '#5a3cf0'],
  tile: ['#b59cff', '#6b45e6'],
  tutorial: ['#ff7a7a', '#e0245e'],
  sculpt: ['#ff9de6', '#8a4dff'],
  canvas: ['#ffe07a', '#ff8a3d'],
  refimage: ['#a8f0d8', '#2bb3a0'],
  terminal: ['#3a3f4b', '#111318'],
  code: ['#4ad3ff', '#1256c9'],
  lab: ['#d6f36b', '#2fb86e'],
  guide: ['#9ef1ff', '#6b5cff'],
  notes: ['#fff2a6', '#ffd23f'],
};

const GLYPH: Record<string, ReactNode> = {
  finder: (
    <>
      <path d="M10 8h13v26H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff" opacity=".95" />
      <path d="M23 8h7a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4h-7z" fill="#0b4fd6" opacity=".55" />
      <circle cx="14" cy="17" r="1.6" fill="#1a3a6b" />
      <circle cx="27" cy="17" r="1.6" fill="#fff" />
      <path d="M12 25c5 4 12 4 17 0" stroke="#1a3a6b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  ),
  preview: (
    <>
      <rect x="10" y="7" width="20" height="26" rx="2.5" fill="#fff" stroke="#9fb0c8" />
      <rect x="13" y="12" width="14" height="8" rx="1" fill="#6aa7ff" />
      <rect x="13" y="23" width="14" height="1.6" fill="#b8c4d6" />
      <rect x="13" y="26.5" width="10" height="1.6" fill="#b8c4d6" />
    </>
  ),
  writer: <path d="M12 29l2-7 12-12 5 5-12 12zM24 12l5 5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinejoin="round" />,
  browser: (
    <>
      <circle cx="20" cy="20" r="12" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M8 20h24M20 8c-6 7-6 17 0 24M20 8c6 7 6 17 0 24" stroke="#fff" strokeWidth="1.8" fill="none" />
    </>
  ),
  chat: <path d="M9 12a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-9l-6 5v-5a3 3 0 0 1-3-3z" fill="#fff" />,
  meeting: (
    <>
      <rect x="7" y="12" width="18" height="16" rx="4" fill="#fff" />
      <path d="M26 17l7-4v14l-7-4z" fill="#fff" />
    </>
  ),
  share: (
    <>
      <rect x="7" y="9" width="26" height="18" rx="3" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M20 23v-9M16 18l4-4 4 4" stroke="#fff" strokeWidth="2.2" fill="none" />
      <path d="M14 31h12" stroke="#fff" strokeWidth="2.2" />
    </>
  ),
  tile: (
    <>
      <circle cx="20" cy="16" r="6" fill="#fff" />
      <path d="M9 32c1-7 6-9 11-9s10 2 11 9" fill="#fff" />
    </>
  ),
  tutorial: <path d="M15 11l14 9-14 9z" fill="#fff" />,
  sculpt: (
    <>
      <rect x="9" y="9" width="22" height="22" rx="8" fill="none" stroke="#fff" strokeWidth="2.4" />
      <circle cx="9" cy="9" r="2.6" fill="#fff" />
      <circle cx="31" cy="31" r="2.6" fill="#fff" />
    </>
  ),
  canvas: <path d="M10 30c4-1 5-6 9-6s3 4 7 3 5-10 5-15" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" />,
  refimage: (
    <>
      <rect x="8" y="10" width="24" height="20" rx="3" fill="#fff" opacity=".9" />
      <path d="M10 27l7-8 5 5 3-3 5 6z" fill="#2bb3a0" />
      <circle cx="26" cy="15" r="2.5" fill="#ffb14a" />
    </>
  ),
  terminal: <path d="M11 14l6 6-6 6M20 27h9" stroke="#7CFFB2" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
  code: <path d="M15 13l-7 7 7 7M25 13l7 7-7 7M22 10l-4 20" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
  lab: (
    <>
      <rect x="8" y="22" width="6" height="9" rx="1.5" fill="#fff" />
      <rect x="17" y="15" width="6" height="16" rx="1.5" fill="#fff" />
      <rect x="26" y="9" width="6" height="22" rx="1.5" fill="#fff" />
    </>
  ),
  guide: <path d="M20 7C27 15 31 20 31 25a11 11 0 0 1-22 0c0-5 4-10 11-18z" fill="#fff" opacity=".95" />,
  notes: (
    <>
      <rect x="10" y="8" width="20" height="24" rx="3" fill="#fff" />
      <path d="M14 15h12M14 20h12M14 25h8" stroke="#d9a400" strokeWidth="1.8" />
    </>
  ),
};

export function AppIcon({ appId, size = 48 }: { appId: string; size?: number }) {
  const [a, b] = G[appId] ?? ['#ccc', '#888'];
  const gid = `ig-${appId}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="aw-appicon">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d="M20 1.5C33 1.5 38.5 7 38.5 20S33 38.5 20 38.5 1.5 33 1.5 20 7 1.5 20 1.5z" fill={`url(#${gid})`} />
      <path d="M20 1.5C33 1.5 38.5 7 38.5 20H1.5C1.5 7 7 1.5 20 1.5z" fill="#fff" opacity=".12" />
      {GLYPH[appId]}
    </svg>
  );
}
