type TextFetchOptions = {
  headers?: HeadersInit;
  timeoutMs: number;
  maxBytes: number;
  contentTypes?: string[];
  allowedHosts?: string[];
};

export { EVENT_IMAGE_HOSTS } from "./image-hosts.ts";

function privateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

export function assertSafePublicUrl(raw: string, allowedHosts?: string[]) {
  const url = new URL(raw);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Only public HTTPS URLs on port 443 are allowed");
  }
  if (
    hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
    hostname.endsWith(".internal") || hostname === "metadata.google.internal" || privateIpv4(hostname) ||
    hostname === "::1" || hostname.startsWith("::ffff:") || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80")
  ) {
    throw new Error("Private network URLs are not allowed");
  }
  if (allowedHosts?.length && !allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error(`Host is not allowed: ${hostname}`);
  }
  return url;
}

export async function readLimitedBytes(response: Response, maxBytes: number) {
  if (!response.body) return new Uint8Array();
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchPublicText(raw: string, options: TextFetchOptions): Promise<string> {
  let url = assertSafePublicUrl(raw, options.allowedHosts);
  const deadline = Date.now() + options.timeoutMs;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new DOMException("Request timed out", "TimeoutError");
    const response = await fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(remainingMs),
      redirect: "manual",
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Too many or invalid redirects");
      url = assertSafePublicUrl(new URL(location, url).toString(), options.allowedHosts);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (options.contentTypes?.length && !options.contentTypes.some((type) => contentType.includes(type))) {
      throw new Error(`Unexpected content type: ${contentType || "missing"}`);
    }
    return new TextDecoder().decode(await readLimitedBytes(response, options.maxBytes));
  }
  throw new Error("Request did not complete");
}

export const EVENT_PAGE_HOSTS = [
  "buffalolib.libcal.com", "everythingop.com", "orchardparkchamber.org", "buffalorising.com",
  "orchardparkny.gov", "townofevansny.gov", "southtownsregionalchamber.org", "exploreandmore.org",
  "stepoutbuffalo.com", "eanycc.com", "erie.gov", "ticketmaster.com", "ecfair.org", "buffalozoo.org",
  "wnyrhs.org", "villageofhamburgny.gov", "westseneca.gov", "buffalobills.com", "bfloparks.org",
] as const;
