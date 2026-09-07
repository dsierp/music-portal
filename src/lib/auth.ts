import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

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
  const session = await auth();
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
