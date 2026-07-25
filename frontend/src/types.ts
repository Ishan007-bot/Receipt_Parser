// Mirrors the backend's ParsedReceipt shape. Kept in sync by hand (small app).

export interface LineItem {
  name: string;
  amount: number | null;
}

export interface ParsedReceipt {
  merchant: string | null;
  date: string | null;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  lowConfidenceFields: string[];
}
