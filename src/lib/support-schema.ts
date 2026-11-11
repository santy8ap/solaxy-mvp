import { z } from "zod";

export const SupportInput = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.union([z.email(), z.literal("")]))
    .transform((value) => value.toLowerCase()),
  whatsapp: z
    .string()
    .max(30)
    .transform((value) => value.replace(/[^0-9]/g, ""))
    .refine(
      (value) => !value || /^[1-9]\d{7,14}$/.test(value),
      "Escribe el número con código de país, por ejemplo 57 seguido del celular.",
    ),
});

export interface SupportSettings {
  email: string | null;
  whatsapp: string | null;
  updatedAt: number | null;
}
