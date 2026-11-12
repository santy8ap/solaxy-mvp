"use client";
import { AlertSettings } from "./alert-settings";
import { ConfigChecklist } from "./config-checklist";
import { AdminTopbar } from "./shell";
import { SupportSettingsForm } from "./support-settings";
import { TransferSettingsForm } from "./transfer-settings";

/** Todo lo que se configura una vez: lo que falta para cobrar, la cuenta bancaria, el soporte y las alertas. */
export function AdminSettings() {
  return (
    <>
      <AdminTopbar title="Configuración" subtitle="Lo que necesita la página para cobrar dinero real y los datos que ven los comercializadores." />
      <ConfigChecklist className="" />
      <TransferSettingsForm />
      <SupportSettingsForm />
      <AlertSettings />
    </>
  );
}
