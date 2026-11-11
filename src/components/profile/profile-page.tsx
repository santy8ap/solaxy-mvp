"use client";
import { Topbar } from "@/components/panel/shell";
import { toast } from "@/components/ui/toast";
import { ProfileForm } from "./profile-form";

const WHY = [
  { title: "Para que el plan quede a nombre de tu empresa", text: "El contrato de energía se hace con la razón social y el NIT que registres aquí." },
  { title: "Para pagarte", text: "Los retiros solo se pagan a cuentas bancarias a nombre de la empresa." },
  { title: "Protegidos por la ley", text: "Solo los usamos para lo que dice la Política de Tratamiento de Datos (Ley 1581 de 2012)." },
];

export function ProfilePage() {
  return (
    <>
      <Topbar title="Empresa" subtitle="Los datos de tu empresa y de su representante legal. Los necesitamos antes del primer pago." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-12 border-t border-line-strong pt-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="Datos de la empresa">
          <ProfileForm onSaved={() => toast("Los datos de la empresa quedaron guardados.")} />
        </section>
        <aside aria-label="Por qué los pedimos">
          <h2 className="text-xl font-medium">Por qué los pedimos</h2>
          <ul className="mt-5 border-t border-line">
            {WHY.map(({ title, text }) => (
              <li key={title} className="border-b border-line py-5">
                <p>{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">{text}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
