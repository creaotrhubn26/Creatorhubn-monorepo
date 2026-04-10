import type { CSSProperties } from 'react';
import type { ProducerAccountAccessPlatform } from '../../models/casting';

interface AccountProviderLogoProps {
  platform: ProducerAccountAccessPlatform;
  size?: number;
}

const wrapperStyle = (size: number): CSSProperties => ({
  width: size,
  height: size,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: Math.round(size * 0.28),
  background: 'rgba(15,23,42,0.72)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  overflow: 'hidden',
});

const MetaLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="#0B1020" />
    <path
      d="M12 36.5c0-8.2 6.2-18 12.6-18 5.8 0 8.6 7.6 11.3 13.5 1.6 3.4 3 6.1 4.9 6.1 2.4 0 4.9-5 7.8-10.7C51.5 21.6 54.4 16 58 16c3 0 6 2.7 6 8.2 0 9.1-3.7 22.4-10 22.4-5.1 0-8.2-7.2-11-13.4-1.7-3.8-3.3-7.3-5.4-7.3-2.3 0-4.5 3.9-7.2 8.6C26.8 41.1 23 48 18 48c-4.6 0-6-5.3-6-11.5Z"
      fill="none"
      stroke="#0A7CFF"
      strokeWidth="4.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LinkedInLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="#0A66C2" />
    <circle cx="20" cy="22" r="4.5" fill="#FFFFFF" />
    <rect x="16" y="29" width="8" height="19" rx="2" fill="#FFFFFF" />
    <path d="M31 29h7v2.7c1.6-2 4.3-3.7 8.3-3.7 8.4 0 9.7 5.5 9.7 12.6V48h-8V41c0-3.4-.1-7.8-4.8-7.8-4.8 0-5.5 3.7-5.5 7.6V48h-7V29Z" fill="#FFFFFF" />
  </svg>
);

const YouTubeLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="#0B1020" />
    <rect x="10" y="18" width="44" height="28" rx="10" fill="#FF0033" />
    <path d="M29 25.5 42 32l-13 6.5v-13Z" fill="#FFFFFF" />
  </svg>
);

const TikTokLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="#08090F" />
    <path d="M38 18.5c1.4 3.9 4.1 6.1 8.4 6.6v6.2c-3.1-.1-5.8-1-8.4-2.8v11.8c0 8.6-5 13.2-12.2 13.2-6.3 0-11.6-4.5-11.6-11 0-6.9 5.3-11.4 11.7-11.4.7 0 1.4.1 2 .2v6c-.6-.2-1.1-.2-1.7-.2-3.3 0-5.8 2-5.8 5.1 0 3.2 2.2 5.4 5.3 5.4 3.6 0 5.7-2.4 5.7-6.3V12h6.6c.1 2.3.3 4.4 0 6.5Z" fill="#25F4EE" opacity="0.95" />
    <path d="M40 16.5c1.4 3.9 4.1 6.1 8.4 6.6v6.2c-3.1-.1-5.8-1-8.4-2.8v11.8c0 8.6-5 13.2-12.2 13.2-6.3 0-11.6-4.5-11.6-11 0-6.9 5.3-11.4 11.7-11.4.7 0 1.4.1 2 .2v6c-.6-.2-1.1-.2-1.7-.2-3.3 0-5.8 2-5.8 5.1 0 3.2 2.2 5.4 5.3 5.4 3.6 0 5.7-2.4 5.7-6.3V10h6.6c.1 2.3.3 4.4 0 6.5Z" fill="#FE2C55" opacity="0.88" />
    <path d="M39 17.5c1.4 3.9 4.1 6.1 8.4 6.6v6.2c-3.1-.1-5.8-1-8.4-2.8v11.8c0 8.6-5 13.2-12.2 13.2-6.3 0-11.6-4.5-11.6-11 0-6.9 5.3-11.4 11.7-11.4.7 0 1.4.1 2 .2v6c-.6-.2-1.1-.2-1.7-.2-3.3 0-5.8 2-5.8 5.1 0 3.2 2.2 5.4 5.3 5.4 3.6 0 5.7-2.4 5.7-6.3V11h6.6c.1 2.3.3 4.4 0 6.5Z" fill="#FFFFFF" />
  </svg>
);

const GoogleWorkspaceLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="#FFFFFF" />
    <path d="M52 32.7c0-1.4-.1-2.5-.4-3.7H32v7h11.2c-.5 3-2.2 5.6-4.7 7.3v5.8h7.6c4.4-4.1 6.9-10.1 6.9-16.4Z" fill="#4285F4" />
    <path d="M32 53c5.6 0 10.3-1.9 13.8-5.1l-7.6-5.8c-2.1 1.4-4.8 2.3-6.2 2.3-4.8 0-8.9-3.2-10.4-7.6h-7.9v6c3.5 6.9 10.6 10.2 18.3 10.2Z" fill="#34A853" />
    <path d="M21.6 36.8c-.4-1.3-.6-2.6-.6-4s.2-2.7.6-4v-6h-7.9C12.2 25.7 11 29.1 11 32.8s1.2 7.1 2.7 10l7.9-6Z" fill="#FBBC04" />
    <path d="M32 21.3c3 0 5.7 1 7.8 3.1l5.8-5.8c-3.5-3.2-8.2-5.1-13.6-5.1-7.7 0-14.8 4.3-18.3 11.2l7.9 6c1.5-4.4 5.6-7.4 10.4-7.4Z" fill="#EA4335" />
  </svg>
);

export default function AccountProviderLogo({ platform, size = 36 }: AccountProviderLogoProps) {
  const innerSize = Math.round(size * 0.88);

  return (
    <span style={wrapperStyle(size)}>
      {platform === 'meta' ? <MetaLogo size={innerSize} /> : null}
      {platform === 'linkedin' ? <LinkedInLogo size={innerSize} /> : null}
      {platform === 'youtube' ? <YouTubeLogo size={innerSize} /> : null}
      {platform === 'tiktok' ? <TikTokLogo size={innerSize} /> : null}
      {platform === 'google' ? <GoogleWorkspaceLogo size={innerSize} /> : null}
    </span>
  );
}
