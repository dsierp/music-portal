/** Migracje działające dla obu baz (Postgres i PGlite): npm run db:migrate */
import "dotenv/config";
import { PgliteLockedError } from "../src/db/lock";

async function main() {
  // Import dynamiczny: otwarcie bazy może rzucić PgliteLockedError (ktoś inny ją
  // trzyma) — chcemy wtedy pokazać czytelny komunikat, a nie stack trace.
  const { db, usingPglite, pgliteDir } = await import("../src/db");
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
main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    if (e instanceof PgliteLockedError) { console.error(`
${e.message}
`); process.exit(1); }
    const { describeDbError } = await import("../src/lib/db-error");
    console.error(describeDbError(e));
    process.exit(1);
  });
