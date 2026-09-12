import { redirect } from "next/navigation";

/**
 * Stary adres „podróży w nieznane".
 *
 * Ekran przeniósł się do własnej zakładki (/rozmowa) i zmienił charakter:
 * zamiast jednego strzału w zamkniętą listę jest szukanie, w którym da się
 * dopytać i zawęzić, a podróż powstaje dopiero z tego, co się uzbierało.
 * Adres zostaje przekierowaniem, bo ktoś mógł go sobie zapisać.
 */
export default async function StaraNieznane({ searchParams }: { searchParams: Promise<{ opis?: string }> }) {
  const opis = (await searchParams).opis;
  redirect(opis ? `/rozmowa?opis=${encodeURIComponent(opis)}` : "/rozmowa");
}
