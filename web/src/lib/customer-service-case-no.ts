import { randomBytes } from "crypto";

export function generateCustomerServiceCaseNo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `CS-${y}${m}${day}-${suffix}`;
}
