const LOCAL_ONLY_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The address a patient scans to follow their token on their own phone. */
export function trackUrl(origin: string, code: string): string {
  return `${origin}?token=${encodeURIComponent(code)}`;
}

/** Where a `?token=` link should land, or null if there is no usable token. */
export function tokenPathFromParam(token: string | string[] | undefined): string | null {
  if (typeof token !== "string") return null;
  const code = token.trim();
  return code ? `/t/${encodeURIComponent(code)}` : null;
}

/** A phone cannot open these addresses, because they point back at the phone itself. */
export function isLocalOnlyHost(hostname: string): boolean {
  return LOCAL_ONLY_HOSTS.has(hostname);
}

type PageLocation = Pick<Location, "origin" | "hostname" | "protocol" | "port">;

/** The origin to put in a QR code. A page on localhost borrows this computer's network address. */
export function qrOrigin(page: PageLocation, networkAddress: string | null): string {
  if (!networkAddress || !isLocalOnlyHost(page.hostname)) return page.origin;
  return `${page.protocol}//${networkAddress}${page.port ? `:${page.port}` : ""}`;
}
