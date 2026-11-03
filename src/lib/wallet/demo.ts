"use client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const KEY = "solaxy:wallet-demo";

/**
 * Wallet de demostración: una clave generada en este navegador. Firma de verdad
 * (el servidor verifica la firma igual que con Trust Wallet), pero no tiene fondos.
 */
export function demoAccount() {
  let pk: `0x${string}` | null = null;
  try {
    pk = window.localStorage.getItem(KEY) as `0x${string}` | null;
  } catch {
    /* sin almacenamiento: clave temporal */
  }
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    try {
      window.localStorage.setItem(KEY, pk);
    } catch {
      /* se usará solo en esta sesión */
    }
  }
  return privateKeyToAccount(pk);
}
