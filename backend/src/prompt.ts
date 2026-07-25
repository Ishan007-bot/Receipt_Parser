// The instruction we send to Gemini along with the receipt image.
// Kept in its own file so the prompt is easy to read and iterate on.

export const RECEIPT_PROMPT = `You are a receipt parser. Look at the receipt image and extract its data.

Return ONLY a JSON object (no markdown, no code fences, no commentary) with exactly this shape:

{
  "merchant": string | null,
  "date": string | null,          // format as YYYY-MM-DD if possible
  "lineItems": [                    // ONLY purchased products/services
    { "name": string, "amount": number | null }
  ],
  "subtotal": number | null,
  "tax": number | null,
  "tip": number | null,
  "total": number | null,
  "lowConfidenceFields": string[]   // names of fields you were unsure about
}

Rules:
- A "line item" is ONLY a purchased product or service. Do NOT put subtotal,
  tax, tip, discount, or total inside lineItems — those have their own fields.
- Use null for any value you cannot read from the image. Do not guess.
- If the image is blurry, faded, or a value is ambiguous, add that field's name
  to "lowConfidenceFields" (e.g. "total", "date", "lineItems").
- Amounts must be numbers only (e.g. 4.50), no currency symbols.
- Return valid JSON and nothing else.`;
