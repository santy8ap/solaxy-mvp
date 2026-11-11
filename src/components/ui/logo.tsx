import { BRAND } from "@/config/brand";

export function LogoMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M16 3a13 13 0 0 1 0 26c7-7 7-19 0-26Z" fill="currentColor" />
      <path d="M2 16h28" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`iwe-logo inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={32} />
      <span aria-label={BRAND.name}>
        IN WORLD<span className="block">ENERGY</span>
      </span>
    </span>
  );
}
