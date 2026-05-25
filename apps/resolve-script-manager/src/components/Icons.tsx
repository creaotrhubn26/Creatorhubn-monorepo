import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Svg({ size = 14, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-2px", ...(rest.style ?? {}) }}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx={12} cy={12} r={3} />
  </Svg>
);

export const IconBox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8L12 3 3 8v8l9 5 9-5V8z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
  </Svg>
);

export const IconGear = (p: IconProps) => (
  <Svg {...p}>
    <circle cx={12} cy={12} r={3} />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.69.43.93.78A1.65 1.65 0 0 0 21 10h.09a2 2 0 0 1 0 4H21a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const IconClapper = (p: IconProps) => (
  <Svg {...p}>
    <rect x={3} y={9} width={18} height={12} rx={1} />
    <path d="M3 9l3-5 4 5M9 9l3-5 4 5M15 9l3-5 3 5" />
  </Svg>
);

export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
    <path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17z" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <line x1={18} y1={6} x2={6} y2={18} />
    <line x1={6} y1={6} x2={18} y2={18} />
  </Svg>
);

export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1={12} y1={9} x2={12} y2={13} />
    <line x1={12} y1={17} x2={12.01} y2={17} />
  </Svg>
);

export const IconMusic = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx={6} cy={18} r={3} />
    <circle cx={18} cy={16} r={3} />
  </Svg>
);

export const IconStar = (p: IconProps) => (
  <Svg {...p} fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
);

export const IconPlay = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <polygon points="6 3 21 12 6 21 6 3" />
  </Svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <line x1={5} y1={12} x2={19} y2={12} />
    <polyline points="12 5 19 12 12 19" />
  </Svg>
);

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <line x1={19} y1={12} x2={5} y2={12} />
    <polyline points="12 19 5 12 12 5" />
  </Svg>
);

// ─── Template-specific icons (Role Room "Magic Cut") ────────────────────

export const IconCamera = (p: IconProps) => (
  <Svg {...p}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx={12} cy={13} r={4} />
  </Svg>
);

export const IconFilmReel = (p: IconProps) => (
  <Svg {...p}>
    <rect x={2} y={2} width={20} height={20} rx={2.5} />
    <line x1={7} y1={2} x2={7} y2={22} />
    <line x1={17} y1={2} x2={17} y2={22} />
    <line x1={2} y1={12} x2={7} y2={12} />
    <line x1={17} y1={12} x2={22} y2={12} />
    <line x1={2} y1={7} x2={7} y2={7} />
    <line x1={2} y1={17} x2={7} y2={17} />
    <line x1={17} y1={7} x2={22} y2={7} />
    <line x1={17} y1={17} x2={22} y2={17} />
  </Svg>
);

export const IconMicrophone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1={12} y1={19} x2={12} y2={23} />
    <line x1={8} y1={23} x2={16} y2={23} />
  </Svg>
);

export const IconBookOpen = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Svg>
);

export const IconWaveform = (p: IconProps) => (
  <Svg {...p}>
    <line x1={3} y1={12} x2={3} y2={12} strokeWidth={2.5} />
    <line x1={6} y1={9} x2={6} y2={15} strokeWidth={2.5} />
    <line x1={9} y1={5} x2={9} y2={19} strokeWidth={2.5} />
    <line x1={12} y1={2} x2={12} y2={22} strokeWidth={2.5} />
    <line x1={15} y1={5} x2={15} y2={19} strokeWidth={2.5} />
    <line x1={18} y1={9} x2={18} y2={15} strokeWidth={2.5} />
    <line x1={21} y1={12} x2={21} y2={12} strokeWidth={2.5} />
  </Svg>
);

export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <rect x={5} y={2} width={14} height={20} rx={2.5} />
    <line x1={12} y1={18} x2={12.01} y2={18} />
  </Svg>
);

export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

/**
 * Magic Cut signature mark — film strip cut diagonally with a play triangle.
 * Filled solid (uses fill="currentColor") so it reads as a brand-mark, not an
 * outline-icon. Tinted to the Role Room magenta wherever rendered.
 *
 * Designed for sizes 16–48 px. At 16px the perforation dots disappear visually
 * but the silhouette remains recognizable.
 */
export const IconMagicCut = ({ size = 14, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "-2px", ...(rest.style ?? {}) }}
    {...rest}
  >
    {/* Left film strip half with play triangle cut-out */}
    <path d="M4 5h8.2l-3.5 14H4a1.2 1.2 0 0 1-1.2-1.2V6.2A1.2 1.2 0 0 1 4 5z" />
    {/* Right film strip half, offset to suggest the cut */}
    <path d="M20 6.5h-5l-3.5 14H20a1.2 1.2 0 0 0 1.2-1.2V7.7A1.2 1.2 0 0 0 20 6.5z" />
    {/* Diagonal slash cutting through the middle (magenta-glow accent) */}
    <path
      d="M14.8 3.2 L9.2 21.5"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      fill="none"
      opacity={0.85}
    />
    {/* Play triangle overlay (mid-strip) */}
    <path d="M8.5 8.5 L8.5 15.5 L13.5 12 z" fill="rgba(255,255,255,0.92)" />
    {/* Sprocket holes — left edge */}
    <rect x={3.5} y={7} width={1.8} height={1.8} fill="rgba(255,255,255,0.85)" rx={0.3} />
    <rect x={3.5} y={11} width={1.8} height={1.8} fill="rgba(255,255,255,0.85)" rx={0.3} />
    <rect x={3.5} y={15} width={1.8} height={1.8} fill="rgba(255,255,255,0.85)" rx={0.3} />
    {/* Sprocket holes — right edge */}
    <rect x={18.7} y={8.5} width={1.8} height={1.8} fill="rgba(255,255,255,0.85)" rx={0.3} />
    <rect x={18.7} y={12.5} width={1.8} height={1.8} fill="rgba(255,255,255,0.85)" rx={0.3} />
    <rect x={18.7} y={16.5} width={1.8} height={1.8} fill="rgba(255,255,255,0.85)" rx={0.3} />
  </svg>
);
