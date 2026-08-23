import { assertSafePublicUrl, EVENT_IMAGE_HOSTS, readLimitedBytes } from "../../../lib/safe-fetch";

const MAX_IMAGE_BYTES = 5_000_000;

export async function GET(request: Request) {
  const candidate = new URL(request.url).searchParams.get("url");
  if (!candidate) return new Response("Missing image URL", { status: 400 });
  try {
    let url = assertSafePublicUrl(candidate, [...EVENT_IMAGE_HOSTS]);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000), cache: "no-store" });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error("Invalid image redirect");
        url = assertSafePublicUrl(new URL(location, url).toString(), [...EVENT_IMAGE_HOSTS]);
        continue;
      }
      if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!/^image\/(?:avif|gif|jpeg|png|webp)\b/.test(contentType)) throw new Error("Unsupported image content type");
      const body = await readLimitedBytes(response, MAX_IMAGE_BYTES);
      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable",
          "Content-Length": String(body.byteLength),
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  } catch (error) {
    console.warn("[image] proxy rejected image", error);
  }
  return new Response("Image unavailable", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
}
