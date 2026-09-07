import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-5xl">404</h1>
      <p className="mt-2 text-muted">Nie ma takiej strony ani takiego MBID.</p>
      <Link href="/szukaj" className="btn mt-6">Szukaj</Link>
    </div>
  );
}
