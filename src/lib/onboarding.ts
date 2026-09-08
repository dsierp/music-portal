/**
 * Powitanie przy pierwszym logowaniu.
 *
 * Nowy użytkownik nie ma jeszcze żadnego stylu, a od stylów zależy w portalu
 * prawie wszystko: oprawa graficzna, kolejność kategorii w premierach, newsy
 * o składach. Dlatego po pierwszym wejściu prowadzimy go do wyboru gatunków
 * zamiast pokazywać domyślny widok „dla nikogo".
 *
 * Kto nie chce wybierać teraz, klika „później" — ciasteczko trzyma tę decyzję
 * i portal drugi raz nie zaczepia. Świadomie ciasteczko, nie kolumna w bazie:
 * to preferencja przeglądarki, nie fakt o użytkowniku, i nie warto za nią
 * płacić migracją.
 */
export const SKIP_ONBOARDING = "pns_witaj_off";
