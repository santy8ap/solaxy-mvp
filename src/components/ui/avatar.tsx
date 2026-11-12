"use client";
import Image from "next/image";
import { useState } from "react";

/** Iniciales de un nombre: «Laura Gómez» → «LG». */
export function initialsOf(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0][0], words[words.length - 1][0]] : words[0] ? [words[0][0]] : [];
  return letters.join("").toUpperCase() || "?";
}

/**
 * La foto de la cuenta (la de Google) o, si no hay o no carga, las iniciales del nombre.
 * Es decorativa: el nombre siempre va escrito al lado o en la etiqueta del enlace.
 */
export function Avatar({ name, image, size = 28, className = "" }: { name: string; image?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size };
  if (image && !broken)
    return (
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        unoptimized
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full border border-line-strong object-cover ${className}`}
        style={box}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={`num inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-line/40 font-medium text-ink ${className}`}
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {initialsOf(name)}
    </span>
  );
}
