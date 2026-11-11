"use client";
import { Topbar } from "@/components/panel/shell";
import { toast } from "@/components/ui/toast";
import { ProfileForm } from "./profile-form";

const WHY = [
  { title: "Para identificarte como comercializador", text: "Usamos tu nombre completo y tu documento personal para asociar los paquetes a tu cuenta." },
  { title: "Para mantener tus datos al día", text: "Registra tu celular y tu ciudad de residencia. El correo es el asociado a tu cuenta." },
  { title: "Protegidos por la ley", text: "Solo los usamos para lo que dice la Política de Tratamiento de Datos (Ley 1581 de 2012)." },
];

export function ProfilePage() {
  return (
    <>
      <Topbar title="Comercializador" subtitle="Tus datos personales como titular de los paquetes. Los necesitamos antes del primer pago." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-12 border-t border-line-strong pt-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="Datos personales del comercializador">
          <ProfileForm onSaved={() => toast("Tus datos personales quedaron guardados.")} />
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
