# Receipt Parser

Upload a photo of a receipt, get back structured data (merchant, date, line items, total), correct anything the model got wrong, and save the corrected version.

The core idea: an LLM will never be perfectly accurate on real-world receipt photos, so the product is built around the human catching and fixing its mistakes. Most of the effort went into the correction step, not the model call.

```
Upload JPG/PNG  ─►  Backend sends image to Gemini  ─►  Validated JSON
                                                            │
        Persist to receipts.json  ◄─  User reviews & corrects (edit fields,
                                       add/remove items, low-confidence flagged)
```

---

## Quick start

**Prerequisites:** Node 18+ and a free Gemini API key ([get one here](https://aistudio.google.com/apikey)).

```bash
# 1. Install dependencies (root + backend + frontend)
npm run install:all

# 2. Add your API key
cp backend/.env.example backend/.env
#   then edit backend/.env and paste your key into GEMINI_API_KEY

# 3. Run both servers with one command
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

Run the tests with `npm test --prefix backend`.

### Environment variables (`backend/.env`)

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes* | A single Gemini key. |
| `GEMINI_API_KEYS` | No | One or more comma-separated keys. If set, the app rotates to the next key when one hits a rate limit. Takes priority over `GEMINI_API_KEY`. |
| `PORT` | No | Backend port. Defaults to `3001`. |

\* Provide **either** `GEMINI_API_KEY` **or** `GEMINI_API_KEYS` — at least one is required.

**Single key** (`backend/.env`):

```
GEMINI_API_KEY=AQ.your_key_here
```

**Multiple keys for rate-limit fallback** — put them all on one line, comma-separated, no spaces or quotes:

```
GEMINI_API_KEYS=AQ.key_one,AQ.key_two,AQ.key_three
```

The app splits on the commas and, when a key returns a rate-limit error (429), moves on to the next one. Note: a second key only adds *real* quota if it's from a **different Google account** — keys from the same account share one quota pool.

---

## The five questions

### 1. What did you build?

A single-user web app with a TypeScript/Express backend and a React (Vite) frontend. The user uploads a JPG/PNG of a receipt; the backend sends it to Google's Gemini Flash model with a strict prompt and validates the JSON that comes back; the frontend shows the extracted fields in a fully editable form where the user can fix any field, add or remove line items, and then save. Saved receipts are persisted to a JSON file. The design deliberately puts the effort into the correction step, since the model will never be perfectly accurate on real-world photos and the human catching its mistakes is what makes the output trustworthy.

### 2. Biggest tradeoffs

- **A single JSON file for storage instead of a database.** The spec said DB choice doesn't matter, and for a single-user app a JSON file is the simplest thing that works, needs zero setup, and can be inspected by eye. The tradeoff is that it doesn't handle concurrent writes and won't scale — both irrelevant here, and both a five-minute swap to SQLite if they ever mattered.

- **Fail loudly on a bad parse instead of returning partial/guessed data.** When the model returns something that isn't valid JSON, the backend retries once, and if it still fails it returns a clear error ("Could not read this receipt. Try a clearer photo.") rather than a half-filled form. I'd rather the user re-take the photo than silently trust fabricated fields they didn't notice were wrong — for a data-entry tool, a confident wrong answer is worse than an honest failure.

- **Gemini Flash over a more accurate model.** Flash trades some accuracy for being fast and free-tier friendly. That's the right call here specifically *because* there's a human correction step: the model only needs to get the user 80% of the way there, and the UI is built to make fixing the last 20% fast. If there were no correction step, I'd have picked a stronger model.

### 3. Where I used an LLM (in building this)

- **Prompt iteration** — used the model to draft and tighten the receipt-parsing prompt (the "line items are products only, use null for unreadable values, flag low-confidence fields" rules).
- **Boilerplate scaffolding** — Vite/Express setup, the `concurrently` single-command dev script, and CSS.
- **Wrote myself / reviewed line-by-line** — the validation layer (`validate.ts`, `validateSave.ts`), the key-rotation logic, the correction-UI state handling, and the tests. These are the parts where the judgment lives, and I can walk through every line.

### 4. What I'd do with another week

In priority order:

1. **Show the receipt image next to the form** during correction, so the user can check a field against the source without switching context. This is the single biggest correction-UX win and I'd do it first.
2. **A real "saved receipts" list view** with edit/delete. Right now the data persists and there's a `GET /api/receipts` endpoint, but the UI doesn't surface saved receipts back to the user.
3. **Per-field confidence, not just a flag.** Have the model return a confidence score per field and sort/scroll the user's attention to the least-confident ones first.
4. **SQLite** once there's more than one receipt type of query (search, filter by merchant/date).
5. **A couple of integration tests** around the `/api/parse` route with a mocked model, and a small fixture set of real receipt photos to catch prompt regressions.

### 5. One thing I'd push back on

**"Line items (name + amount)" as a core required field is probably the wrong primary target.** Per-item extraction is the hardest thing on a receipt to get right (cramped layout, abbreviations, wrapped lines) and, for most real uses of a receipt parser — expense reports, accounting, reimbursement — it's also the *least* important. What those workflows actually need is merchant, date, total, tax, and a category. So we're spending the model's hardest effort and the user's most tedious correction time on the field that matters least.

If I were building this for real, I'd ask the PM: *who is the user and what do they do with the data?* If the answer is expenses/accounting, I'd make merchant/date/total/tax the required, polished path and treat line items as a best-effort extra — the opposite of the spec's emphasis. I built line items as specified here, but I'd want that conversation before committing to it as the centerpiece.

---

## Design decisions the spec left open

- **What is a line item?** Only a purchased product or service. Subtotal, tax, tip, discount, and total are *not* line items — they each get their own field. This keeps the line-item list clean and makes the totals independently checkable. The prompt enforces this rule.
- **Malformed model output?** The validator parses and type-checks the response; `parseReceipt` retries once; if it still fails, the request fails loudly with a user-facing message. No fake data is ever returned.
- **Low-confidence extractions?** The model returns unreadable values as `null` and lists uncertain fields in `lowConfidenceFields`. The UI highlights those fields in yellow with a "please check these" banner, so the user's attention goes straight to what's risky.
- **How does the user know what to correct?** Two signals beyond the raw fields: (1) the low-confidence highlighting above, and (2) a sanity check that warns when the line items don't sum to the total (framed as "worth a look," since tax/tip legitimately explain a gap).
- **Which model, and why?** `gemini-flash-latest` — it has vision, a usable free tier (no billing required), and low latency. Using the `-latest` alias means the app tracks the current Flash model without a code change. See tradeoff #3 above.

---

## API

| Method & path | Body | Returns |
| --- | --- | --- |
| `POST /api/parse` | multipart form, field `image` (JPG/PNG) | Parsed receipt JSON, or `502 { error }` if the image can't be read |
| `POST /api/receipts` | corrected receipt JSON | `201` with the saved record (adds `id`, `savedAt`) |
| `GET /api/receipts` | — | All saved receipts |
| `GET /api/health` | — | `{ status: "ok" }` |

The parsed/saved shape (`ParsedReceipt`):

```ts
{
  merchant: string | null;
  date: string | null;              // YYYY-MM-DD when readable
  lineItems: { name: string; amount: number | null }[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  lowConfidenceFields: string[];    // fields the model was unsure about
}
```

`null` means "the model couldn't read this," kept distinct from `0` all the way through parse → edit → save.

---

## Project structure

```
.
├── package.json            # root: single `npm run dev` (runs both via concurrently)
├── backend/                # Express + TypeScript
│   ├── src/
│   │   ├── index.ts        # routes: /api/parse, /api/receipts
│   │   ├── parseReceipt.ts # Gemini call + retry + key rotation
│   │   ├── prompt.ts       # the parsing prompt
│   │   ├── validate.ts     # LLM response -> trusted typed data (tested)
│   │   ├── validate.test.ts
│   │   ├── validateSave.ts # save payload -> clean typed data
│   │   ├── storage.ts      # JSON-file persistence
│   │   └── types.ts
│   └── .env.example
└── frontend/               # React + Vite + TypeScript
    └── src/
        ├── App.tsx
        └── components/
            ├── UploadForm.tsx    # file picker + preview
            └── ResultsView.tsx   # the correction UI
```

## Notes / known limitations

- Storage is a single JSON file; no concurrent-write safety (fine for one user).
- The Gemini free tier has a low rate limit. Key rotation helps, but a second key only adds real quota if it's on a *different* Google account — keys from one account share one limit.
- The frontend and backend share the `ParsedReceipt` type by hand-copying it (small app; not worth a shared package).
