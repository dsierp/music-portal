#!/usr/bin/env python3
"""
Z CreateTables.sql MusicBrainz robi tabele „surowe" na czas importu.

Każda kolumna dostaje typ TEXT. Wystarcza to do COPY (zrzut jest w formacie
tekstowym Postgresa), a nie ciągnie za sobą typów, funkcji i ograniczeń
MusicBrainz, których do jednorazowego przeliczenia nie potrzebujemy.
Rzutujemy dopiero w przeksztalc.sql — tam, gdzie wiemy, czego chcemy.

Najważniejsza jest KOLEJNOŚĆ kolumn: musi się zgadzać z plikami zrzutu co do
jednej. Dlatego bierzemy ją z CreateTables.sql z tej samej wersji schematu,
a nie z własnej listy. Gdy MusicBrainz zmieni schemat, COPY wywali się
głośno i import się nie podmieni — zostanie poprzednia kopia.

Użycie: tabele.py CreateTables.sql tabela1 tabela2 ... > src.sql
"""
import re
import sys

SLOWA_NIE_KOLUMNY = {"CONSTRAINT", "CHECK", "PRIMARY", "UNIQUE", "FOREIGN", "EXCLUDE"}


def kolumny(cialo: str) -> list[str]:
    cialo = re.sub(r"--[^\n]*", "", cialo)
    czesci, glebokosc, biezaca = [], 0, []
    for znak in cialo:
        if znak == "(":
            glebokosc += 1
        elif znak == ")":
            glebokosc -= 1
        if znak == "," and glebokosc == 0:
            czesci.append("".join(biezaca))
            biezaca = []
        else:
            biezaca.append(znak)
    czesci.append("".join(biezaca))
    wynik = []
    for c in czesci:
        slowa = c.split()
        if not slowa or slowa[0].upper() in SLOWA_NIE_KOLUMNY:
            continue
        wynik.append(slowa[0].strip('"').lower())
    return wynik


def main() -> None:
    zrodlo = open(sys.argv[1], encoding="utf-8").read()
    print("SET client_min_messages = warning;")
    print("CREATE SCHEMA IF NOT EXISTS src;")
    for tabela in sys.argv[2:]:
        m = re.search(r"^CREATE TABLE " + re.escape(tabela) + r" \((.*?)^\);", zrodlo, re.S | re.M)
        if not m:
            sys.exit(f"Brak tabeli {tabela} w CreateTables.sql")
        kol = kolumny(m.group(1))
        print(f"DROP TABLE IF EXISTS src.{tabela};")
        print(f"CREATE UNLOGGED TABLE src.{tabela} ({', '.join(f'{k} text' for k in kol)});")


if __name__ == "__main__":
    main()
