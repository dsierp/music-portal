/**
 * Sprzątanie bufora odpowiedzi: npx tsx scripts/cache-sweep.ts [dni]
 *
 * Skąd się wziął: bufor (`api_cache`) nigdy niczego nie usuwał. Każda odpowiedź
 * MusicBrainz, Wikipedii i Cover Art Archive zostawała w nim na zawsze, więc
 * tabela rosła aż do limitu Neona (512 MB). Po jego przekroczeniu baza
 * przestaje przyjmować ZAPISY — a wtedy nie da się nawet postawić oceny —
 * i dławi odczyty tak, że strony wiszą po kilka minut. Wyglądało to na
 * powolność MusicBrainz, a było naszym śmietnikiem.
 *
 * Skrypt kasuje wpisy starsze niż podana liczba dni (domyślnie 30 — najdłuższy
 * TTL, jakiego używamy) i pokazuje, ile miejsca zajmują tabele. Bufor z definicji
 * wolno wyrzucić w całości: to, co potrzebne, pobierze się ponownie.
 */
import "dotenv/config";
import { Client } from "pg";

const dni = Number(process.argv[2] ?? 30);

function mb(bajty: number) {
  return `${(bajty / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Brak DATABASE_URL — uruchom w katalogu projektu, z .env.local.");
    process.exit(1);
  }
  const c = new Client({ connectionString: url });
  await c.connect();

  const rozmiary = await c.query<{ relname: string; bajty: string }>(
    `SELECT relname, pg_total_relation_size(c.oid) AS bajty
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC`,
  );
  console.log("Przed sprzątaniem:");
  for (const r of rozmiary.rows) console.log(`  ${r.relname.padEnd(24)} ${mb(Number(r.bajty))}`);

  const przed = await c.query<{ n: string }>(`SELECT count(*) AS n FROM api_cache`);
  const usuniete = await c.query(
    `DELETE FROM api_cache WHERE fetched_at < now() - ($1 || ' days')::interval`,
    [String(dni)],
  );
  console.log(`\nWpisów w buforze: ${przed.rows[0].n}; usuniętych (starsze niż ${dni} dni): ${usuniete.rowCount}`);

  // VACUUM FULL odzyskuje miejsce NA DYSKU, a nie tylko oznacza je jako wolne —
  // przy przekroczonym limicie projektu to jedyne, co realnie pomaga. Blokuje
  // tabelę na czas działania, ale bufor i tak nikomu nie jest potrzebny.
  console.log("VACUUM FULL api_cache… (chwilę to potrwa)");
  await c.query("VACUUM FULL api_cache");

  const po = await c.query<{ bajty: string }>(
    `SELECT pg_total_relation_size('api_cache') AS bajty`,
  );
  console.log(`Bufor po sprzątaniu: ${mb(Number(po.rows[0].bajty))}`);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
