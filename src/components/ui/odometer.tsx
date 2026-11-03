"use client";
import { formatNumber } from "@/lib/format";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function Digit({ value }: { value: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-top" aria-hidden="true">
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateY(-${value * 10}%)` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Número con dígitos que ruedan (como un contador de energía). Cada dígito
 * conserva su identidad contando desde la derecha, así el cambio se lee claro.
 */
export function Odometer({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const text = formatNumber(value, decimals);
  const chars = text.split("");
  return (
    <span className={`num inline-flex items-baseline leading-none ${className}`}>
      <span className="sr-only">{`${prefix}${text}${suffix}`}</span>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <span className="inline-flex" aria-hidden="true">
        {chars.map((ch, i) => {
          const key = chars.length - i;
          return /\d/.test(ch) ? (
            <Digit key={`d${key}`} value={Number(ch)} />
          ) : (
            <span key={`s${key}`} className="inline-block h-[1em] leading-none">
              {ch}
            </span>
          );
        })}
      </span>
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}
