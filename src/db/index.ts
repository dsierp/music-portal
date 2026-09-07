import * as schema from "./schema";

/**
 * Wybór bazy:
 *  - DATABASE_URL=postgresql://…  → prawdziwy Postgres (produkcja, docker),
 *  - DATABASE_URL pusty albo "pglite:<katalog>" → PGlite: Postgres w WASM zapisywany do pliku
 *    (zero instalacji; domyślnie ./data/pglite). Do lokalnego użytku, nie na produkcję.
 */
const url = process.env.DATABASE_URL ?? "";
export const usingPglite = !url || url.startsWith("pglite:");
export const pgliteDir = usingPglite ? url.replace(/^pglite:/, "") || "./data/pglite" : null;

type AnyDb = ReturnType<typeof makePg>;

function makePg() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const g = globalThis as unknown as { pgPool?: InstanceType<typeof Pool> };
  const pool = g.pgPool ?? new Pool({ connectionString: url, max: 10 });
  if (process.env.NODE_ENV !== "production") g.pgPool = pool;
  return drizzle(pool, { schema });
}

function makePglite(): AnyDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const g = globalThis as unknown as { pglite?: InstanceType<typeof PGlite> };
  const client = g.pglite ?? new PGlite(pgliteDir!);
  g.pglite = client; // jeden proces = jedna instancja (PGlite blokuje katalog)
  return drizzle(client, { schema }) as unknown as AnyDb;
}

export const db: AnyDb = usingPglite ? makePglite() : makePg();
export type Db = typeof db;
export { schema };
