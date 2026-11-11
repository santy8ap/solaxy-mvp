import { z } from "zod";

/** Caracteres de control, de dirección del texto y de ancho cero: no se ven, pero cambian lo que se lee. */
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;

/** Limpia un texto escrito por una persona: sin caracteres invisibles, tildes normalizadas, espacios simples. */
export function cleanText(value: string, max = 500) {
  return value.normalize("NFC").replace(INVISIBLE, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Campo de texto libre del servidor (motivos, referencias, nombres): se limpia y no admite < ni >.
 * React ya escapa todo lo que muestra; esto evita guardar marcas HTML que otro sistema (un PDF,
 * una hoja de cálculo, un correo) pudiera interpretar.
 */
export function safeText(max: number, { min = 0, label = "El texto" }: { min?: number; label?: string } = {}) {
  return z
    .string()
    .max(max * 4)
    .transform((v) => cleanText(v, max))
    .refine((v) => v.length >= min, `${label} es muy corto.`)
    .refine((v) => !/[<>]/.test(v), `${label} no puede tener los signos < ni >.`);
}
