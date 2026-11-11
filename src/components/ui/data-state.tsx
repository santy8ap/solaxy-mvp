import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { signInHref } from "@/lib/navigation";

export function DataError({
  message,
  onRetry,
  stale = false,
}: {
  message: string;
  onRetry(): void;
  stale?: boolean;
}) {
  return (
    <div className="data-error" role="status">
      <div>
        <strong>
          {stale
            ? "No pudimos actualizar los datos."
            : "No pudimos cargar esta información."}
        </strong>
        <p>
          {stale ? "Estás viendo la última información disponible. " : ""}
          {message}
        </p>
      </div>
      {message.includes("Sesión expirada") ? (
        <Link href={signInHref("/panel")} className="btn btn-sun">
          Iniciar sesión
        </Link>
      ) : (
        <button type="button" onClick={onRetry} className="btn btn-ghost">
          <RefreshCw size={14} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function DataSkeleton({
  label = "Cargando información",
}: {
  label?: string;
}) {
  return (
    <div className="data-skeleton" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div />
      <div />
      <div />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark" aria-hidden="true">
        ↗
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && action && (
        <Link href={href} className="text-link">
          {action}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
