"use client";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { ErrorNote } from "@/components/ui/field";
import { Topbar } from "./shell";
import { useNotices } from "./use-notices";

export function NotificationsPage() {
  const { notices, seen, markRead, unread, error, loaded } = useNotices();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const visible = onlyUnread
    ? notices.filter((item) => !seen.has(item.id))
    : notices;
  return (
    <>
      <Topbar
        title="Tus avisos"
        subtitle="Pagos, retiros y próximas mensualidades en un solo lugar."
      />
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong pb-5">
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={!onlyUnread}
            className={`btn ${!onlyUnread ? "btn-solid" : "btn-ghost"}`}
            onClick={() => setOnlyUnread(false)}
          >
            Todos
          </button>
          <button
            type="button"
            aria-pressed={onlyUnread}
            className={`btn ${onlyUnread ? "btn-solid" : "btn-ghost"}`}
            onClick={() => setOnlyUnread(true)}
          >
            Sin leer{unread ? ` (${unread})` : ""}
          </button>
        </div>
        <button
          type="button"
          className="link inline-flex items-center gap-2 text-sm text-fog disabled:opacity-40"
          disabled={!unread}
          onClick={() => markRead(notices.map((item) => item.id))}
        >
          <CheckCheck size={16} /> Marcar todos como leídos
        </button>
      </div>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      {!loaded ? (
        <div className="skeleton mt-7 h-64" aria-busy="true" />
      ) : !visible.length ? (
        <p className="py-16 text-mute">
          {onlyUnread
            ? "Estás al día. No tienes avisos sin leer."
            : "Aquí aparecerán las confirmaciones de tus pagos, el estado de los retiros y los avisos de la próxima mensualidad."}
        </p>
      ) : (
        <ul>
          {visible.map((item) => (
            <li key={item.id} className="border-b border-line py-7">
              <div className="flex items-start gap-4">
                <span
                  className={`mt-2 h-1.5 w-1.5 shrink-0 ${seen.has(item.id) ? "bg-line-strong" : "bg-ink"}`}
                  aria-label={seen.has(item.id) ? "Leído" : "Sin leer"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium">{item.title}</p>
                  <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-fog">
                    {item.detail}
                  </p>
                  <p className="num mt-3 text-xs text-mute">
                    {formatDateTime(item.at)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-6">
                    <Link
                      href={item.href}
                      className="link text-sm"
                      onClick={() => markRead([item.id])}
                    >
                      {item.action}
                    </Link>
                    {!seen.has(item.id) && (
                      <button
                        type="button"
                        className="link text-sm text-mute"
                        onClick={() => markRead([item.id])}
                      >
                        Marcar como leído
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
