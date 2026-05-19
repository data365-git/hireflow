import { requireSession } from "@/lib/auth/session";
import { subscribe } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();

  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch {}
      }, 25_000);

      unsub = await subscribe("role-permissions", (ev) => {
        if (ev.type === "user-role-assigned" && ev.userId !== session.sub) return;
        try { send(ev); } catch {}
      });

      controller.enqueue(enc.encode(`event: connected\ndata: ok\n\n`));
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsub) unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
