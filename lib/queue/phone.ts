import { createHmac, randomBytes } from "node:crypto";
import { getSetting, setSetting } from "@/lib/clock";
import type { Db } from "@/lib/db/client";

/** Keyed hash, so the stored value cannot be reversed by trying every phone number. */
export function hashPhone(db: Db, phone: string): string {
  let secret = getSetting(db, "phone_secret");
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    setSetting(db, "phone_secret", secret);
  }
  return createHmac("sha256", secret).update(phone).digest("hex");
}
