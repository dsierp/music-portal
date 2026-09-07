/**
 * Import premier piątkowych i Best of ze strony Pure New Shit do bazy.
 *   npm run import:pns -- data/purenewshit.html
 * Można też podać URL (jeśli plik jest publiczny).
 * Sekcje z pliku zastępują sekcje o tym samym id; starsze zostają (archiwum tygodni).
 */
import "dotenv/config";
import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { parsePureNewShit, sectionSortDate } from "../src/lib/pns-parser";

async function main() {
  const src = process.argv[2] ?? "data/purenewshit.html";
  const html = src.startsWith("http") ? await (await fetch(src)).text() : fs.readFileSync(src, "utf8");
  const data = parsePureNewShit(html);

  for (const s of data.sections) {
    const row = {
      id: s.id,
      kind: s.cls === "red" ? "friday" : "week",
      title: s.title,
      date: s.date,
      sortDate: sectionSortDate(s.date),
      sub: s.sub ?? null,
      pickId: s.pick ?? null,
      importedAt: new Date(),
    };
    await db.insert(schema.releaseSections).values(row).onConflictDoUpdate({ target: schema.releaseSections.id, set: row });

    // zachowaj już rozwiązane MBID dla tych samych pozycji
    const old = await db.select().from(schema.releases).where(eq(schema.releases.sectionId, s.id));
    const oldById = new Map(old.map((r) => [r.id, r]));
    await db.delete(schema.releases).where(eq(schema.releases.sectionId, s.id));

    let pos = 0;
    for (const r of s.releases) {
      const [id, genre, star, artist, album, label, description, reviews, flag, date] = r;
      const fullId = `${s.id}:${id}`;
      const prev = oldById.get(fullId);
      const same = prev && prev.artist === artist && prev.album === album;
      await db.insert(schema.releases).values({
        id: fullId, sectionId: s.id, position: pos++, genre, star,
        artist: artist ?? null, album: album ?? null, label: label ?? null,
        description, reviews: reviews ?? null, flag: flag ?? null, dayLabel: date ?? null,
        mbid: same ? prev.mbid : null, mbidTriedAt: same ? prev.mbidTriedAt : null,
      });
    }
    console.log(`sekcja ${s.id} (${s.title} ${s.date}): ${s.releases.length} pozycji`);
  }

  for (const [year, y] of Object.entries(data.best)) {
    await db.insert(schema.bestOfYears).values({ year, label: y.label, sub: y.sub ?? null })
      .onConflictDoUpdate({ target: schema.bestOfYears.year, set: { label: y.label, sub: y.sub ?? null } });
    for (const [category, rows] of Object.entries(y.cats)) {
      let rank = 1;
      for (const [artist, album, label, genre, country, released, scores, why] of rows) {
        const prev = await db.query.bestOfEntries.findFirst({
          where: and(eq(schema.bestOfEntries.year, year), eq(schema.bestOfEntries.category, category), eq(schema.bestOfEntries.rank, rank)),
        });
        const same = prev && prev.artist === artist && prev.album === album;
        const values = { year, category, rank, artist, album, label, genre, country, released, scores, why, mbid: same ? prev.mbid : null, mbidTriedAt: same ? prev.mbidTriedAt : null };
        if (prev) await db.update(schema.bestOfEntries).set(values).where(eq(schema.bestOfEntries.id, prev.id));
        else await db.insert(schema.bestOfEntries).values(values);
        rank++;
      }
      console.log(`best of ${year}/${category}: ${rows.length}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
