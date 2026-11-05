"use client";
import { useEffect } from "react";
import { refetch } from "@/lib/client/use-json";
import { resubmitPending } from "@/lib/client/pending-crypto";

/** Si un pago cripto se envió pero la pestaña se cerró antes de registrarlo, se reenvía al abrir el panel. */
export function CryptoRecovery() {
  useEffect(() => {
    const t = setTimeout(() => {
      void resubmitPending().then(() => refetch("/api/portfolio"));
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
