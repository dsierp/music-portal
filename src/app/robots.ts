import type { MetadataRoute } from "next";

/**
 * Co wolno robotom wyszukiwarek.
 *
 * DLACZEGO TAK SKĄPO: każda strona artysty i płyty to kilkanaście–kilkadziesiąt
 * zapytań do MusicBrainz, Wikipedii i Spotify. Bez tego pliku roboty przeszły
 * po ponad trzystu tysiącach artystów w kilka tygodni — bufor urósł do 6,5 GB,
 * a kolejka MusicBrainz (jedno zapytanie na sekundę na cały portal) mieliła
 * dla nich całą dobę, zamiast dla ludzi.
 *
 * Wpuszczamy tylko strony, które stoją na naszej własnej bazie: główną,
 * premiery, best of i opis portalu. Roboty, które tego pliku nie czytają,
 * zatrzymuje `middleware.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/premiery", "/best-of", "/o-portalu", "/pomoc"],
      disallow: "/",
    },
  };
}
