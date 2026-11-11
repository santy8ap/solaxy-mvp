/** Destinos internos permitidos después del ingreso. Nunca acepta una URL externa. */
export function safeReturnTo(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://internal.invalid");
    if (
      url.origin !== "https://internal.invalid" ||
      !(url.pathname === "/comprar" || /^\/panel(?:\/|$)/.test(url.pathname))
    )
      return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export const planCheckoutHref = (planId: string) =>
  `/comprar?plan=${encodeURIComponent(planId)}`;
export const renewalCheckoutHref = (subscriptionId: string) =>
  `/comprar?suscripcion=${encodeURIComponent(subscriptionId)}`;

export function loginHref(returnTo: string) {
  return `/ingresar?${new URLSearchParams({ next: safeReturnTo(returnTo) ?? "/panel" })}`;
}
