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
