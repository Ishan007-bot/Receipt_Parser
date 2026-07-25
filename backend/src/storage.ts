import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { ParsedReceipt } from "./types.js";

// Persistence is a single JSON file. The spec says the DB choice doesn't
// matter, and for a single-user app a JSON file is the simplest thing that
// works and is trivial to inspect/explain.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "receipts.json");

// A saved receipt is the corrected data plus a little metadata.
export interface SavedReceipt extends ParsedReceipt {
  id: string;
  savedAt: string;
}

async function readAll(): Promise<SavedReceipt[]> {
  if (!existsSync(DB_PATH)) return [];
  try {
    const raw = await readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as SavedReceipt[];
  } catch {
    // If the file is somehow corrupt, start fresh rather than crash.
    return [];
  }
}

async function writeAll(receipts: SavedReceipt[]): Promise<void> {
  await writeFile(DB_PATH, JSON.stringify(receipts, null, 2), "utf-8");
}

// Append a corrected receipt and return the saved record (with id + timestamp).
export async function saveReceipt(
  receipt: ParsedReceipt,
  now: string
): Promise<SavedReceipt> {
  const all = await readAll();
  const saved: SavedReceipt = {
    ...receipt,
    id: `r_${all.length + 1}_${now}`,
    savedAt: now,
  };
  all.push(saved);
  await writeAll(all);
  return saved;
}

export async function listReceipts(): Promise<SavedReceipt[]> {
  return readAll();
}
