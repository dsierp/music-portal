/**
 * Kopia i odtwarzanie TWOICH danych: npm run db:backup / npm run db:restore <plik>
 *
 * Po co: reszta bazy odtwarza się sama (premiery z importu, best of, cache
 * MusicBrainz), ale oceny, komentarze, preferencje i ulubione istnieją tylko
 * tutaj. Przy `db:reset` przepadają — i tak właśnie przepadły dziś dwa razy.
 *
 * Kopia to JSON, nie kopia katalogu bazy. Świadomie: plik JSON przetrwa i zmianę
 * schematu, i uszkodzenie plików PGlite, a katalog binarny bywa uszkodzony
 * dokładnie wtedy, gdy jest najbardziej potrzebny.
 *
 *   npm run db:backup                → kopia obok bazy, w podkatalogu backups/
 *   npm run db:restore -- <plik>     → dopisuje dane z kopii (nie kasuje istniejących)
 *
 * Kopię robi się przy ZATRZYMANYM serwerze (PGlite znosi jeden proces naraz).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pgliteDir } from "../src/db/paths";

const TABLES = ["users", "accounts", "userGenres", "likedAlbums", "favoriteArtists", "ratings", "comments"] as const;

async function backup() {
  const { db, schema } = await import("../src/db");
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    data[t] = await db.select().from(schema[t] as never);
    console.log(`  ${t}: ${data[t].length}`);
  }
  const dir = path.join(path.dirname(path.resolve(pgliteDir ?? "./data/pglite")), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `music-portal-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), data }, null, 2));
  const n = Object.values(data).reduce((a, b) => a + b.length, 0);
  console.log(`\nZapisano ${n} rekordów: ${file}`);
  if (!n) console.log("(baza jest pusta — nie ma jeszcze czego zapisywać)");
}

async function restore(file: string) {
  const { db, schema } = await import("../src/db");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { data: Record<string, unknown[]> };
  console.log(`Kopia z ${file}`);
  for (const t of TABLES) {
    const rows = raw.data[t] ?? [];
    if (!rows.length) continue;
    // Daty wracają z JSON-a jako tekst — Drizzle oczekuje obiektów Date.
    const fixed = rows.map((r) => {
      const o = { ...(r as Record<string, unknown>) };
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(v)) o[k] = new Date(v);
      }
      return o;
    });
    try {
      await db.insert(schema[t] as never).values(fixed as never).onConflictDoNothing();
      console.log(`  ${t}: ${fixed.length}`);
    } catch (e) {
      console.error(`  ${t}: NIE UDAŁO SIĘ — ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("\nGotowe. Istniejące rekordy zostały nietknięte (dopisujemy, nie nadpisujemy).");
}

async function main() {
  const file = process.argv[2];
  if (file) await restore(file);
  else await backup();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
