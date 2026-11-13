import "server-only";
import { alertFailure } from "@/lib/alerts";
import { payLog } from "@/lib/payments/log";
import { claimInterval } from "./claim";
import { maybeHousekeeping } from "./housekeeping";
import { reconcileMercadoPago } from "./reconcile-mercadopago";
import { reconcilePayments } from "./reconcile-payments";

export { claimInterval };

const TICK_ID = "reconcile-tick";
/** Como máximo una pasada cada 2 minutos en todo el sitio, sin importar cuántas visitas lleguen. */
export const TICK_INTERVAL_MS = 2 * 60_000;

/**
 * La pasada frecuente: pagos cripto en verificación, pagos pendientes de Mercado Pago y, una vez por hora,
 * el mantenimiento (órdenes abandonadas y sesiones vencidas).
 */
async function frequentPass() {
  await reconcilePayments();
  await reconcileMercadoPago({ mode: "frecuente" });
  await maybeHousekeeping();
}

/** Cada instancia consulta la base como máximo cada 30 segundos (evita una escritura por visita). */
const LOCAL_CHECK_MS = 30_000;
const memo = globalThis as unknown as { __iweTickNextCheck?: number };

/**
 * Conciliación con las visitas: las rutas que se consultan a menudo la llaman con after(), así que
 * corre después de responder y no demora a nadie. Así un pago no espera al cron diario cuando la
 * empresa cerró la página. Devuelve si le tocó correr. Nunca lanza errores.
 */
export async function maybeReconcile({ clock = Date.now, run = frequentPass }: { clock?: () => number; run?: () => Promise<void> } = {}) {
  const now = clock();
  if (memo.__iweTickNextCheck && now < memo.__iweTickNextCheck) return false;
  memo.__iweTickNextCheck = now + LOCAL_CHECK_MS;
  try {
    if (!(await claimInterval({ id: TICK_ID, intervalMs: TICK_INTERVAL_MS, clock: () => now }))) return false;
    try {
      await run();
    } catch (error) {
      payLog("conciliacion_visitas_fallida", { error: String(error).slice(0, 200) });
      alertFailure("conciliacion-visitas", "la conciliación automática de pagos", String(error));
    }
    return true;
  } catch (error) {
    payLog("conciliacion_visitas_fallida", { error: String(error).slice(0, 200) });
    alertFailure("conciliacion-visitas", "la conciliación automática de pagos", String(error));
    return false;
  }
}
