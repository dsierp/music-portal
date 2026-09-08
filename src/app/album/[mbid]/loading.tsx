import { DetailSkeleton } from "@/components/skeleton";
import { i18n } from "@/lib/t";

export default async function Loading() {
  const { t } = await i18n();
  return <DetailSkeleton note={t.common.detailLoading} />;
}
