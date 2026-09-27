import { NextResponse, type NextRequest } from "next/server";

/**
 * Bramka dla robotów na drogich stronach.
 *
 * `robots.txt` to prośba — porządne wyszukiwarki jej słuchają, zbieracze
 * danych do modeli językowych i narzędzia SEO często nie. Na stronach, które
 * pytają zewnętrzne serwisy (artysta, płyta, szukanie, koncerty), taki gość
 * dostaje krótką odmowę, zanim portal zdąży cokolwiek pobrać.
 *
 * WYJĄTEK: podglądy linków. Kiedy ktoś wkleja płytę na Messengera, Slacka czy
 * WhatsAppa, ich robot pobiera stronę, żeby pokazać tytuł i okładkę. To są
 * pojedyncze wejścia wywołane przez człowieka — przepuszczamy.
 */
const PODGLADY = /facebookexternalhit|facebookcatalog|twitterbot|slackbot|whatsapp|telegrambot|discordbot|linkedinbot|skypeuripreview|iframely|embedly|redditbot|mastodon|signal/i;

const ROBOTY =
  /bot\b|bot\/|crawl|spider|slurp|scrap|archiver|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|claude-web|anthropic|ccbot|perplexity|amazonbot|applebot|yandex|baidu|dataforseo|serpstat|barkrowler|meta-externalagent|imagesift|python-requests|go-http-client|curl\/|wget|headless/i;

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || (ROBOTY.test(ua) && !PODGLADY.test(ua))) {
    return new NextResponse("Ta strona nie jest dla robotów. Zobacz /robots.txt.\n", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/artist/:path*", "/album/:path*", "/szukaj", "/go/:path*", "/koncerty", "/grane/:path*", "/podroz/:path*"],
};
