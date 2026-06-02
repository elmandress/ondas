/**
 * CUÁNDO — Set de iconos (stroke 1.5px, estilo Lucide).
 * Portado del brand book. Cada icono acepta `size` y `sw` (stroke width).
 */

interface IconProps {
  size?: number;
  sw?: number;
  filled?: boolean;
  className?: string;
}

function Svg({
  children,
  size = 22,
  sw = 1.5,
  className,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  Home: (p: IconProps) => <Svg {...p}><path d="M3 11 L12 4 L21 11" /><path d="M5 9.5 V20 H19 V9.5" /><path d="M10 20 V14 H14 V20" /></Svg>,
  Map: (p: IconProps) => <Svg {...p}><path d="M9 4 L3 6.5 V20 L9 17.5 L15 20 L21 17.5 V4 L15 6.5 Z" /><path d="M9 4 V17.5" /><path d="M15 6.5 V20" /></Svg>,
  Route: (p: IconProps) => <Svg {...p}><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M6 8.5 V12.5 a3 3 0 0 0 3 3 H15.5" /></Svg>,
  Search: (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16 L20.5 20.5" /></Svg>,
  Bus: (p: IconProps) => <Svg {...p}><rect x="4" y="5" width="16" height="12.5" rx="2.5" /><path d="M4 12 H20" /><circle cx="8" cy="20" r="1.4" /><circle cx="16" cy="20" r="1.4" /><path d="M7.5 9 H9.5" /><path d="M14.5 9 H16.5" /></Svg>,
  Walk: (p: IconProps) => <Svg {...p}><circle cx="13" cy="4.3" r="1.6" /><path d="M9 21 L11.5 14 L9 11 L11 7 L14 11 L16.5 12.5" /><path d="M11.5 14 L14.5 21" /></Svg>,
  Pin: (p: IconProps) => <Svg {...p}><path d="M12 21 C 8 16 5 13 5 10 a7 7 0 0 1 14 0 c0 3 -3 6 -7 11 Z" /><circle cx="12" cy="10" r="2.4" /></Svg>,
  Star: (p: IconProps) => <Svg {...p}><path d="M12 3.5 L14.4 8.9 L20.3 9.4 L15.8 13.3 L17.2 19.1 L12 16 L6.8 19.1 L8.2 13.3 L3.7 9.4 L9.6 8.9 Z" fill={p.filled ? "currentColor" : "none"} /></Svg>,
  Refresh: (p: IconProps) => <Svg {...p}><path d="M21 12 a9 9 0 1 1 -2.6 -6.4" /><path d="M21 4 V9 H16" /></Svg>,
  Close: (p: IconProps) => <Svg {...p}><path d="M6 6 L18 18" /><path d="M18 6 L6 18" /></Svg>,
  Mic: (p: IconProps) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11 a7 7 0 0 0 14 0" /><path d="M12 18 V21" /></Svg>,
  Chevron: (p: IconProps) => <Svg {...p}><path d="M9 6 L15 12 L9 18" /></Svg>,
  Swap: (p: IconProps) => <Svg {...p}><path d="M7 4 V20" /><path d="M3.5 7.5 L7 4 L10.5 7.5" /><path d="M17 20 V4" /><path d="M13.5 16.5 L17 20 L20.5 16.5" /></Svg>,
  Crosshair: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="7" /><path d="M12 2 V5" /><path d="M12 19 V22" /><path d="M2 12 H5" /><path d="M19 12 H22" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></Svg>,
  Plus: (p: IconProps) => <Svg {...p}><path d="M12 5 V19" /><path d="M5 12 H19" /></Svg>,
  Minus: (p: IconProps) => <Svg {...p}><path d="M5 12 H19" /></Svg>,
  Clock: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.2" /><path d="M12 7.5 V12 L15 13.8" /></Svg>,
  Help: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.3 9.2 a2.7 2.7 0 1 1 3.7 2.5 c-0.9 0.4-1.2 1-1.2 1.8" /><circle cx="12" cy="16.6" r="0.6" fill="currentColor" stroke="none" /></Svg>,
  Wheelchair: (p: IconProps) => <Svg {...p}><circle cx="13" cy="4.6" r="1.5" /><path d="M13 7 V12 H17.5" /><path d="M12 12 L14 17 H18.5" /><circle cx="11" cy="16.5" r="4.2" /></Svg>,
  Snow: (p: IconProps) => <Svg {...p}><path d="M12 3 V21" /><path d="M4.5 7.5 L19.5 16.5" /><path d="M4.5 16.5 L19.5 7.5" /><path d="M9 4.6 L12 6.4 L15 4.6" /><path d="M9 19.4 L12 17.6 L15 19.4" /></Svg>,
  // Aparato de aire acondicionado (split): cuerpo + rejilla + flujo de aire.
  Ac: (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="8" rx="2" /><path d="M3 10 H21" /><path d="M7 16.5 c0 -1.4 1.4 -1.4 1.4 -2.8" /><path d="M12 17 c0 -1.4 1.4 -1.4 1.4 -2.8" /><path d="M17 16.5 c0 -1.4 1.4 -1.4 1.4 -2.8" /></Svg>,
  Wifi: (p: IconProps) => <Svg {...p}><path d="M5 12.5 a10 10 0 0 1 14 0" /><path d="M8 15.5 a6 6 0 0 1 8 0" /><circle cx="12" cy="19" r="0.8" fill="currentColor" stroke="none" /></Svg>,
  Settings: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>,
  Warn: (p: IconProps) => <Svg {...p}><path d="M12 4 L21 19 H3 Z" /><path d="M12 10 V14" /><circle cx="12" cy="16.6" r="0.6" fill="currentColor" stroke="none" /></Svg>,
  Download: (p: IconProps) => <Svg {...p}><path d="M12 4 V15" /><path d="M8 11 L12 15 L16 11" /><path d="M5 19 H19" /></Svg>,
  Heart: (p: IconProps) => <Svg {...p}><path d="M12 20 C 6 15.5 4 12.5 4 9.5 a4 4 0 0 1 8 -1 a4 4 0 0 1 8 1 c0 3 -2 6 -8 10.5 Z" fill={p.filled ? "currentColor" : "none"} /></Svg>,
};

export type IconName = keyof typeof Icons;
