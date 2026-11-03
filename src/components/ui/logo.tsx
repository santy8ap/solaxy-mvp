import { BRAND } from "@/config/brand";

/** Marca: una celda fotovoltaica (cuadrado de esquinas recortadas) con una órbita. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="slx-cell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22346a" />
          <stop offset="1" stopColor="#101c3e" />
        </linearGradient>
        <radialGradient id="slx-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="0.6" stopColor="#f6b73c" />
          <stop offset="1" stopColor="#e39b22" />
        </radialGradient>
      </defs>
      <path d="M8 3h16l5 5v16l-5 5H8l-5-5V8z" fill="url(#slx-cell)" stroke="#34488a" strokeWidth="1" />
      <path d="M11 3v26M16 3v26M21 3v26" stroke="#b7c1da" strokeOpacity="0.18" strokeWidth="0.8" />
      <ellipse cx="16" cy="16" rx="12.5" ry="5" fill="none" stroke="#a68bff" strokeWidth="1.3" transform="rotate(-24 16 16)" />
      <circle cx="16" cy="16" r="4.6" fill="url(#slx-sun)" />
      <circle cx="26.2" cy="11.6" r="1.6" fill="#e6ebf5" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="text-[1.35rem] font-bold tracking-[-0.03em]" style={{ fontStretch: "118%" }}>
        {BRAND.name.toLowerCase()}
      </span>
    </span>
  );
}
