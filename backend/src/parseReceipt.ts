import { GoogleGenerativeAI } from "@google/generative-ai";
import { RECEIPT_PROMPT } from "./prompt.js";
import { parseReceiptResponse } from "./validate.js";
import type { ParsedReceipt } from "./types.js";

// All Gemini-specific code lives here. If we ever swap models, this is the
// only file that changes.

// The free tier has a low per-minute limit. Since a user might upload a few
// receipts quickly, we allow an OPTIONAL list of keys and rotate to the next
// one when we hit a rate-limit (429). Falls back to the single key.
//
//   GEMINI_API_KEYS=key1,key2,key3   (preferred if you have spares)
//   GEMINI_API_KEY=key1              (fallback / simplest)
const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

if (keys.length === 0) {
  throw new Error(
    "No Gemini key found. Copy .env.example to .env and set GEMINI_API_KEY (or GEMINI_API_KEYS)."
  );
}

// One reusable client + model per key.
// "gemini-flash-latest" always points at the current Flash model: has vision,
// fast, and free-tier friendly.
const models = keys.map((key) =>
  new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-flash-latest" })
);

function isRateLimit(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return msg.includes("429") || /rate.?limit|quota|too many requests/i.test(msg);
}

// Sends the image to Gemini and returns a validated receipt.
// For each key we try up to 2 times (handles a bad-JSON response). If a key is
// rate-limited (429), we move to the next key. If every key is exhausted, we
// throw — the route handler turns that into a clear error.
export async function parseReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ParsedReceipt> {
  let lastError: unknown;

  for (let k = 0; k < models.length; k++) {
    const model = models[k];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent([
          { text: RECEIPT_PROMPT },
          { inlineData: { data: imageBase64, mimeType } },
        ]);
        return parseReceiptResponse(result.response.text()); // throws on bad JSON
      } catch (err) {
        lastError = err;
        console.warn(
          `Key ${k + 1}, attempt ${attempt + 1} failed:`,
          (err as Error).message
        );
        // If it's a rate limit, retrying the same key won't help — go to next key.
        if (isRateLimit(err)) break;
      }
    }
  }

  throw new Error(
    `Failed to parse receipt (all ${models.length} key(s) exhausted): ${
      (lastError as Error).message
    }`
  );
}
