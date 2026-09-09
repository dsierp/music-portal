import { redirect } from "next/navigation";

/**
 * Stary adres list. Ktoś mógł go mieć w zakładkach albo wysłać komuś linkiem,
 * zanim listy stały się podróżami — więc nie kasujemy trasy, tylko kierujemy
 * dalej. Kotwicę (#dziennik) przeglądarka zachowuje sama.
 */
export default function Listy() {
  redirect("/podroze");
}
