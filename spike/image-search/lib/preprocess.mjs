import sharp from "sharp";
import { RawImage } from "@huggingface/transformers";

export const CARD_ASPECT_RATIO = 63 / 88;
export const PREPROCESSING_VARIANTS = ["whole", "center-crop"];

function cardCrop(width, height) {
  if (width / height > CARD_ASPECT_RATIO) {
    const cropWidth = Math.max(1, Math.round(height * CARD_ASPECT_RATIO));
    return {
      left: Math.floor((width - cropWidth) / 2),
      top: 0,
      width: cropWidth,
      height,
    };
  }
  const cropHeight = Math.max(1, Math.round(width / CARD_ASPECT_RATIO));
  return {
    left: 0,
    top: Math.floor((height - cropHeight) / 2),
    width,
    height: cropHeight,
  };
}

export async function prepareImage(imagePath, size, variant) {
  let image = sharp(imagePath, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions for ${imagePath}.`);
  }
  if (variant === "center-crop") {
    image = image.extract(cardCrop(metadata.width, metadata.height));
  }
  const { data, info } = await image
    .removeAlpha()
    .resize(size, size, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
}

export function normalizeVector(values) {
  let squaredNorm = 0;
  for (const value of values) squaredNorm += value * value;
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm <= 0) {
    throw new Error("Model produced a zero or invalid embedding.");
  }
  return Float32Array.from(values, (value) => value / norm);
}
