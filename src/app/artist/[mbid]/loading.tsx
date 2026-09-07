import { DetailSkeleton } from "@/components/skeleton";
export default function Loading() {
  return <DetailSkeleton note="Czytam dane z MusicBrainz — przy pierwszym wejściu potrafi to potrwać kilka sekund (limit 1 zapytanie/s)." />;
}
