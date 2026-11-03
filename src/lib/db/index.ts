import { createDb, type Db } from "./client";
import type { Client } from "@libsql/client";

export type { Db } from "./client";

type Holder = { client: Client; db: Db; isLocalFile: boolean };
const g = globalThis as unknown as { __solaxyDb?: Holder };

/** Instancia única (sobrevive a la recarga en caliente de `next dev`). */
const holder: Holder = (g.__solaxyDb ??= createDb());

export const client = holder.client;
export const db = holder.db;
export const isLocalFileDb = holder.isLocalFile;
