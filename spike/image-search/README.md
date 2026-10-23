# On-device card image-search feasibility spike

This experiment tests image embeddings against the same public TCGdex catalog
used by the application. It does not modify or import production application
code and does not add UI.

## Requirements

- Node 22 is pinned in `devDependencies`.
- About 500 MiB free disk space for the image subset, model cache, embeddings,
  and generated proxy photos.
- Network access for the initial TCGdex image download and Hugging Face model
  download.

```bash
npm install
npx --no-install node@22 --version
```

## 1. Build the cached TCGdex subset

```bash
npm run subset
```

Defaults:

- English (`en`) only.
- Base Set, Base Set 2, Evolutions, Celebrations, Crown Zenith, and Black Bolt.
- 2,000 random image-backed distractors from other sets.
- Maximum four concurrent image downloads with a delay between requests.
- Existing files under `image-cache/` are always reused.

Configuration:

```bash
SPIKE_LANGUAGES=en,fr
SPIKE_SET_IDS=base1,base4,xy12,cel25,swsh12.5,sv10.5b
SPIKE_DISTRACTOR_COUNT=2000
SPIKE_DOWNLOAD_CONCURRENCY=4
SPIKE_REQUEST_DELAY_MS=120
```

In PowerShell, set the same variables with:

```powershell
$env:SPIKE_LANGUAGES = "en,fr"
$env:SPIKE_SET_IDS = "base1,base4,xy12,cel25,swsh12.5,sv10.5b"
$env:SPIKE_DISTRACTOR_COUNT = "2000"
$env:SPIKE_DOWNLOAD_CONCURRENCY = "4"
$env:SPIKE_REQUEST_DELAY_MS = "120"
```

## 2. Build embeddings and indexes

```bash
npm run embed
```

Models:

- `Xenova/clip-vit-base-patch32`
- `Xenova/dinov2-small`
- `Xenova/mobileclip_s0`

MobileCLIP S0 is the lightweight baseline. A transformers.js MobileNetV3
artifact found during discovery exposes classification output rather than image
embeddings, so it was not silently substituted.

Both variants are generated:

- `whole`: whole image resized to the model input square.
- `center-crop`: centered 63:88 card crop, then resize.

Each model/variant writes:

- `indexes/<model>/<variant>/index.float32.bin`
- `indexes/<model>/<variant>/index.int8.bin`
- `indexes/<model>/<variant>/scales.float32.bin`
- `indexes/<model>/<variant>/index.json`

## 3. Generate synthetic proxy photos

```bash
npm run synthetic
```

The proxy combines random ±10° rotation, perspective warp, background padding,
brightness/contrast change, blur, synthetic glare, and JPEG compression. These
are proxy images, not real-phone validation.

Set `SPIKE_SYNTHETIC_QUERY_COUNT` to change the number of query images.

## 4. Add real photos

Read `photos/README.md`, place private images in `photos/`, and fill
`photos/labels.csv`. Image files are ignored by Git.

## 5. Evaluate and write the report

```bash
npm run evaluate
npm run report
```

Results:

- `results/evaluation.json`: machine-readable measurements.
- `results/REPORT.md`: generated report.

## Query one photo

```bash
npm run query -- path/to/photo.jpg \
  --model dino --preprocess center-crop --top 10
```

Accepted model fragments are `clip`, `dino`, and `mobileclip`. The command
outputs card keys, names, set metadata, and scores as JSON.

## Run everything

```bash
npm run spike
```

The orchestrator runs every stage in order. Images and embeddings are reused
from their caches, so reruns only perform missing work.
