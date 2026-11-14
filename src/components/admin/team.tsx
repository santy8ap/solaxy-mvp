"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ADMIN_ROLE_LABEL, type AdminRole } from "@/lib/admin/roles";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatDate, formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { ErrorNote, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";

const TEAM_URL = "/api/admin/team";

interface Member {
  email: string;
  role: AdminRole;
  name: string | null;
  image: string | null;
  lastLoginAt: number | null;
  addedBy: string | null;
  addedAt: number | null;
  note: string | null;
}

/** Quién puede entrar a la administración: los propietarios (Vercel) y el equipo que ellos eligen. */
export function AdminTeam() {
  const { data, error } = useJson<{ team: Member[]; canManage: boolean; me: string }>(TEAM_URL);
  const [removing, setRemoving] = useState<Member | null>(null);
  const owners = data?.team.filter((m) => m.role === "propietario") ?? [];
  const members = data?.team.filter((m) => m.role === "administrador") ?? [];

  return (
    <>
      <AdminTopbar title="Equipo" subtitle="Quién puede entrar a la administración. Cada persona entra con su propia cuenta de Google: no hay PIN ni contraseñas compartidas." />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <div className="skeleton h-64" aria-busy="true" aria-label="Cargando el equipo" />}
      {data && (
        <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <section aria-labelledby="owners-title">
              <h2 id="owners-title" className="cap border-b border-line-strong pb-3">
                Propietarios
              </h2>
              <ul>
                {owners.map((m) => (
                  <MemberRow key={m.email} member={m} me={data.me} />
                ))}
              </ul>
              <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-mute">
                Administran todo y eligen al resto del equipo. Se definen en Vercel, en la variable ADMIN_EMAILS: así nadie puede quitarse ni agregarse a sí mismo desde aquí.
              </p>
            </section>

            <section className="mt-12" aria-labelledby="members-title">
              <h2 id="members-title" className="cap border-b border-line-strong pb-3">
                Administradores <span className="num">{members.length}</span>
              </h2>
              {members.length ? (
                <ul>
                  {members.map((m) => (
                    <MemberRow key={m.email} member={m} me={data.me} onRemove={data.canManage ? () => setRemoving(m) : undefined} />
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-sm text-mute">Todavía no le has dado acceso a nadie más.</p>
              )}
            </section>
          </div>

          <aside className="min-w-0">{data.canManage ? <AddMemberForm /> : <ReadOnlyNote />}</aside>
        </div>
      )}
      <RemoveDialog member={removing} onClose={() => setRemoving(null)} />
    </>
  );
}

function MemberRow({ member: m, me, onRemove }: { member: Member; me: string; onRemove?: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line py-5">
      <Avatar name={m.name ?? m.email} image={m.image} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {m.name ?? m.email}
          {m.email === me && <span className="ml-2 text-sm font-normal text-mute">(tú)</span>}
        </p>
        <p className="truncate text-sm text-mute">{m.name ? m.email : "Todavía no ha entrado"}</p>
        <p className="mt-1 text-xs leading-relaxed text-mute">
          {[
            m.note,
            m.lastLoginAt ? `Último ingreso: ${formatDateTime(m.lastLoginAt)}` : null,
            m.addedAt ? `Acceso desde el ${formatDate(m.addedAt)}${m.addedBy ? `, por ${m.addedBy}` : ""}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <span className="cap">{ADMIN_ROLE_LABEL[m.role]}</span>
      {onRemove && (
        <button type="button" className="link text-sm text-fog" onClick={onRemove}>
          Quitar acceso
        </button>
      )}
    </li>
  );
}

function AddMemberForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(TEAM_URL, { action: "agregar", email, note });
      toast(`${email.trim().toLowerCase()} ya puede entrar a la administración.`);
      setEmail("");
      setNote("");
      await refetch(TEAM_URL);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="border border-line-strong p-6 sm:p-7" aria-labelledby="add-title">
      <h2 id="add-title" className="text-xl font-medium">
        Dar acceso
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-fog">
        Escribe el correo de la cuenta de Google de la persona. Podrá entrar de inmediato en Ingresar › Administrador, y quitarle el acceso también vale de inmediato.
      </p>
      <form className="mt-6 space-y-5" onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Correo de Google">
          {(id, aria) => <input id={id} {...aria} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="nombre@gmail.com" className="field" />}
        </Field>
        <Field label="Para qué (opcional)" hint="Por ejemplo: Contabilidad, Operaciones.">
          {(id, aria) => <input id={id} {...aria} value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} autoComplete="off" className="field" />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" className="btn btn-solid w-full" disabled={busy || !email.includes("@")}>
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Guardando…
            </>
          ) : (
            "Dar acceso de administrador"
          )}
        </button>
      </form>
      <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-mute">
        Un administrador ve los datos de todos los clientes y aprueba pagos y retiros. Dale acceso solo a quien lo necesite, y pídele que active la verificación en dos pasos de su cuenta de Google.
        Cada cambio queda en Actividad y les llega por correo a los propietarios.
      </p>
    </section>
  );
}

function ReadOnlyNote() {
  return (
    <section className="border border-line p-6 text-sm leading-relaxed text-fog">
      Solo un propietario puede dar o quitar acceso. Si alguien más necesita entrar, pídeselo a uno de ellos.
    </section>
  );
}

function RemoveDialog({ member, onClose }: { member: Member | null; onClose(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!member) return null;
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson(TEAM_URL, { action: "quitar", email: member.email });
      toast(`${member.email} ya no puede entrar a la administración.`);
      await refetch(TEAM_URL);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Quitar el acceso">
      <p className="leading-relaxed text-fog">
        <strong className="font-medium text-ink">{member.name ?? member.email}</strong> dejará de poder entrar a la administración de inmediato, aunque tenga la sesión abierta. Su cuenta de comercializador,
        si tiene una, no cambia.
      </p>
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
      <div className="mt-7 flex justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn btn-solid" onClick={() => void confirm()} disabled={busy}>
          {busy ? "Quitando…" : "Quitar el acceso"}
        </button>
      </div>
    </Modal>
  );
}
