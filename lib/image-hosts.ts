/** Remote image origins trusted by both the API and Next.js image optimizer. */
export const EVENT_IMAGE_HOSTS = [
  "everythingop.com",
  "orchardparkchamber.org",
  "buffalorising.com",
  "stepoutbuffalo.com",
  "eanycc.com",
  "growthzoneapp.com",
  "erie.gov",
  "ticketm.net",
  "exploreandmore.org",
  "buffalolib.org",
] as const;

export function isAllowedEventImage(raw: string) {
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      EVENT_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
