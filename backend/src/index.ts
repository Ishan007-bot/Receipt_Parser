import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { parseReceipt } from "./parseReceipt.js";
import { saveReceipt, listReceipts } from "./storage.js";
import { validateSavePayload } from "./validateSave.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// If a request body isn't valid JSON, return a clean error instead of Express's
// default HTML stack trace.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON." });
  }
  next(err);
});

// Keep the uploaded image in memory (we only need it long enough to send to
// the LLM — no reason to write it to disk). Limit to 10MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Only accept JPG / PNG, as the spec allows.
    const ok = ["image/jpeg", "image/png"].includes(file.mimetype);
    cb(null, ok);
  },
});

// Simple health check so we can confirm the backend is running.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Upload a receipt image -> send to Gemini -> return structured data.
app.post("/api/parse", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No image uploaded. Send a JPG or PNG in the 'image' field." });
  }

  try {
    const imageBase64 = req.file.buffer.toString("base64");
    const receipt = await parseReceipt(imageBase64, req.file.mimetype);
    res.json(receipt);
  } catch (err) {
    // Fail loudly: tell the frontend it didn't work rather than returning
    // fake/empty data the user might trust.
    console.error("Parse error:", err);
    res.status(502).json({
      error: "Could not read this receipt. Try a clearer photo.",
    });
  }
});

// Save a corrected receipt to the JSON file.
app.post("/api/receipts", async (req, res) => {
  const result = validateSavePayload(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const saved = await saveReceipt(result.receipt, new Date().toISOString());
    res.status(201).json(saved);
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Could not save the receipt." });
  }
});

// List all saved receipts (handy for the UI / for verifying persistence).
app.get("/api/receipts", async (_req, res) => {
  try {
    res.json(await listReceipts());
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Could not load saved receipts." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
