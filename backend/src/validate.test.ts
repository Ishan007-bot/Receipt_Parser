import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReceiptResponse } from "./validate.js";

// We test the LLM-response parser because it's the riskiest seam in the app:
// it turns untrusted, sometimes-messy model output into the typed data the
// rest of the app trusts. If this is wrong, bad data flows everywhere quietly.

test("parses a clean JSON response", () => {
  const raw = JSON.stringify({
    merchant: "Starbucks",
    date: "2026-07-24",
    lineItems: [{ name: "Latte", amount: 4.5 }],
    subtotal: 4.5,
    tax: 0.4,
    tip: null,
    total: 4.9,
    lowConfidenceFields: ["total"],
  });

  const r = parseReceiptResponse(raw);
  assert.equal(r.merchant, "Starbucks");
  assert.equal(r.total, 4.9);
  assert.deepEqual(r.lineItems, [{ name: "Latte", amount: 4.5 }]);
  assert.deepEqual(r.lowConfidenceFields, ["total"]);
});

test("strips markdown code fences the model sometimes adds", () => {
  const raw = "```json\n" + JSON.stringify({ merchant: "Cafe", total: 5 }) + "\n```";
  const r = parseReceiptResponse(raw);
  assert.equal(r.merchant, "Cafe");
  assert.equal(r.total, 5);
});

test("coerces unreadable / empty values to null (not 0 or '')", () => {
  const raw = JSON.stringify({
    merchant: "   ", // whitespace -> null
    total: "not a number", // unparseable -> null
    tax: "0.40", // numeric string -> 0.4
  });
  const r = parseReceiptResponse(raw);
  assert.equal(r.merchant, null);
  assert.equal(r.total, null);
  assert.equal(r.tax, 0.4);
});

test("drops malformed / empty line items", () => {
  const raw = JSON.stringify({
    lineItems: [
      { name: "Coffee", amount: 3 },
      { name: "", amount: 2 }, // empty name -> dropped
      "garbage", // not an object -> dropped
    ],
  });
  const r = parseReceiptResponse(raw);
  assert.deepEqual(r.lineItems, [{ name: "Coffee", amount: 3 }]);
});

test("throws when the response is not valid JSON", () => {
  assert.throws(() => parseReceiptResponse("Sorry, I couldn't read that."));
});
