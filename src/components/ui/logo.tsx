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
export function Logo({ className = "", size = "compact" }: { className?: string; size?: "compact" | "header" }) {
  const [first, ...rest] = BRAND.name.toUpperCase().split(" ");
  const split = rest.length > 1;
  const header = size === "header";
  return (
    <span className={`inline-flex items-center text-ink ${header ? "gap-2.5 sm:gap-3" : "gap-3"} ${className}`}>
      <LogoMark size={header ? 48 : 26} className={header ? "size-9 shrink-0 sm:size-12" : undefined} />
      <span className={header
        ? "whitespace-nowrap text-[0.8125rem] font-semibold leading-tight tracking-[0.14em] sm:text-[0.9375rem] sm:tracking-[0.18em]"
        : "text-[0.6875rem] font-medium leading-[1.35] tracking-[0.3em]"}>
        {split ? (
          <>
            <span className="block">
              {first} {rest.slice(0, -1).join(" ")}
            </span>
            <span className={header ? "block text-[0.85em] tracking-[0.27em]" : "block"}>{rest.at(-1)}</span>
          </>
        ) : (
          BRAND.name.toUpperCase()
        )}
      </span>
    </span>
  );
}
