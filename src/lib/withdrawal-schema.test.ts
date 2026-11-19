import { describe, expect, it } from "vitest";
import { accountFieldsFor, accountKindLabel, isPhoneWallet, parseBankDestination } from "./withdrawal-schema";

describe("cuentas de banco y billeteras por celular", () => {
  it("Nequi y Daviplata se identifican con el celular: sin tipo de cuenta y con 10 dígitos que empiezan por 3", () => {
    expect(isPhoneWallet("Nequi")).toBe(true);
    expect(isPhoneWallet("Daviplata")).toBe(true);
    expect(isPhoneWallet("Bancolombia")).toBe(false);
    for (const raw of ["3014412962", "301 441 2962", "301-441-2962", "+57 301 441 2962", "573014412962"])
      expect(parseBankDestination({ bank: "Nequi", accountNumber: raw })).toEqual({ ok: true, value: { bank: "Nequi", accountType: "ahorros", accountNumber: "3014412962" } });
    // El tipo que venga se ignora: en Nequi no existe.
    expect(parseBankDestination({ bank: "Daviplata", accountType: "corriente", accountNumber: "3104412962" })).toMatchObject({ ok: true, value: { accountType: "ahorros" } });
    expect(parseBankDestination({ bank: "Nequi", accountNumber: "1234567890" })).toEqual({ ok: false, errors: { accountNumber: "Escribe el celular de la cuenta Nequi: 10 dígitos que empiezan por 3." } });
    expect(parseBankDestination({ bank: "Nequi", accountNumber: "301441296" })).toMatchObject({ ok: false });
  });

  it("un banco sigue pidiendo el tipo de cuenta y entre 6 y 20 dígitos", () => {
    expect(parseBankDestination({ bank: "Bancolombia", accountType: "ahorros", accountNumber: "123-456789-01" })).toEqual({ ok: true, value: { bank: "Bancolombia", accountType: "ahorros", accountNumber: "12345678901" } });
    expect(parseBankDestination({ bank: "Bancolombia", accountNumber: "12345678901" })).toEqual({ ok: false, errors: { accountType: "Elige si la cuenta es de ahorros o corriente." } });
    expect(parseBankDestination({ bank: "Davivienda", accountType: "corriente", accountNumber: "123" })).toMatchObject({ ok: false, errors: { accountNumber: expect.stringMatching(/entre 6 y 20/) } });
  });

  it("el formulario y las listas lo nombran según el banco", () => {
    expect(accountFieldsFor("Nequi")).toMatchObject({ needsType: false, numberLabel: "Celular de Nequi" });
    expect(accountFieldsFor("Bancolombia")).toMatchObject({ needsType: true, numberLabel: "Número de cuenta" });
    expect(accountFieldsFor("")).toMatchObject({ needsType: true });
    expect(accountKindLabel("Nequi", "ahorros")).toBe("Celular");
    expect(accountKindLabel("Bancolombia", "corriente")).toBe("Cuenta corriente");
  });
});
