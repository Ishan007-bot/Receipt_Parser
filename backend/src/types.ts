// The shape of the data we extract from a receipt.
// This is the single source of truth for what a "receipt" looks like.

export interface LineItem {
  name: string;
  amount: number | null; // null = LLM couldn't read the amount
}

export interface ParsedReceipt {
  merchant: string | null;
  date: string | null; // ISO-ish string (YYYY-MM-DD) if the LLM can read it
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  // Fields the LLM was unsure about, so the UI can highlight them for the user.
  lowConfidenceFields: string[];
}
