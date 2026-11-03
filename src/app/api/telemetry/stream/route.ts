import { connection } from "next/server";
import { ensureReady } from "@/lib/db/init";
import { readConfig } from "@/lib/settings";
import { livePayload } from "@/lib/telemetry/live";

/** El servidor corta la conexión a los 4 minutos y el navegador se reconecta solo (evita el límite de 300 s de Vercel). */
const MAX_STREAM_MS = 4 * 60_000;

/** Telemetría en vivo por Server-Sent Events: una lectura cada 2 segundos. */
export async function GET(req: Request) {
  await connection();
  await ensureReady();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let stop: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        clearInterval(timer);
        clearTimeout(stop);
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };
      const send = async () => {
        try {
          const { spec, econ } = await readConfig();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(livePayload(spec, Date.now(), econ))}\n\n`));
        } catch {
          close();
        }
      };
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      void send();
      timer = setInterval(() => void send(), 2000);
      stop = setTimeout(close, MAX_STREAM_MS);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      clearInterval(timer);
      clearTimeout(stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
