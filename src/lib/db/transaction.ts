import "server-only";
import { db, type Db } from "@/lib/db";

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
let writes = Promise.resolve();

function isWriteConflict(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code && /^(SQLITE_BUSY|SQLITE_LOCKED)(_|$)/.test(code)) return true;
  const cause = (error as { cause?: unknown })?.cause;
  return cause != null && cause !== error && isWriteConflict(cause);
}

/** Reintenta solo bloqueos de escritura revertidos por SQLite, nunca un resultado de red ambiguo. */
export async function writeTransaction<T>(
  run: (session: Transaction) => Promise<T>,
): Promise<T> {
  // El cliente SQLite local bloquea el hilo al esperar otra conexión del mismo proceso.
  // La cola evita esa espera; la transacción sigue protegiendo instancias distintas en Turso.
  const previous = writes;
  let release!: () => void;
  writes = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.transaction(run);
      } catch (error) {
        if (attempt >= 6 || !isWriteConflict(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
  } finally {
    release();
  }
}
