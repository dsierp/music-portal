import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import Spotify from "next-auth/providers/spotify";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SPOTIFY_SCOPES } from "@/lib/spotify";

/** Dostawca jest włączony tylko, gdy ma ustawione klucze w env. */
function enabled(...keys: string[]) {
  return keys.every((k) => !!process.env[k]);
}

const providers: Provider[] = [];
if (enabled("AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET")) providers.push(Google);
if (enabled("AUTH_MICROSOFT_ENTRA_ID_ID", "AUTH_MICROSOFT_ENTRA_ID_SECRET"))
  providers.push(MicrosoftEntraID);
if (enabled("AUTH_APPLE_ID", "AUTH_APPLE_SECRET")) providers.push(Apple);
if (enabled("AUTH_FACEBOOK_ID", "AUTH_FACEBOOK_SECRET")) providers.push(Facebook);

/**
 * Spotify wchodzi jako dostawca logowania, ale służy do czegoś innego niż
 * reszta: to sposób, żeby użytkownik PODŁĄCZYŁ swoje konto do portalu.
 *
 * `allowDangerousEmailAccountLinking` jest tu świadome. Bez niego ktoś
 * zalogowany Google, kto klika „Połącz ze Spotify", dostaje błąd zamiast
 * połączenia — bo NextAuth broni się przed sklejeniem dwóch kont o tym samym
 * adresie. Ryzyko polega na zaufaniu, że dostawca zweryfikował adres; Spotify
 * to robi, a alternatywą byłoby drugie, osobne konto w portalu dla tej samej
 * osoby. Prosimy tylko o odczyt bieżącego utworu i tworzenie prywatnych list.
 */
if (enabled("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET")) {
  providers.push(
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      // Pełny adres, nie same parametry. Domyślnie Auth.js trzyma go przy tym
      // dostawcy jako goły napis z doklejonym zakresem; podanie samych `params`
      // nadpisuje ten napis obiektem bez adresu i logowanie kończy się „Invalid
      // URL", czyli ekranem „problem z konfiguracją serwera".
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
  );
}

if (process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Logowanie deweloperskie",
      credentials: { email: { label: "E-mail", type: "email" } },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email.includes("@")) return null;
        const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
        const user = existing ?? (await db.insert(schema.users).values({ email, name: email.split("@")[0] }).returning())[0];
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const providerList = providers.map((p) => {
  const meta = (typeof p === "function" ? p() : p) as { id: string; name: string; options?: { id?: string; name?: string } };
  return { id: meta.options?.id ?? meta.id, name: meta.options?.name ?? meta.name };
});

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers,
  // JWT: działa zarówno z OAuth (użytkownik zapisany w bazie przez adapter) jak i z logowaniem dev.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
  trustHost: true,
  /**
   * Auth.js pokazuje użytkownikowi tylko „problem with the server
   * configuration" i chowa prawdziwy powód — a każdy strzał w ciemno na
   * produkcji kosztuje wdrożenie. Ten logger wypisuje w logach serwera nazwę
   * błędu (MissingSecret, OperationProcessingError, InvalidCheck…) razem
   * z przyczyną, którą Auth.js pakuje w `cause.err`.
   */
  logger: {
    error(error) {
      const e = error as Error & { cause?: { err?: Error; provider?: string } };
      const inner = e?.cause?.err;
      console.error(
        `[auth] ${e?.name ?? "Error"}: ${e?.message ?? String(error)}` +
          (e?.cause?.provider ? ` (dostawca: ${e.cause.provider})` : "") +
          (inner ? `\n[auth] przyczyna: ${inner.name}: ${inner.message}` : ""),
      );
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/**
 * Zwraca zalogowanego użytkownika (id + email) albo null.
 *
 * Sesja jest w JWT (ciasteczko), więc PRZEŻYWA odtworzenie bazy — po
 * `npm run db:reset` wyglądasz na zalogowanego, choć Twojego wiersza w bazie
 * już nie ma. Odczyty wtedy działają, ale każdy zapis (ocena, ulubione,
 * komentarz) leci kluczem obcym na `user` i kończy się ekranem błędu.
 * Dlatego sprawdzamy, czy użytkownik faktycznie istnieje.
 *
 * Uwaga: gdy baza NIE ODPOWIADA, ufamy tokenowi i nie wylogowujemy —
 * chwilowa awaria bazy nie może wyrzucać ludzi z konta.
 */
export async function currentUser() {
  // `auth()` potrafi rzucić — uszkodzone albo przeterminowane ciasteczko sesji,
  // zmieniony sekret, chwilowa awaria dostawcy. Każda strona woła to na wejściu,
  // więc taki wyjątek zabierał CAŁY ekran, choć jedyny skutek braku sesji to
  // widok dla niezalogowanego. Traktujemy to jak „nikt nie jest zalogowany".
  const session = await auth().catch((e) => {
    console.error("[auth] nie udało się odczytać sesji:", e instanceof Error ? e.message : e);
    return null;
  });
  if (!session?.user?.id) return null;
  const me = { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? null, image: session.user.image ?? null };
  return (await userExists(me.id)) ? me : null;
}

/** true = jest w bazie, false = na pewno go nie ma, true przy błędzie bazy (patrz wyżej). */
async function userExists(id: string): Promise<boolean> {
  try {
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, id), columns: { id: true } });
    return !!row;
  } catch (e) {
    // Baza nie odpowiada — nie wyrzucamy nikogo z konta, ale zostawiamy ślad w logu.
    console.error("[auth] nie udało się sprawdzić użytkownika w bazie:", e instanceof Error ? e.message : e);
    return true;
  }
}

/** Jak currentUser, ale rzuca gdy brak logowania (do server actions). */
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("Musisz być zalogowany.");
  return u;
}
