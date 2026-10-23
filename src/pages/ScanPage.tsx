import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { imageUrl } from "../lib/catalog";
import {
  searchCardsByImage,
  type VisualSearchProgress,
  type VisualSearchResult,
} from "../lib/visualSearch";
import type { Catalog, CatalogCard } from "../types";
import { CardImage } from "../components/Shared";

interface ScanPageProps {
  catalog: Catalog;
  onOpenCard: (card: CatalogCard) => void;
}

export function ScanPage({ catalog, onOpenCard }: ScanPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<VisualSearchProgress | null>(null);
  const [results, setResults] = useState<VisualSearchResult[]>([]);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const selectPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG, WebP, or other image file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResults([]);
    setError("");
    setProgress(null);
  };

  const search = async () => {
    if (!photo) return;
    setError("");
    setResults([]);
    setProgress({ phase: "model", percent: null, message: "Preparing on-device search" });
    try {
      const matches = await searchCardsByImage(photo, catalog.cards, setProgress);
      setResults(matches);
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo could not be searched.");
      setProgress(null);
    }
  };

  return (
    <div className="page-stack scan-page">
      <section className="catalog-heading">
        <div>
          <span className="eyebrow">On-device visual search</span>
          <h1>Scan a card</h1>
          <p>
            Take or choose one photo and compare it locally against the experimental
            DINOv2 card index.
          </p>
        </div>
        <span className="scan-privacy-pill">
          <ShieldCheck size={15} /> Photo stays on this device
        </span>
      </section>

      <section className="surface scan-workspace">
        <div className={`scan-dropzone ${previewUrl ? "has-photo" : ""}`}>
          {previewUrl ? (
            <img src={previewUrl} alt="Card scan preview" />
          ) : (
            <div className="scan-empty-state">
              <span className="scan-icon-ring"><ScanLine size={38} /></span>
              <h2>Frame one card</h2>
              <p>Fill most of the frame and keep the card edges visible.</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => selectPhoto(event.target.files?.[0])}
          />
          <button
            type="button"
            className="primary-button scan-photo-button"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? <ImagePlus size={17} /> : <Camera size={17} />}
            {previewUrl ? "Choose another photo" : "Take or choose a photo"}
          </button>
        </div>

        <div className="scan-side-panel">
          <span className="eyebrow">Experimental index</span>
          <h2>2,701 card subset</h2>
          <p>
            This test index includes Base Set, Base Set 2, Evolutions, Celebrations,
            Crown Zenith, Black Bolt, and 2,000 random distractor cards.
          </p>
          <p>
            The first scan downloads the quantized DINOv2 model (about 23 MiB).
            Later scans reuse the browser cache.
          </p>
          <button
            className="primary-button scan-submit"
            type="button"
            onClick={() => void search()}
            disabled={!photo || Boolean(progress)}
          >
            {progress ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {progress ? "Searching…" : "Find top 5 matches"}
          </button>
          {progress && (
            <div className="scan-progress" aria-live="polite">
              <div className="progress-track">
                <span
                  style={{
                    width: `${progress.percent === null ? 18 : Math.max(4, progress.percent)}%`,
                  }}
                />
              </div>
              <span>{progress.message}</span>
            </div>
          )}
          {error && <p className="settings-warning">{error}</p>}
        </div>
      </section>

      {results.length > 0 && (
        <section className="surface scan-results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Visual matches</span>
              <h2>Top 5 candidates</h2>
            </div>
          </div>
          <div className="scan-result-grid">
            {results.map((result, index) => (
              <button
                type="button"
                className="scan-result-card"
                key={result.card.key}
                onClick={() => onOpenCard(result.card)}
              >
                <span className="scan-result-rank">{index + 1}</span>
                <CardImage
                  src={imageUrl(
                    result.card.image,
                    result.card.region === "International" ? "high" : "low",
                  )}
                  alt={result.card.name}
                />
                <strong>{result.card.name}</strong>
                <span>{result.card.setName} · {result.card.localId}</span>
                <small>{Math.max(0, result.score * 100).toFixed(1)}% visual similarity</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
