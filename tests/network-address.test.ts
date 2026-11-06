import type { NetworkInterfaceInfo } from "node:os";
import { expect, test } from "vitest";
import { pickNetworkAddress } from "@/lib/network-address";
import { qrOrigin } from "@/lib/queue/track-link";

const ipv4 = (address: string, internal = false) =>
  ({ address, family: "IPv4", internal, netmask: "255.255.255.0", mac: "", cidr: null }) as NetworkInterfaceInfo;

test("Wi-Fi wins over a VirtualBox adapter listed first, like on the demo laptop", () => {
  expect(
    pickNetworkAddress({
      "Ethernet 3": [ipv4("192.168.56.1")],
      "Wi-Fi": [ipv4("192.168.1.102")],
      "Loopback Pseudo-Interface 1": [ipv4("127.0.0.1", true)],
    }),
  ).toBe("192.168.1.102");
});

test("a laptop hotspot is used when there is no Wi-Fi address", () => {
  expect(
    pickNetworkAddress({ "Ethernet 3": [ipv4("192.168.56.1")], "Local Area Connection* 2": [ipv4("192.168.137.1")] }),
  ).toBe("192.168.137.1");
});

test("a wired network works when it is the only real one", () => {
  expect(pickNetworkAddress({ Ethernet: [ipv4("10.0.0.5")], "Ethernet 3": [ipv4("192.168.56.1")] })).toBe("10.0.0.5");
});

test.each([
  ["nothing but loopback", { Loopback: [ipv4("127.0.0.1", true)] }],
  ["only a VirtualBox adapter", { "Ethernet 3": [ipv4("192.168.56.1")] }],
  ["a self-assigned address", { Ethernet: [ipv4("169.254.3.9")] }],
])("no address a phone could reach: %s", (_name, interfaces) => {
  expect(pickNetworkAddress(interfaces)).toBeNull();
});

test("a page on localhost uses the network address, keeping the port", () => {
  expect(qrOrigin({ origin: "http://localhost:3000", hostname: "localhost", protocol: "http:", port: "3000" }, "192.168.1.102")).toBe(
    "http://192.168.1.102:3000",
  );
});

test("a page already on a network address keeps it", () => {
  expect(
    qrOrigin({ origin: "http://192.168.1.102:3000", hostname: "192.168.1.102", protocol: "http:", port: "3000" }, "10.0.0.5"),
  ).toBe("http://192.168.1.102:3000");
});

test("localhost stays when no network address was found", () => {
  expect(qrOrigin({ origin: "http://localhost:3000", hostname: "localhost", protocol: "http:", port: "3000" }, null)).toBe(
    "http://localhost:3000",
  );
});
