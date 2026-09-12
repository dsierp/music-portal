import { test } from "node:test";
import assert from "node:assert/strict";
import { czytelnaRola, groupsOf, instrumentGroup, playsInstrument } from "../src/lib/instruments.ts";

test("bas przed gitarą — „electric bass guitar\" to basista", () => {
  assert.equal(instrumentGroup("electric bass guitar"), "bass");
  assert.equal(instrumentGroup("bass guitar"), "bass");
  assert.equal(instrumentGroup("guitar"), "guitar");
});

test("surowe napisy MusicBrainz trafiają tam, gdzie ich szuka człowiek", () => {
  assert.equal(instrumentGroup("drums (drum set)"), "drums");
  assert.equal(instrumentGroup("membranophone"), "drums", "nikt nie szuka membranofonu");
  assert.equal(instrumentGroup("background vocals"), "vocals");
  assert.equal(instrumentGroup("lead vocals"), "vocals");
  assert.equal(instrumentGroup("keyboard"), "keys");
  assert.equal(instrumentGroup("harmonica"), "other");
});

test("jedna osoba może być w kilku grupach", () => {
  assert.deepEqual(groupsOf(["guitar", "keyboard"]), ["guitar", "keys"]);
  assert.deepEqual(groupsOf([]), []);
});

test("pusty filtr przepuszcza wszystkich", () => {
  assert.equal(playsInstrument(["harmonica"], ""), true);
  assert.equal(playsInstrument(["harmonica"], "guitar"), false);
  assert.equal(playsInstrument(["guitar", "keyboard"], "keys"), true);
});

test("żargon MusicBrainz zamienia się na nazwę, którą ktoś rozpozna", () => {
  assert.equal(czytelnaRola("membranophone"), "drums");
  assert.equal(czytelnaRola("drums (drum set)"), "drums");
  assert.equal(czytelnaRola("idiophone"), "percussion");
  // Zrozumiałych nazw nie ruszamy — mają zostać takie, jak stoją w bazie.
  assert.equal(czytelnaRola("bass guitar"), "bass guitar");
  assert.equal(czytelnaRola("lead vocals"), "lead vocals");
});

test("bas nie jest gitarą — także w zapisie „bass guitar\"", () => {
  // Oba wzorce pasują do tego samego napisu, więc liczy się kolejność.
  // Na osi czasu przy odwrotnej cały skład wychodził na gitarzystów.
  assert.equal(instrumentGroup("bass guitar"), "bass");
  assert.equal(instrumentGroup("electric bass guitar"), "bass");
  assert.equal(instrumentGroup("guitar"), "guitar");
});

test("membranophone to po prostu bebny", () => {
  assert.equal(czytelnaRola("membranophone"), "drums");
  assert.equal(czytelnaRola("Membranophone"), "drums");
});

test("zrozumiala nazwa zostaje nietknieta", () => {
  assert.equal(czytelnaRola("bass guitar"), "bass guitar");
  assert.equal(czytelnaRola("lead vocals"), "lead vocals");
});
