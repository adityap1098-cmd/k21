/**
 * Teladan27Motor Logo — Gold laurel wreath with T27 MOTOR text
 * Used in Sidebar, Login, POS, and Invoice/Receipt
 */

interface LogoProps {
  size?: number
  className?: string
  variant?: 'dark' | 'light'  // dark = gold on dark bg, light = dark on white bg
}

export function T27Logo({ size = 48, className = '', variant = 'dark' }: LogoProps) {
  const gold = variant === 'dark' ? '#C5A44E' : '#8B7A3D'
  const text = variant === 'dark' ? '#E8D48B' : '#1a1a1a'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Teladan27 Motor logo"
    >
      {/* Laurel wreath — left */}
      <path d="M30 95C22 85 18 72 18 60C18 48 22 36 30 26" stroke={gold} strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="38" rx="5" ry="8" transform="rotate(-30 24 38)" fill={gold} opacity="0.7" />
      <ellipse cx="20" cy="50" rx="5" ry="8" transform="rotate(-15 20 50)" fill={gold} opacity="0.75" />
      <ellipse cx="19" cy="62" rx="5" ry="8" transform="rotate(0 19 62)" fill={gold} opacity="0.8" />
      <ellipse cx="20" cy="74" rx="5" ry="8" transform="rotate(15 20 74)" fill={gold} opacity="0.75" />
      <ellipse cx="24" cy="85" rx="5" ry="8" transform="rotate(30 24 85)" fill={gold} opacity="0.7" />

      {/* Laurel wreath — right */}
      <path d="M90 95C98 85 102 72 102 60C102 48 98 36 90 26" stroke={gold} strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="96" cy="38" rx="5" ry="8" transform="rotate(30 96 38)" fill={gold} opacity="0.7" />
      <ellipse cx="100" cy="50" rx="5" ry="8" transform="rotate(15 100 50)" fill={gold} opacity="0.75" />
      <ellipse cx="101" cy="62" rx="5" ry="8" transform="rotate(0 101 62)" fill={gold} opacity="0.8" />
      <ellipse cx="100" cy="74" rx="5" ry="8" transform="rotate(-15 100 74)" fill={gold} opacity="0.75" />
      <ellipse cx="96" cy="85" rx="5" ry="8" transform="rotate(-30 96 85)" fill={gold} opacity="0.7" />

      {/* Bottom cross of laurel */}
      <line x1="42" y1="100" x2="60" y2="106" stroke={gold} strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="100" x2="60" y2="106" stroke={gold} strokeWidth="2" strokeLinecap="round" />

      {/* T27 text */}
      <text x="60" y="58" textAnchor="middle" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="30" fill={text} letterSpacing="-1">
        T27
      </text>

      {/* MOTOR text */}
      <text x="60" y="78" textAnchor="middle" fontFamily="'Inter', sans-serif" fontWeight="700" fontSize="16" fill={gold} letterSpacing="4">
        MOTOR
      </text>
    </svg>
  )
}

/** Compact inline logo for sidebar / small spaces */
export function T27LogoCompact({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-lg bg-[#1a1a1a] ${className}`} style={{ width: size, height: size }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 60 60" fill="none">
        <text x="30" y="30" textAnchor="middle" dominantBaseline="central" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="18" fill="#E8D48B" letterSpacing="-0.5">
          T27
        </text>
        <text x="30" y="46" textAnchor="middle" fontFamily="'Inter', sans-serif" fontWeight="700" fontSize="7" fill="#C5A44E" letterSpacing="2">
          MOTOR
        </text>
      </svg>
    </div>
  )
}
