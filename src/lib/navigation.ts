/** Only known, same-origin customer destinations can survive authentication. */
const DESTINATIONS = new Set([
  "/panel",
  "/panel/planes",
  "/panel/movimientos",
  "/panel/billetera",
  "/panel/perfil",
  "/panel/telemetria",
  "/planes",
]);
export function safeDestination(value: unknown, fallback = "/panel") {
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return fallback;
  try {
    const url = new URL(value, "https://internal.invalid");
    if (
      url.origin !== "https://internal.invalid" ||
      !DESTINATIONS.has(url.pathname)
    )
      return fallback;
    const plan = url.searchParams.get("plan");
    return (
      url.pathname +
      (["/planes", "/panel/planes"].includes(url.pathname) &&
      ["01", "02", "03", "04"].includes(plan ?? "")
        ? `?plan=${plan}`
        : "")
    );
  } catch {
    return fallback;
  }
}
export function signInHref(destination: string) {
  return `/ingresar?next=${encodeURIComponent(safeDestination(destination))}`;
}
