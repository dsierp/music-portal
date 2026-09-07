/** Generuje fixture'y MusicBrainz (mały, spójny świat) do tests/fixtures/mb. */
import fs from "node:fs";
import { fixtureName } from "../src/lib/musicbrainz";

export const ID = {
  band: "11111111-1111-4111-8111-111111111111",
  mirai: "22222222-2222-4222-8222-222222222222",
  mika: "33333333-3333-4333-8333-333333333333",
  producer: "44444444-4444-4444-8444-444444444444",
  otherBand: "55555555-5555-4555-8555-555555555555",
  rg: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  rel: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  rg2: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  rel2: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  rgOld: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};
const dir = "tests/fixtures/mb";
fs.mkdirSync(dir, { recursive: true });
const put = (path: string, params: Record<string, string | number>, data: unknown) =>
  fs.writeFileSync(`${dir}/${fixtureName(path, params)}`, JSON.stringify(data, null, 1));

const sighCredit = [{ name: "Sigh", joinphrase: "", artist: { id: ID.band, name: "Sigh", type: "Group" } }];
const otherCredit = [{ name: "Other Band", joinphrase: "", artist: { id: ID.otherBand, name: "Other Band", type: "Group" } }];
const rel = (type: string, artist: { id: string; name: string; type: string }, attributes: string[] = []) => ({
  type, direction: "backward", attributes, "target-type": "artist", artist,
});
const mirai = { id: ID.mirai, name: "Mirai Kawashima", type: "Person" };
const mika = { id: ID.mika, name: "Dr. Mikannibal", type: "Person" };
const prod = { id: ID.producer, name: "Some Producer", type: "Person" };

// release-group lookup
put(`/release-group/${ID.rg}`, { inc: "artist-credits+releases+url-rels+genres+tags" }, {
  id: ID.rg, title: "Goh-Ka", "primary-type": "Album", "secondary-types": [], "first-release-date": "2026-09-04",
  "artist-credit": sighCredit,
  releases: [
    { id: ID.rel, title: "Goh-Ka", status: "Official", date: "2026-09-04", country: "GB", "track-count": 3 },
    { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", title: "Goh-Ka", status: "Official", date: "2026-10-01", country: "JP", "track-count": 4 },
  ],
  genres: [{ name: "avant-garde metal", count: 5 }, { name: "black metal", count: 3 }],
  tags: [{ name: "japanese", count: 2 }],
  relations: [{ type: "wikidata", direction: "forward", "target-type": "url", url: { resource: "https://www.wikidata.org/wiki/Q999" } }],
});
const track = (n: number, title: string, rid: string, rels: unknown[]) => ({
  position: n, number: String(n), title, length: 300000 + n * 1000, recording: { id: rid, title, length: 300000 + n * 1000, relations: rels },
});
put(`/release/${ID.rel}`, { inc: "recordings+artist-credits+artist-rels+recording-level-rels+labels+url-rels" }, {
  id: ID.rel, title: "Goh-Ka", date: "2026-09-04", status: "Official",
  "label-info": [{ label: { id: "l1", name: "Peaceville" }, "catalog-number": "CDVILEF999" }],
  media: [{ position: 1, format: "CD", tracks: [
    track(1, "Kaen", "r1-0000-4000-8000-000000000001", [rel("vocal", mirai, ["lead vocals"]), rel("instrument", mirai, ["keyboard"]), rel("instrument", mika, ["saxophone"])]),
    track(2, "Shoki", "r1-0000-4000-8000-000000000002", [rel("vocal", mirai, ["lead vocals"]), rel("instrument", mirai, ["keyboard"]), rel("instrument", mika, ["saxophone"])]),
    track(3, "Mukou", "r1-0000-4000-8000-000000000003", [rel("vocal", mirai, ["lead vocals"]), rel("instrument", mirai, ["keyboard", "shamisen"])]),
  ] }],
  relations: [rel("producer", prod), { type: "streaming", direction: "forward", "target-type": "url", url: { resource: "https://open.spotify.com/album/abc" } }],
});
// artist: band
put(`/artist/${ID.band}`, { inc: "artist-rels+url-rels+genres+tags+aliases" }, {
  id: ID.band, name: "Sigh", "sort-name": "Sigh", type: "Group", country: "JP", area: { name: "Tokyo" },
  "life-span": { begin: "1989", ended: false }, disambiguation: "Japanese avant-garde black metal band",
  genres: [{ name: "black metal", count: 10 }, { name: "avant-garde metal", count: 8 }], tags: [], aliases: [],
  relations: [
    { type: "member of band", direction: "backward", attributes: ["vocals", "keyboard", "original"], begin: "1989", ended: false, "target-type": "artist", artist: mirai },
    { type: "member of band", direction: "backward", attributes: ["saxophone", "vocals"], begin: "2007", ended: false, "target-type": "artist", artist: mika },
    { type: "member of band", direction: "backward", attributes: ["drums"], begin: "1990", end: "2004", ended: true, "target-type": "artist", artist: { id: "66666666-6666-4666-8666-666666666666", name: "Satoshi Fujinami", type: "Person" } },
    { type: "wikipedia", direction: "forward", "target-type": "url", url: { resource: "https://en.wikipedia.org/wiki/Sigh_(band)" } },
    { type: "official homepage", direction: "forward", "target-type": "url", url: { resource: "https://sigh.example" } },
  ],
});
// artist: person
put(`/artist/${ID.mirai}`, { inc: "artist-rels+url-rels+genres+tags+aliases" }, {
  id: ID.mirai, name: "Mirai Kawashima", "sort-name": "Kawashima, Mirai", type: "Person", country: "JP",
  "life-span": { begin: "1970-05-27", ended: false }, genres: [], tags: [], aliases: [{ name: "Mirai" }],
  relations: [
    { type: "member of band", direction: "forward", attributes: ["vocals", "keyboard"], begin: "1989", ended: false, "target-type": "artist", artist: { id: ID.band, name: "Sigh", type: "Group" } },
  ],
});
// dyskografia zespołu
put("/release-group/", { artist: ID.band, limit: 100, offset: 0, inc: "artist-credits" }, {
  "release-group-count": 2,
  "release-groups": [
    { id: ID.rg, title: "Goh-Ka", "primary-type": "Album", "secondary-types": [], "first-release-date": "2026-09-04", "artist-credit": sighCredit },
    { id: ID.rgOld, title: "Scorn Defeat", "primary-type": "Album", "secondary-types": [], "first-release-date": "1993-11-01", "artist-credit": sighCredit },
  ],
});
put("/release-group/", { artist: ID.mirai, limit: 100, offset: 0, inc: "artist-credits" }, { "release-group-count": 0, "release-groups": [] });
// nagrania muzyka: gościnnie u Other Band
put("/recording/", { artist: ID.mirai, limit: 100, offset: 0, inc: "releases+release-groups+artist-credits+artist-rels" }, {
  "recording-count": 2,
  recordings: [
    { id: "r2-0000-4000-8000-000000000001", title: "Guest Song", "artist-credit": otherCredit,
      relations: [rel("instrument", mirai, ["keyboard"])],
      releases: [{ id: ID.rel2, title: "Other Album", status: "Official", date: "2020-01-01", "artist-credit": otherCredit,
        "release-group": { id: ID.rg2, title: "Other Album", "primary-type": "Album", "first-release-date": "2020-01-01", "artist-credit": otherCredit } }] },
    { id: "r1-0000-4000-8000-000000000001", title: "Kaen", "artist-credit": sighCredit, relations: [rel("vocal", mirai, ["lead vocals"])],
      releases: [{ id: ID.rel, title: "Goh-Ka", "artist-credit": sighCredit, "release-group": { id: ID.rg, title: "Goh-Ka", "primary-type": "Album", "artist-credit": sighCredit } }] },
  ],
});
// wyszukiwanie
put("/release-group/", { query: 'releasegroup:"Goh Ka" AND artist:"Sigh"', limit: 5 }, {
  "release-groups": [{ id: ID.rg, score: 100, title: "Goh-Ka", "primary-type": "Album", "first-release-date": "2026-09-04", "artist-credit": sighCredit }],
});
put("/release-group/", { query: "sigh", limit: 15 }, {
  "release-groups": [{ id: ID.rg, score: 100, title: "Goh-Ka", "primary-type": "Album", "first-release-date": "2026-09-04", "artist-credit": sighCredit }],
});
put("/artist/", { query: "sigh", limit: 10 }, { artists: [{ id: ID.band, name: "Sigh", type: "Group", country: "JP", disambiguation: "Japanese avant-garde black metal band" }] });
console.log("fixtures:", fs.readdirSync(dir).length);
