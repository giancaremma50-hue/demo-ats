"use client";

import { ERROR_CATALOG } from "@/lib/errors/catalog";
import { ErrorCard } from "@/components/errors/error-card";
import { ActionButton } from "@/components/ui/action-button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const technicalDetail = error.digest ? `${error.message}\n(digest: ${error.digest})` : error.message;

  return (
    <ErrorCard entry={ERROR_CATALOG.desconocido} motivo="desconocido" technicalDetail={technicalDetail}>
      <ActionButton type="button" onClick={reset}>
        Reintentar
      </ActionButton>
    </ErrorCard>
  );
}
