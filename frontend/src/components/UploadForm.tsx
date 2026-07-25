import { useState } from "react";

interface Props {
  onUpload: (file: File) => void;
  loading: boolean;
  error: string | null;
}

// Lets the user pick a JPG/PNG, preview it, and submit it for parsing.
export function UploadForm({ onUpload, loading, error }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    // Show a local preview so the user knows which image they picked.
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file) onUpload(file);
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="file-drop">
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={loading}
        />
        {previewUrl ? (
          <img src={previewUrl} alt="Receipt preview" className="preview" />
        ) : (
          <span className="file-hint">Click to choose a receipt photo (JPG or PNG)</span>
        )}
      </label>

      <button type="submit" disabled={!file || loading}>
        {loading ? "Reading receipt…" : "Parse receipt"}
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
