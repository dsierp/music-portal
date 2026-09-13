/**
 * Sprawdzenie zapisanych dowiązań do MusicBrainz: npm run verify:mbids
 *
 * PO CO: przez pewien czas dopasowywanie brało PIERWSZY wynik z brzegu, bez
 * sprawdzenia, czy to w ogóle ten zespół. Nawias w tytule rozwalał zapytanie
 * („Innern (Instrumental)"), z nazwy zostawało jedno słowo i premiera prowadziła
 * na cudzą płytę. Sito w `findAlbumMbid` zamyka drogę nowym takim wpadkom, ale
 * te już zapisane w bazie zostają — i trzeba je wyczyścić stąd.
 *
 * Co robi: dla każdej pozycji z MBID pyta MusicBrainz o tę płytę i porównuje
 * artystę oraz tytuł. Gdy się nie zgadza — kasuje samo dowiązanie (MBID), nie
 * pozycję. Przy następnym kliknięciu portal poszuka od nowa, już z sitem.
 *
 *   npm run verify:mbids              → tylko pokaż, co jest nie tak
 *   npm run verify:mbids -- --napraw  → wyczyść błędne dowiązania
 *   npm run verify:mbids -- --minuty=5
 *
 * Chodzi po jednym zapytaniu na sekundę, bo tyle przepuszcza MusicBrainz.
 */
import "dotenv/config";
import { config } from "dotenv";

// Jak w resolve-mbids: lokalny .env ma pusty DATABASE_URL (tu chodzi PGlite),
// a sprawdzać trzeba bazę PRODUKCYJNĄ.
config({ path: ".env.production.local", override: true });
config({ path: ".env.local", override: true });
if (process.env.DATABASE_URL_PROD) process.env.DATABASE_URL = process.env.DATABASE_URL_PROD;
if (!process.env.DATABASE_URL) {
  console.error("Brak adresu bazy. Ustaw DATABASE_URL albo .env.production.local.");
  process.exit(1);
}

async function main() {
  const { db, schema } = await import("../src/db");
  const { eq, isNotNull } = await import("drizzle-orm");
  const { czyTaPlyta } = await import("../src/lib/musicbrainz");

  const napraw = process.argv.includes("--napraw");
  const limitArg = process.argv.find((a) => a.startsWith("--minuty="));
  const koniec = limitArg ? Date.now() + Number(limitArg.split("=")[1]) * 60_000 : Infinity;

  const premiery = await db
    .select({ id: schema.releases.id, artist: schema.releases.artist, album: schema.releases.album, mbid: schema.releases.mbid })
    .from(schema.releases)
    .where(isNotNull(schema.releases.mbid));
  const best = await db
    .select({ id: schema.bestOfEntries.id, artist: schema.bestOfEntries.artist, album: schema.bestOfEntries.album, mbid: schema.bestOfEntries.mbid })
    .from(schema.bestOfEntries)
    .where(isNotNull(schema.bestOfEntries.mbid));

  const wszystko = [
    ...premiery.map((r) => ({ ...r, skad: "premiery" as const })),
    ...best.map((r) => ({ ...r, skad: "best" as const })),
  ];
  console.log(`Do sprawdzenia: ${premiery.length} premier + ${best.length} best of.`);
  if (!napraw) console.log("(tryb podglądu — nic nie zapisuję; dodaj --napraw)\n");

  let zle = 0, sprawdzone = 0, bledy = 0;
  for (const p of wszystko) {
    if (Date.now() > koniec) { console.log("\nCzas minął — przerywam."); break; }
    if (!p.mbid || !p.artist || !p.album) continue;
    let ok: boolean;
    try {
      ok = await czyTaPlyta(p.mbid, p.artist, p.album);
    } catch (e) {
      // Awaria to nie jest „złe dowiązanie" — nie wolno niczego na tej
      // podstawie kasować.
      bledy++;
      console.log(`  ? ${p.artist} – ${p.album}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    sprawdzone++;
    if (ok) continue;
    zle++;
    console.log(`  ✕ ${p.artist} – ${p.album}  (${p.mbid})`);
    if (napraw) {
      if (p.skad === "premiery") {
        await db.update(schema.releases).set({ mbid: null, mbidTriedAt: null }).where(eq(schema.releases.id, p.id));
      } else {
        await db.update(schema.bestOfEntries).set({ mbid: null, mbidTriedAt: null }).where(eq(schema.bestOfEntries.id, p.id));
      }
    }
  }

  console.log(`\nSprawdzone: ${sprawdzone}. Błędnych: ${zle}. Nie udało się zapytać: ${bledy}.`);
  if (zle && !napraw) console.log("Uruchom z --napraw, żeby wyczyścić błędne dowiązania.");
  if (zle && napraw) console.log("Wyczyszczone — portal poszuka od nowa przy kliknięciu.");
}

main().then(() => process.exit(0));
