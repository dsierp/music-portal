import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/nav";
import { NavProgress } from "@/components/nav-progress";
import { i18n } from "@/lib/t";

/** Tytuł zostaje wspólny (to nazwa własna), opis idzie w języku czytelnika. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return {
    title: { default: "Pure New Shit — portal", template: "%s · Pure New Shit" },
    description: t.nav.siteDescription,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, t } = await i18n();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-faint">{t.nav.footer}</footer>
      </body>
    </html>
  );
}
