import React from 'react';

interface PrototypeTesterIconProps {
  size?: number;
  color?: string;
  animated?: boolean;
}

/**
 * Custom Prototype Tester Icon - Animated Computer with Code
 * 
 * Features:
 * - Code brackets `< >` on both sides (pulsing)
 * - Computer monitor in the center
 * - Animated code lines being "typed"
 * - Blinking cursor
 * - Beta indicator badge
 * 
 * Usage:
 * - LoginModal: Prototype Tester login option
 * - PrototypeFeedbackTool: Floating button badge
 * - PrototypeFeedbackPanel: Admin panel header
 */
export const PrototypeTesterIcon: React.FC<PrototypeTesterIconProps> = ({ 
  size = 28, 
  color = 'currentColor',
  animated = true 
}) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ color }}
  >
    {animated && (
      <style>
        {`
          @keyframes typeCode1 {
            0%, 100% { width: 0; }
            20%, 80% { width: 6px; }
          }
          @keyframes typeCode2 {
            0%, 30%, 100% { width: 0; }
            50%, 80% { width: 5px; }
          }
          @keyframes typeCode3 {
            0%, 50%, 100% { width: 0; }
            70%, 90% { width: 4px; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .proto-code-line-1 { animation: typeCode1 2s ease-in-out infinite; }
          .proto-code-line-2 { animation: typeCode2 2s ease-in-out infinite 0.3s; }
          .proto-code-line-3 { animation: typeCode3 2s ease-in-out infinite 0.6s; }
          .proto-cursor { animation: blink 0.8s step-end infinite; }
          .proto-bracket { animation: pulse 2s ease-in-out infinite; }
        `}
      </style>
    )}
    
    {/* Left code bracket < */}
    <path
      className={animated ? "proto-bracket" : undefined}
      d="M6 8L2 16L6 24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={animated ? undefined : 0.8}
    />
    
    {/* Right code bracket > */}
    <path
      className={animated ? "proto-bracket" : undefined}
      d="M26 8L30 16L26 24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={animated ? undefined : 0.8}
    />
    
    {/* Computer Monitor */}
    <rect
      x="9"
      y="7"
      width="14"
      height="11"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
    
    {/* Screen inner area */}
    <rect
      x="10.5"
      y="8.5"
      width="11"
      height="8"
      rx="0.5"
      fill="currentColor"
      opacity="0.15"
    />
    
    {/* Monitor Stand */}
    <path
      d="M14 18V21H18V18"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* Monitor Base */}
    <path
      d="M12 21H20"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    
    {/* Animated Code Lines */}
    {animated ? (
      <>
        <rect className="proto-code-line-1" x="11.5" y="10" height="1.2" rx="0.5" fill="currentColor" />
        <rect className="proto-code-line-2" x="11.5" y="12.5" height="1.2" rx="0.5" fill="currentColor" />
        <rect className="proto-code-line-3" x="11.5" y="15" height="1.2" rx="0.5" fill="currentColor" opacity="0.8" />
        {/* Blinking Cursor */}
        <rect className="proto-cursor" x="12" y="15" width="0.8" height="1.2" fill="currentColor" />
      </>
    ) : (
      <>
        <rect x="11.5" y="10" width="5" height="1.2" rx="0.5" fill="currentColor" />
        <rect x="11.5" y="12.5" width="4" height="1.2" rx="0.5" fill="currentColor" />
        <rect x="11.5" y="15" width="3" height="1.2" rx="0.5" fill="currentColor" opacity="0.8" />
      </>
    )}
    
    {/* Beta indicator dot */}
    <circle cx="27" cy="5" r="3" fill="currentColor" />
    <text x="27" y="6.5" textAnchor="middle" fontSize="4" fill="#8b5cf6" fontWeight="bold">β</text>
  </svg>
);

export default PrototypeTesterIcon;

