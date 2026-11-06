import type { NetworkInterfaceInfo } from "node:os";

const WIFI_NAME = /wi-?fi|wlan|wireless/i;
const HOTSPOT = /^192\.168\.137\./;
/** 169.254 means the adapter has no network. 192.168.56 is VirtualBox, which phones cannot reach. */
const UNREACHABLE = /^(169\.254|192\.168\.56)\./;

function rank(name: string, address: string): number {
  if (WIFI_NAME.test(name)) return 0;
  return HOTSPOT.test(address) ? 1 : 2;
}

/** The address of this computer that a phone on the same network can most likely open. */
export function pickNetworkAddress(interfaces: Record<string, NetworkInterfaceInfo[] | undefined>): string | null {
  const reachable = Object.entries(interfaces)
    .flatMap(([name, entries]) => (entries ?? []).map((entry) => ({ name, ...entry })))
    .filter((entry) => entry.family === "IPv4" && !entry.internal && !UNREACHABLE.test(entry.address))
    .sort((a, b) => rank(a.name, a.address) - rank(b.name, b.address));
  return reachable[0]?.address ?? null;
}
