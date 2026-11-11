"use client";
import {
  ArrowUpRight,
  Building2,
  Check,
  FileText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { AccountActions, Topbar } from "@/components/panel/shell";
import { useUser } from "@/components/panel/user-context";
import { toast } from "@/components/ui/toast";
import { ProfileForm, useProfile } from "./profile-form";

export function ProfilePage() {
  const user = useUser();
  const { data, loaded } = useProfile();
  const complete = Boolean(data?.profile?.complete);
  const name = data?.profile?.fullName || user.name;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="panel-view">
      <Topbar
        title="Tu cuenta, al día."
        subtitle="La información que identifica a tu empresa y sus operaciones."
      />
      <div className="profile-layout">
        <aside className="profile-identity">
          <span className="eyebrow">IN WORLD ENERGY / IDENTIDAD</span>
          <div className="profile-monogram" aria-hidden="true">
            {initials}
          </div>
          <h2>{name}</h2>
          <p className="profile-email">{user.email}</p>
          <span className={`profile-status ${complete ? "is-complete" : ""}`}>
            {complete ? <Check size={14} /> : <Building2 size={14} />}{" "}
            {loaded
              ? complete
                ? "Datos completos"
                : "Datos por completar"
              : "Cargando datos"}
          </span>
          <dl className="profile-facts">
            <div>
              <dt>Documento</dt>
              <dd>{data?.profile?.docType ?? "Por registrar"}</dd>
            </div>
            <div>
              <dt>Ciudad</dt>
              <dd>{data?.profile?.city ?? "Por registrar"}</dd>
            </div>
          </dl>
          <Link href="/panel/movimientos" className="text-link">
            Ver mi actividad <ArrowUpRight size={14} />
          </Link>
        </aside>
        <section
          className="account-section profile-form-section"
          aria-labelledby="profile-form-title"
        >
          <div className="account-section-heading">
            <div>
              <span className="eyebrow">01 / INFORMACIÓN DE LA CUENTA</span>
              <h2 id="profile-form-title">Tus datos, con claridad.</h2>
            </div>
            <FileText size={20} aria-hidden="true" />
          </div>
          <p className="section-note">
            Para una empresa, selecciona NIT y registra su razón social. Revisa
            los datos antes de guardarlos.
          </p>
          <ProfileForm
            submitLabel="Guardar información"
            onSaved={() => toast("La información de tu cuenta quedó guardada.")}
          />
        </section>
      </div>
      <div className="profile-notes">
        <div>
          <ShieldCheck size={19} />
          <p>
            <strong>Información bajo tu control.</strong>
            <span>
              Puedes consultar y actualizar estos datos desde tu cuenta.
            </span>
          </p>
        </div>
        <Link href="/privacidad" className="text-link">
          Política de tratamiento de datos <ArrowUpRight size={14} />
        </Link>
      </div>
      <AccountActions />
    </div>
  );
}
