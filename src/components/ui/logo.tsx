import { BRAND } from "@/config/brand";

/** El disco del eclipse también aparece en el reloj solar. */
export function LogoMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.22" />
      <circle cx="16" cy="16" r="9.5" fill="var(--color-disc)" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Marca con el nombre en dos líneas: cabe en la barra lateral y en el celular. */
export function Logo({ className = "" }: { className?: string }) {
  const [first, ...rest] = BRAND.name.toUpperCase().split(" ");
  const split = rest.length > 1;
  return (
    <span className={`inline-flex items-center gap-3 text-ink ${className}`}>
      <LogoMark />
      <span className="text-[0.6875rem] font-medium leading-[1.35] tracking-[0.3em]">
        {split ? (
          <>
            <span className="block">
              {first} {rest.slice(0, -1).join(" ")}
            </span>
            <span className="block">{rest.at(-1)}</span>
          </>
        ) : (
          BRAND.name.toUpperCase()
        )}
      </span>
    </span>
  );
}
