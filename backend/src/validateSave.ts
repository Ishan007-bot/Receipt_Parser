import type { ParsedReceipt } from "./types.js";

// Lightweight guard for the save payload. The client sends a corrected receipt;
// we shape it into a clean ParsedReceipt so we never persist junk (extra keys,
// wrong types) into the JSON file.
//
// Returns { ok, receipt } or { ok: false, error }.
export function validateSavePayload(
  body: unknown
): { ok: true; receipt: ParsedReceipt } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a receipt object." };
  }
  const b = body as Record<string, unknown>;

  const num = (v: unknown): number | null =>
    typeof v === "number" && !Number.isNaN(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;

  const lineItems = Array.isArray(b.lineItems)
    ? b.lineItems
        .filter((it) => it && typeof it === "object")
        .map((it) => {
          const o = it as Record<string, unknown>;
          return { name: str(o.name) ?? "", amount: num(o.amount) };
        })
        .filter((it) => it.name !== "")
    : [];

  return {
    ok: true,
    receipt: {
      merchant: str(b.merchant),
      date: str(b.date),
      lineItems,
      subtotal: num(b.subtotal),
      tax: num(b.tax),
      tip: num(b.tip),
      total: num(b.total),
      lowConfidenceFields: Array.isArray(b.lowConfidenceFields)
        ? (b.lowConfidenceFields.filter((x) => typeof x === "string") as string[])
        : [],
    },
  };
}
