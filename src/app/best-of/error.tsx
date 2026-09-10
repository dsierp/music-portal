"use client";
import { RouteError } from "@/components/route-error";

/** Granica błędu tego ekranu — patrz komentarz w route-error.tsx. */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError co="best of" {...props} />;
}
