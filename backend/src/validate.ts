import type { ParsedReceipt, LineItem } from "./types.js";

// Turns the LLM's raw text response into a trusted, typed ParsedReceipt.
// The LLM sometimes wraps JSON in ```json fences or returns slightly-off
// shapes, so we clean and validate here instead of trusting it blindly.
//
// Throws if the response can't be parsed as JSON at all — the caller decides
// whether to retry or fail loudly.

export function parseReceiptResponse(raw: string): ParsedReceipt {
  const cleaned = stripCodeFences(raw).trim();

  let obj: any;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    throw new Error("LLM did not return valid JSON");
  }

  return {
    merchant: asStringOrNull(obj.merchant),
    date: asStringOrNull(obj.date),
    lineItems: asLineItems(obj.lineItems),
    subtotal: asNumberOrNull(obj.subtotal),
    tax: asNumberOrNull(obj.tax),
    tip: asNumberOrNull(obj.tip),
    total: asNumberOrNull(obj.total),
    lowConfidenceFields: asStringArray(obj.lowConfidenceFields),
  };
}

// Gemini sometimes returns ```json ... ``` despite being told not to.
function stripCodeFences(text: string): string {
  return text.replace(/```(?:json)?/gi, "").replace(/```/g, "");
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asLineItems(v: unknown): LineItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      name: asStringOrNull(item.name) ?? "",
      amount: asNumberOrNull(item.amount),
    }))
    .filter((item) => item.name !== ""); // drop empty rows
}
