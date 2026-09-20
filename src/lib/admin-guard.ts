import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

/**
 * Wartownia stron diagnostycznych — jedna na wszystkie.
 *
 * Te same cztery linijki stały w każdej diagnostyce z osobna. Nie jest to
 * kwestia elegancji: gdyby kiedyś trzeba było zmienić warunek (inne konto,
 * dodatkowy log, inny kod odpowiedzi), zmiana w trzech z czterech miejsc
 * zostawia czwarte otwarte — a to strony, które mówią o konfiguracji portalu.
 *
 * Zwraca gotową odpowiedź „nie wolno" albo `null`, gdy wolno.
 */
export async function odmowaDlaNieadmina(): Promise<NextResponse | null> {
  const user = await currentUser().catch(() => null);
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "tylko administrator" }, { status: 403 });
  }
  return null;
}

/** Ten sam warunek, ale gdy strona potrzebuje też samego użytkownika. */
export async function adminAlboOdmowa(): Promise<{ user: { id: string; email: string | null } } | { odmowa: NextResponse }> {
  const user = await currentUser().catch(() => null);
  if (!user || !isAdmin(user.email)) {
    return { odmowa: NextResponse.json({ error: "tylko administrator" }, { status: 403 }) };
  }
  return { user };
}
