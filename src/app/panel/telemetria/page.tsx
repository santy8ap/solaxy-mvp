import type { Metadata } from "next";
import { Telemetry } from "@/components/panel/telemetry";

export const metadata: Metadata = { title: "Telemetría" };

export default function TelemetryPage() {
  return <Telemetry />;
}
