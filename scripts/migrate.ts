/** Migracje działające dla obu baz (Postgres i PGlite): npm run db:migrate */
import "dotenv/config";
import { db, usingPglite, pgliteDir } from "../src/db";

async function main() {
  if (usingPglite) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log(`PGlite: migracje zastosowane (${pgliteDir})`);
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log("Postgres: migracje zastosowane");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
