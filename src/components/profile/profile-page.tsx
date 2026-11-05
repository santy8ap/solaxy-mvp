"use client";
import { FileCheck2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Topbar } from "@/components/panel/shell";
import { ProfileForm } from "./profile-form";

const WHY = [
  { icon: ShieldCheck, title: "Para que tus kW queden a tu nombre", text: "Tu participación en la planta se registra con tus datos, igual que en tu documento." },
  { icon: FileCheck2, title: "Para procesar tus pagos", text: "Wompi usa tu nombre, documento y celular para el pago con tarjeta, PSE o Nequi." },
  { icon: Lock, title: "Protegidos por la ley", text: "Solo los usamos para lo que dice la Política de Tratamiento de Datos (Ley 1581 de 2012)." },
];

export function ProfilePage() {
  return (
    <>
      <Topbar title="Mis datos" subtitle="Tus datos de inversionista. Los necesitamos antes de tu primera compra." />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6 sm:p-8" aria-label="Datos del inversionista">
          <ProfileForm onSaved={() => toast("Tus datos quedaron guardados.")} />
        </section>
        <aside className="panel cells p-6 sm:p-8" aria-label="Por qué te los pedimos">
          <h2 className="text-lg font-semibold text-silver-50">Por qué te los pedimos</h2>
          <ul className="mt-5 space-y-5">
            {WHY.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sun-400/10 text-sun-300">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-medium text-silver-50">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-silver-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
