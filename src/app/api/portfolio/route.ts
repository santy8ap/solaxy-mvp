import { after } from "next/server";
import { handleError } from "@/lib/api";
import { retryUserCryptoOrders } from "@/lib/payments/crypto-service";
import { getPortfolio } from "@/lib/portfolio";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    // Si quedó un pago cripto verificando (por ejemplo, se cerró la pestaña), se reintenta sin demorar la respuesta.
    after(() => retryUserCryptoOrders(user.id).catch(() => undefined));
    return Response.json(await getPortfolio(user.id));
  } catch (e) {
    return handleError(e);
  }
}
