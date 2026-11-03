import { connection } from "next/server";
import { PLANT } from "@/config/plant";
import { livePayload } from "@/lib/telemetry/live";

/** Telemetría en vivo por Server-Sent Events: una lectura cada 2 segundos. */
export async function GET(req: Request) {
  await connection();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(livePayload(PLANT, Date.now()))}\n\n`));
        } catch {
          clearInterval(timer);
        }
      };
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      send();
      timer = setInterval(send, 2000);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      });
    },
    cancel() {
      clearInterval(timer);
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
