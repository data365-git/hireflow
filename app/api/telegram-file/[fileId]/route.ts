import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  // Auth check — only logged-in HR can fetch candidate photos
  try {
    await requirePermission("candidates", "read");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) return new NextResponse("Missing fileId", { status: 400 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new NextResponse("Bot not configured", { status: 503 });

  try {
    // Resolve file_path from Telegram
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const fileJson = (await fileRes.json()) as {
      ok: boolean;
      result?: { file_path?: string };
    };
    if (!fileJson.ok || !fileJson.result?.file_path) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Fetch the actual file content
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
    const imageRes = await fetch(fileUrl);
    if (!imageRes.ok) return new NextResponse("Upstream error", { status: 502 });

    // Stream back with safe headers — no bot token in URL
    const body = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3300", // ~55 min
      },
    });
  } catch (err) {
    console.error("[telegram-file proxy] error:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
