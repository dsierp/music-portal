/**
 * Słownik portalu — jeden plik na ekran, w każdym cztery języki obok siebie.
 *
 * Czemu tak, a nie plik na język: przy dokładaniu napisu widać od razu wszystkie
 * cztery wersje, a brak tłumaczenia wywala build (typ bierzemy z polskiego),
 * zamiast pokazywać komuś w Madrycie polski komunikat.
 */
import type { Locale } from "@/lib/i18n";
import { album } from "./album";
import { artist } from "./artist";
import { auth } from "./auth";
import { common } from "./common";
import { concerts } from "./concerts";
import { genres } from "./genres";
import { home } from "./home";
import { lists } from "./lists";
import { nav } from "./nav";
import { profile } from "./profile";
import { releases } from "./releases";
import { search } from "./search";

export function dict(locale: Locale) {
  return {
    album: album[locale],
    artist: artist[locale],
    auth: auth[locale],
    common: common[locale],
    concerts: concerts[locale],
    genres: genres[locale],
    home: home[locale],
    lists: lists[locale],
    nav: nav[locale],
    profile: profile[locale],
    releases: releases[locale],
    search: search[locale],
  };
}
export type Dict = ReturnType<typeof dict>;

/**
 * Etykieta kategorii w wybranym języku, z bezpiecznym odwrotem: nieznany slug
 * (np. świeżo dobrany z MusicBrainz) pokazujemy tak, jak przyszedł.
 */
export function genreLabel(slug: string, d: Dict, fallback?: string): string {
  const g = d.genres as Record<string, string>;
  return g[slug] ?? fallback ?? slug;
}
