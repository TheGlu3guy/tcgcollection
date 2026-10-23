# Image Search Feasibility Spike

## Summary

- Dataset: 2701 catalog cards from six complete sets plus 2000 random image-backed distractors.
- Synthetic proxy: 100 perturbed catalog images; these are not real phone-photo measurements.
- Real photos: not measured; no labeled photos were present.
- Best exact-card result: DINOv2 small, whole, top-1 84.0%, top-5 100.0%, top-10 100.0%.
- Best same-artwork result: top-1 98.0%, top-5 100.0%, top-10 100.0%.
- Best median end-to-end query latency: 30.8 ms; p95 33.4 ms in Node.
- Largest float32-to-int8 accuracy drop: 0.0%; largest absolute change in either direction: 1.0%.
- MobileCLIP S0 was substantially weaker and slower than CLIP/DINOv2 on this proxy.
- Extrapolated full-catalog index: 56.40 MiB float32 or 14.25 MiB int8 for 38,500 print groups.
- Recommendation: Embeddings are strong enough for a candidate-ranking UX under the synthetic proxy, but the best exact top-1 rate was 84.0%. Treat top 5 as candidates and validate on real photos before deciding whether OCR is mandatory.

## Scope and method

- Runtime: Node v22.23.4, ESM, Transformers.js ONNX models, executed locally without a server.
- Languages indexed: en.
- Selected sets: Base Set (102), Base Set 2 (130), Evolutions (113), Celebrations (24), Crown Zenith (160), Black Bolt (172).
- Distractors: 2000 randomly sampled cards with images from other sets.
- Catalog images use the same TCGdex endpoint and `/high.webp` convention as the application.
- All images were cached on disk and reused; no image was downloaded more than once by this workflow.
- Embeddings are L2-normalized. Both matrices are in manifest order, with the exact card keys recorded in each index metadata file.
- The int8 version uses one symmetric scale per embedding; evaluation dequantizes index vectors and compares them against the normalized float query.
- All three configured ONNX models loaded successfully and produced image embeddings; no model-loading failure was observed.

## Exact-card retrieval

| Model | Preprocessing | Top-1 | Top-5 | Top-10 | Same art Top-1 | Same art Top-5 | Same art Top-10 | Median | p95 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CLIP ViT-B/32 | whole | 67.0% | 89.0% | 95.0% | 80.0% | 93.0% | 96.0% | 26.0 ms | 28.3 ms |
| CLIP ViT-B/32 | center-crop | 73.0% | 93.0% | 94.0% | 82.0% | 94.0% | 96.0% | 26.5 ms | 29.4 ms |
| DINOv2 small | whole | 84.0% | 100.0% | 100.0% | 98.0% | 100.0% | 100.0% | 30.8 ms | 33.4 ms |
| DINOv2 small | center-crop | 85.0% | 99.0% | 100.0% | 97.0% | 100.0% | 100.0% | 30.9 ms | 33.3 ms |
| MobileCLIP S0 | whole | 0.0% | 0.0% | 1.0% | 0.0% | 3.0% | 4.0% | 84.9 ms | 90.7 ms |
| MobileCLIP S0 | center-crop | 1.0% | 5.0% | 7.0% | 1.0% | 8.0% | 10.0% | 84.8 ms | 91.9 ms |

“Same artwork” is operationally defined as same normalized card name plus same illustrator when the illustrator is present, matching the requested proxy criterion. It is not an independent artwork-hash judgment.

## Quantized index

| Model | Preprocessing | Float32 Top-1/5/10 | Int8 Top-1/5/10 | Drop Top-1 | Drop Top-5 | Drop Top-10 |
|---|---|---:|---:|---:|---:|---:|
| CLIP ViT-B/32 | whole | 67.0% / 89.0% / 95.0% | 68.0% / 89.0% / 95.0% | -1.0% | 0.0% | 0.0% |
| CLIP ViT-B/32 | center-crop | 73.0% / 93.0% / 94.0% | 74.0% / 93.0% / 94.0% | -1.0% | 0.0% | 0.0% |
| DINOv2 small | whole | 84.0% / 100.0% / 100.0% | 85.0% / 100.0% / 100.0% | -1.0% | 0.0% | 0.0% |
| DINOv2 small | center-crop | 85.0% / 99.0% / 100.0% | 85.0% / 99.0% / 100.0% | 0.0% | 0.0% | 0.0% |
| MobileCLIP S0 | whole | 0.0% / 0.0% / 1.0% | 0.0% / 0.0% / 1.0% | 0.0% | 0.0% | 0.0% |
| MobileCLIP S0 | center-crop | 1.0% / 5.0% / 7.0% | 1.0% / 5.0% / 7.0% | 0.0% | 0.0% | 0.0% |

## Model and index sizes

Model sizes below are the ONNX vision weights measured from the Hugging Face files; tokenizer/config files add a small amount not included in this number.

| Model | Quantized ONNX | Full ONNX | Embedding dimension |
|---|---:|---:|---:|
| CLIP ViT-B/32 | 84.99 MiB | 335.39 MiB | 512 |
| DINOv2 small | 23.32 MiB | 84.36 MiB | 384 |
| MobileCLIP S0 | 11.30 MiB | 43.43 MiB | 512 |

| Model | Preprocessing | Subset float32 | Subset int8 + scales | 38.5k float32 | 38.5k int8 + scales |
|---|---|---:|---:|---:|---:|
| CLIP ViT-B/32 | whole | 5.28 MiB | 1.33 MiB | 75.20 MiB | 18.95 MiB |
| CLIP ViT-B/32 | center-crop | 5.28 MiB | 1.33 MiB | 75.20 MiB | 18.95 MiB |
| DINOv2 small | whole | 3.96 MiB | 1.00 MiB | 56.40 MiB | 14.25 MiB |
| DINOv2 small | center-crop | 3.96 MiB | 1.00 MiB | 56.40 MiB | 14.25 MiB |
| MobileCLIP S0 | whole | 5.28 MiB | 1.33 MiB | 75.20 MiB | 18.95 MiB |
| MobileCLIP S0 | center-crop | 5.28 MiB | 1.33 MiB | 75.20 MiB | 18.95 MiB |

## Real-photo evaluation

Not measured. `photos/labels.csv` contained no labeled rows at evaluation time. No accuracy claims are made for real phone photos.

## Failure analysis

The best configuration (DINOv2 small, whole) had no top-5 failures on the synthetic proxy. The examples below come from the two CLIP configurations so that failure modes are still visible.
They are grouped by the perturbation label assigned when the proxy image was generated. This grouping is descriptive, not causal proof.

### holo/glare

- `synthetic-queries/query-038.jpg` (whole) expected **PlusPower** (`en:base4-113`); top 3: PlusPower (84.4%), Super Potion (84.1%), Full Heal (84.0%).
- `synthetic-queries/query-050.jpg` (whole) expected **Eelektrik** (`en:sv10.5b-114`); top 3: Comfey (85.2%), Gloom (83.9%), Ludicolo (82.1%).
- `synthetic-queries/query-066.jpg` (whole) expected **Beedrill** (`en:base4-21`); top 3: Shiftry (82.2%), Beedrill ex (82.0%), Ferrothorn (82.0%).

### background/perspective

- `synthetic-queries/query-052.jpg` (whole) expected **Computer Search** (`en:base1-71`); top 3: Computer Search (90.1%), Pokédex (88.6%), Pokédex (87.0%).
- `synthetic-queries/query-064.jpg` (whole) expected **Mewtwo EX** (`en:xy12-52`); top 3: Mew (88.3%), Mewtwo (87.8%), Meowstic (84.7%).
- `synthetic-queries/query-080.jpg` (whole) expected **Professor Oak's Hint** (`en:xy12-84`); top 3: Potion (79.9%), Pokédex (79.2%), Potion (78.6%).

### tilted

- `synthetic-queries/query-053.jpg` (whole) expected **Yveltal** (`en:cel25-19`); top 3: Buzzwole ex (79.5%), Greninja ex (78.8%), Bloodmoon Ursaluna ex (78.6%).
- `synthetic-queries/query-069.jpg` (whole) expected **Weedle** (`en:base4-100`); top 3: Squirtle (83.2%), Wobbuffet (83.0%), Meganium (82.1%).
- `synthetic-queries/query-085.jpg` (whole) expected **Charmander** (`en:base1-46`); top 3: Charmander (88.1%), Charmander (86.9%), Charmander (86.2%).

### lighting

- `synthetic-queries/query-095.jpg` (whole) expected **Seismitoad** (`en:sv10.5b-021`); top 3: Seismitoad (85.5%), Milotic (84.9%), Milotic (84.8%).
- `synthetic-queries/query-043.jpg` (center-crop) expected **Conkeldurr** (`en:sv10.5b-127`); top 3: Rotom (80.2%), Mega Mawile ex (79.8%), Munkidori ex (79.3%).
- `synthetic-queries/query-075.jpg` (center-crop) expected **Elgyem** (`en:sv10.5b-120`); top 3: Morpeko V-UNION (76.5%), Ferrothorn (75.6%), Amoonguss (75.6%).

## Optional OCR stretch

Not run. The optional stretch specifically targets real photos, and the real-photo set was empty at the time of this spike.

## Recommendation

- Model: **DINOv2 small**.
- Preprocessing: **whole**.
- Top-5 exact-card accuracy in the synthetic proxy was 100.0%; top-10 was 100.0%.
- Embeddings are strong enough for a candidate-ranking UX under the synthetic proxy, but the best exact top-1 rate was 84.0%. Treat top 5 as candidates and validate on real photos before deciding whether OCR is mandatory.
- The gap between high top-5 recall and imperfect exact top-1 suggests a collector-number/OCR second stage is worth testing for exact-print identification.

## Risks and surprises

- The synthetic proxy is derived from the exact catalog image. It measures robustness to transforms but can be unrealistically favorable compared with a camera photo.
- MobileCLIP S0 performed far worse than CLIP and DINOv2 on this card-image proxy and was also slower in the measured Node environment. Its failure should not be attributed to card search generally.
- Same-artwork labels are a name-plus-illustrator proxy and can merge distinct artworks by the same illustrator.
- Cards with similar trainer/energy templates were visible failure cases for CLIP; DINOv2 tolerated this proxy subset better.
- No real-photo accuracy, glare behavior, perspective condition, or language-switching result is known yet.
- The model ONNX sizes do not include JavaScript runtime, WASM/WebGPU backend, browser memory, or compressed network transfer overhead.
- Real browser latency and memory may differ substantially from Node CPU measurements.
- The parent catalog has many cards without images; such cards cannot enter an embedding index without another image source.
- Image licensing and embedding retention for a browser PWA remain outside what this experiment can establish.
