"use client";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/toast";

export function ReceiptButton({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/receipts/${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ??
            "No pudimos descargar el comprobante. Inténtalo de nuevo.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `comprobante-${id}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void download()}
      className={
        compact
          ? "link inline-flex items-center gap-2 text-sm text-fog"
          : "btn btn-ghost"
      }
    >
      {busy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <Download size={15} />
      )}
      {busy ? "Preparando PDF…" : "Comprobante PDF"}
    </button>
  );
}
