import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNeonUrl } from "../scripts/neon-setup";

test("neon: pusty adres tłumaczy, co wpisać", () => {
  const r = checkNeonUrl(undefined);
  assert.equal(r.ok, false);
  assert.match((r as { why: string }).why, /NEON_DATABASE_URL/);
});

test("neon: zaślepka nie przechodzi", () => {
  for (const url of ["postgresql://user:pass@…nowy…/neondb", "postgresql://u:p@<host>/db", "postgresql://u:p@TWOJ-ADRES/db"]) {
    assert.equal(checkNeonUrl(url).ok, false, url);
  }
});

test("neon: prawdziwy adres przechodzi, cudzysłowy obcięte", () => {
  const r = checkNeonUrl('"postgresql://neondb_owner:secret@ep-abc-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"');
  assert.equal(r.ok, true);
  assert.equal((r as { url: string }).url.startsWith("postgresql://"), true);
  assert.equal((r as { url: string }).url.endsWith("require"), true);
});

test("neon: ucięty adres nie przechodzi", () => {
  assert.equal(checkNeonUrl("postgresql://neondb_owner:secret").ok, false);
});
