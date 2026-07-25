import { useState } from "react";
import type { ParsedReceipt } from "./types";
import { UploadForm } from "./components/UploadForm";
import { ResultsView } from "./components/ResultsView";
import "./App.css";

export default function App() {
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send the chosen image to the backend and store the parsed result.
  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);
    setReceipt(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/parse", { method: "POST", body: formData });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong parsing the receipt.");
      }

      const data: ParsedReceipt = await res.json();
      setReceipt(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setReceipt(null);
    setError(null);
  }

  return (
    <div className="app">
      <header>
        <h1>Receipt Parser</h1>
        <p className="subtitle">Upload a receipt photo to extract its data.</p>
      </header>

      {/* Show the upload form until we have a result. */}
      {!receipt && (
        <UploadForm onUpload={handleUpload} loading={loading} error={error} />
      )}

      {/* Correction UI: review the extracted data and edit anything wrong. */}
      {receipt && <ResultsView receipt={receipt} onReset={reset} />}
    </div>
  );
}
