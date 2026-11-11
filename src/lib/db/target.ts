/**
 * A qué base de datos se conecta esta ejecución. Sin dependencias: lo usan la app, las migraciones y las pruebas.
 *
 * Las vistas previas de Vercel (VERCEL_ENV=preview) nunca usan la base de producción: usan la suya, la que crea
 * Vercel › Storage con el prefijo PREVIEW (PREVIEW_TURSO_DATABASE_URL y PREVIEW_TURSO_AUTH_TOKEN). Si no la
 * tienen, trabajan con un archivo temporal que se pierde al reiniciar la función.
 */
export interface DatabaseTarget {
  url: string;
  authToken?: string;
  /**
   * principal: la base de la app (en Vercel, la de producción);
   * pruebas: la base propia de las vistas previas;
   * temporal: un archivo en /tmp que se borra solo;
   * local: un archivo en tu computador.
   */
  kind: "principal" | "pruebas" | "temporal" | "local";
}

const value = (v: string | undefined) => v?.trim() || undefined;

export function databaseTarget(env: Record<string, string | undefined> = process.env): DatabaseTarget {
  if (env.VERCEL_ENV === "preview") {
    const url = value(env.PREVIEW_TURSO_DATABASE_URL);
    if (url) return { url, authToken: value(env.PREVIEW_TURSO_AUTH_TOKEN), kind: "pruebas" };
    return { url: "file:/tmp/iwe-preview.db", kind: "temporal" };
  }
  const url = value(env.TURSO_DATABASE_URL) ?? value(env.DATABASE_URL);
  if (url) {
    const authToken = value(env.TURSO_AUTH_TOKEN) ?? value(env.DATABASE_AUTH_TOKEN);
    return { url, authToken, kind: url.startsWith("file:") ? "local" : "principal" };
  }
  if (env.VERCEL) return { url: "file:/tmp/iwe.db", kind: "temporal" };
  return { url: "file:./data/iwe.db", kind: "local" };
}

/** ¿Esta vista previa tiene su propia base? Entonces puede migrarla sin tocar producción. */
export function hasOwnPreviewDatabase(env: Record<string, string | undefined> = process.env) {
  return databaseTarget(env).kind === "pruebas";
}
