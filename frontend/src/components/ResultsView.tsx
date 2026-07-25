import { useState } from "react";
import type { ParsedReceipt, LineItem } from "../types";

interface Props {
  receipt: ParsedReceipt;
  onReset: () => void;
}

// The correction UI. This is where the human fixes what the LLM got wrong:
// every field is editable, line items can be added/removed, and low-confidence
// fields are highlighted so the user knows where to look. Saving comes next step.
export function ResultsView({ receipt, onReset }: Props) {
  // Local working copy — the user edits this, not the original parse result.
  const [draft, setDraft] = useState<ParsedReceipt>(receipt);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lowConf = new Set(receipt.lowConfidenceFields);

  // Send the corrected draft to the backend to persist it.
  async function handleSave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  // --- update helpers ---------------------------------------------------

  // Any edit runs through this, so we also clear a stale "✓ Saved" state:
  // once the user changes something, what's on disk no longer matches.
  function mutate(update: (d: ParsedReceipt) => ParsedReceipt) {
    setDraft(update);
    setSaveState("idle");
  }

  // Update a single top-level field (merchant, date, subtotal, tax, tip, total).
  function setField<K extends keyof ParsedReceipt>(key: K, value: ParsedReceipt[K]) {
    mutate((d) => ({ ...d, [key]: value }));
  }

  // Update one line item's name or amount.
  function setLineItem(index: number, patch: Partial<LineItem>) {
    mutate((d) => ({
      ...d,
      lineItems: d.lineItems.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  }

  function addLineItem() {
    mutate((d) => ({ ...d, lineItems: [...d.lineItems, { name: "", amount: null }] }));
  }

  function removeLineItem(index: number) {
    mutate((d) => ({ ...d, lineItems: d.lineItems.filter((_, i) => i !== index) }));
  }

  // The sum of line items — shown next to the total so the user can spot a
  // mismatch (a cheap "does this look right?" signal, no extra LLM needed).
  const itemsSum = draft.lineItems.reduce((s, it) => s + (it.amount ?? 0), 0);

  return (
    <div className="results">
      <div className="results-header">
        <h2>Review &amp; correct</h2>
        <button type="button" className="secondary" onClick={onReset}>
          ← Upload another
        </button>
      </div>

      {receipt.lowConfidenceFields.length > 0 && (
        <p className="warning">
          ⚠️ Some fields were hard to read (highlighted below). Please double-check them.
        </p>
      )}

      <EditableField
        label="Merchant"
        value={draft.merchant ?? ""}
        flagged={lowConf.has("merchant")}
        onChange={(v) => setField("merchant", v || null)}
      />
      <EditableField
        label="Date"
        value={draft.date ?? ""}
        flagged={lowConf.has("date")}
        placeholder="YYYY-MM-DD"
        onChange={(v) => setField("date", v || null)}
      />

      {/* ---- Line items ---- */}
      <div className={`items ${lowConf.has("lineItems") ? "flagged" : ""}`}>
        <h3>Line items</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="right">Amount</th>
              <th aria-label="remove"></th>
            </tr>
          </thead>
          <tbody>
            {draft.lineItems.map((item, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="cell-input"
                    value={item.name}
                    placeholder="Item name"
                    onChange={(e) => setLineItem(i, { name: e.target.value })}
                  />
                </td>
                <td className="right">
                  <MoneyInput
                    value={item.amount}
                    onChange={(v) => setLineItem(i, { amount: v })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove item"
                    onClick={() => removeLineItem(i)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="secondary add-btn" onClick={addLineItem}>
          + Add line item
        </button>
      </div>

      {/* ---- Totals ---- */}
      <div className="totals">
        <EditableMoney
          label="Subtotal"
          value={draft.subtotal}
          flagged={lowConf.has("subtotal")}
          onChange={(v) => setField("subtotal", v)}
        />
        <EditableMoney
          label="Tax"
          value={draft.tax}
          flagged={lowConf.has("tax")}
          onChange={(v) => setField("tax", v)}
        />
        <EditableMoney
          label="Tip"
          value={draft.tip}
          flagged={lowConf.has("tip")}
          onChange={(v) => setField("tip", v)}
        />
        <EditableMoney
          label="Total"
          value={draft.total}
          flagged={lowConf.has("total")}
          strong
          onChange={(v) => setField("total", v)}
        />

        {/* Sanity check: does the sum of items roughly match the total? */}
        {draft.total !== null && Math.abs(itemsSum - draft.total) > 0.01 && (
          <p className="hint">
            Line items add up to {itemsSum.toFixed(2)}, which doesn't match the total
            ({draft.total.toFixed(2)}). That can be normal (tax/tip) — just worth a look.
          </p>
        )}
      </div>

      <button
        type="button"
        className="save-btn"
        onClick={handleSave}
        disabled={saveState === "saving" || saveState === "saved"}
      >
        {saveState === "saving"
          ? "Saving…"
          : saveState === "saved"
          ? "✓ Saved"
          : "Save corrected receipt"}
      </button>

      {saveState === "saved" && (
        <p className="success">Receipt saved. Upload another to parse a new one.</p>
      )}
      {saveState === "error" && (
        <p className="error">Couldn't save the receipt. Please try again.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

// A labeled text input. `flagged` highlights low-confidence values.
function EditableField({
  label,
  value,
  flagged,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  flagged?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={`field ${flagged ? "flagged" : ""}`}>
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// A labeled money input (subtotal/tax/tip/total).
function EditableMoney({
  label,
  value,
  flagged,
  strong,
  onChange,
}: {
  label: string;
  value: number | null;
  flagged?: boolean;
  strong?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className={`field ${flagged ? "flagged" : ""}`}>
      <span className="field-label">{label}</span>
      <span className={strong ? "strong" : ""}>
        <MoneyInput value={value} onChange={onChange} />
      </span>
    </label>
  );
}

// A number input that maps "" <-> null, so a blank field means "not known"
// rather than 0. Keeps the "unreadable vs zero" distinction the parser makes.
function MoneyInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      step="0.01"
      className="cell-input right"
      value={value === null ? "" : value}
      placeholder="—"
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
    />
  );
}
