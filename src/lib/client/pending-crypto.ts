"use client";

/**
 * Pagos cripto enviados desde la wallet cuyo hash todavía no confirmó el servidor.
 * Se guardan apenas la wallet devuelve el hash: si se cierra la pestaña, el panel lo reenvía al volver.
 */
const KEY = "iwe:pagos-cripto";

type Pending = Record<string, { hash: string; at: number }>;

function read(): Pending {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Pending;
  } catch {
    return {};
  }
}

function write(p: Pending) {
  try {
    if (Object.keys(p).length) window.localStorage.setItem(KEY, JSON.stringify(p));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: el admin puede registrar el hash a mano */
  }
}

export function savePending(orderId: string, hash: string) {
  write({ ...read(), [orderId]: { hash, at: Date.now() } });
}

export function clearPending(orderId: string) {
  const p = read();
  delete p[orderId];
  write(p);
}

/** Reenvía los hashes pendientes. Se olvida de los que el servidor ya registró o rechazó. */
export async function resubmitPending() {
  const p = read();
  for (const [orderId, { hash, at }] of Object.entries(p)) {
    if (Date.now() - at > 7 * 86_400_000) {
      clearPending(orderId);
      continue;
    }
    try {
      const res = await fetch("/api/payments/crypto/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, txHash: hash }),
      });
      if (res.ok || res.status === 404 || res.status === 409 || res.status === 400) clearPending(orderId);
    } catch {
      /* sin red: se reintenta la próxima vez */
    }
  }
}
