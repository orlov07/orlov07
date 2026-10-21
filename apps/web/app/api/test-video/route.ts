import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getVideoPath() {
  const configured = process.env.SETRA_TEST_VIDEO_PATH;
  const candidates = [
    configured,
    path.resolve(process.cwd(), "services/vision-ai/videos/NJhf7IKOjKk.mp4"),
    path.resolve(process.cwd(), "../../services/vision-ai/videos/NJhf7IKOjKk.mp4"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find(existsSync);
}

export async function GET(request: NextRequest) {
  const videoPath = getVideoPath();
  if (!videoPath) return new Response("Vídeo de teste não encontrado.", { status: 404 });

  const size = statSync(videoPath).size;
  const range = request.headers.get("range");
  const match = range?.match(/bytes=(\d+)-(\d*)/);
  const start = match ? Number(match[1]) : 0;
  const requestedEnd = match?.[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);

  if (start < 0 || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }

  const body = Readable.toWeb(createReadStream(videoPath, { start, end })) as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Type": "video/mp4",
      "Cache-Control": "private, no-store",
    },
  });
}
