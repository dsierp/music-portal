import { redirect } from "next/navigation";
import { currentUser, providerList } from "@/lib/auth";
import { loginDev, loginWith } from "@/app/actions";

const LABELS: Record<string, string> = { google: "Google", "microsoft-entra-id": "Microsoft", apple: "Apple", facebook: "Facebook" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  if (await currentUser()) redirect("/ja");
  const { callbackUrl = "/" } = await searchParams;
  const oauth = providerList.filter((p) => p.id !== "dev");
  const dev = providerList.some((p) => p.id === "dev");
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl">Zaloguj się</h1>
      <p className="mt-2 text-sm text-muted">Nie zakładasz konta — logujesz się kontem, które już masz. Zapamiętujemy Twój e-mail, preferencje, oceny i komentarze.</p>
      <div className="mt-6 flex flex-col gap-2">
        {oauth.map((p) => (
          <form key={p.id} action={loginWith.bind(null, p.id, callbackUrl)}>
            <button className="btn w-full justify-center py-2">Kontynuuj z {LABELS[p.id] ?? p.name}</button>
          </form>
        ))}
        {!oauth.length && <p className="text-sm text-warn">Brak skonfigurowanych dostawców logowania — uzupełnij klucze w <code>.env</code>.</p>}
      </div>
      {dev && (
        <form action={loginDev} className="mt-8 border-t border-rule pt-4">
          <div className="label mb-2">Logowanie deweloperskie (tylko lokalnie)</div>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input name="email" type="email" required placeholder="twoj@email" className="input" />
          <button className="btn mt-2">Wejdź</button>
        </form>
      )}
    </div>
  );
}
