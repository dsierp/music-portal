import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { markVisited, type ListTarget } from "@/lib/user-data";

/**
 * Wyjście z przystanku do Spotify albo Tidala — po drodze odhaczamy pozycję.
 *
 * Po to jest ta trasa: „odsłuchane" ma się brać z tego, co człowiek i tak robi,
 * a nie z pamiętania o ptaszku. Adres docelowy przyjmujemy tylko wtedy, gdy
 * prowadzi do znanego serwisu — inaczej byłaby to otwarta przekierowywarka,
 * którą ktoś podpiąłby pod własną stronę.
 */
const DOZWOLONE = ["open.spotify.com", "tidal.com", "listen.tidal.com", "bandcamp.com"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") ?? "";
  let cel: URL;
  try {
    cel = new URL(to);
  } catch {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  const host = cel.hostname.replace(/^www\./, "");
  if (cel.protocol !== "https:" || !DOZWOLONE.some((d) => host === d || host.endsWith(`.${d}`))) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const listId = sp.get("listId");
  const type = sp.get("type") as ListTarget | null;
  const mbid = sp.get("mbid");
  if (listId && mbid && (type === "ALBUM" || type === "ARTIST" || type === "CONCERT")) {
    const user = await currentUser().catch(() => null);
    // Odhaczenie jest miłym dodatkiem, nie warunkiem wyjścia: gdy się nie uda,
    // człowiek i tak ma trafić tam, gdzie kliknął.
    if (user) await markVisited(user.id, listId, type, mbid, "link").catch(() => {});
  }
  return NextResponse.redirect(cel.toString());
}
