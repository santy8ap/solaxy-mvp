import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handleError } from "./api";
import { MarketError } from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errores de la API", () => {
  it("los errores conocidos llegan tal cual a la interfaz, con su estado", async () => {
    const known = handleError(new MarketError("No tienes saldo suficiente para ese retiro.", 409));
    expect(known.status).toBe(409);
    expect(await known.json()).toEqual({ error: "No tienes saldo suficiente para ese retiro." });
    const invalid = handleError(z.object({ amountCop: z.number({ error: "Escribe el monto" }) }).safeParse({}).error);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Escribe el monto" });
  });

  it("un error inesperado responde con un código que también queda en el registro, para encontrarlo después", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleError(new TypeError("Cannot read properties of undefined (reading 'id')"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; ref: string };
    expect(body.ref).toMatch(/^ERR-[0-9A-F]{6}$/);
    expect(body.error).toBe(`Algo falló de nuestro lado. Si se repite, escríbenos con el código ${body.ref}.`);
    // El detalle técnico no llega al navegador; queda en el registro con el mismo código.
    expect(body.error).not.toContain("Cannot read");
    const entry = JSON.parse(String(log.mock.calls[0][0]));
    expect(entry).toMatchObject({ tipo: "error_api", ref: body.ref, nombre: "TypeError", mensaje: expect.stringContaining("Cannot read properties") });
  });

  it("cada error inesperado tiene su propio código", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const refs = await Promise.all(Array.from({ length: 5 }, async () => ((await handleError(new Error("x")).json()) as { ref: string }).ref));
    expect(new Set(refs).size).toBe(5);
  });
});
