import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createRng, ensureDir, normalizeName } from "./common.mjs";

function solveLinear(matrix, values) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
        pivot = row;
      }
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-12) throw new Error("Singular homography matrix.");
    for (let item = column; item <= size; item += 1) {
      augmented[column][item] /= divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= size; item += 1) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function homography(source, target) {
  const matrix = [];
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = target[index];
    const [u, v] = source[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  return solveLinear(matrix, values);
}

function writeBilinear(output, outputIndex, data, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) return false;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const at = (px, py, channel) => data[(py * width + px) * 3 + channel];
  for (let channel = 0; channel < 3; channel += 1) {
    const top =
      at(x0, y0, channel) * (1 - tx) + at(x0 + 1, y0, channel) * tx;
    const bottom =
      at(x0, y0 + 1, channel) * (1 - tx) +
      at(x0 + 1, y0 + 1, channel) * tx;
    output[outputIndex + channel] = Math.round(top * (1 - ty) + bottom * ty);
  }
  return true;
}

function rotatedRectangle(rng, width, height) {
  const angle = ((rng() * 20 - 10) * Math.PI) / 180;
  const scale = 0.68 + rng() * 0.18;
  const cardWidth = width * scale;
  const cardHeight = cardWidth * (88 / 63);
  const centerX = width / 2;
  const centerY = height / 2;
  const corners = [
    [-cardWidth / 2, -cardHeight / 2],
    [cardWidth / 2, -cardHeight / 2],
    [cardWidth / 2, cardHeight / 2],
    [-cardWidth / 2, cardHeight / 2],
  ].map(([x, y]) => [
    centerX + x * Math.cos(angle) - y * Math.sin(angle) + (rng() - 0.5) * width * 0.035,
    centerY + x * Math.sin(angle) + y * Math.cos(angle) + (rng() - 0.5) * height * 0.025,
  ]);
  return { corners, angleDegrees: (angle * 180) / Math.PI };
}

async function perspectiveComposite(sourcePath, rng) {
  const outputWidth = 640;
  const outputHeight = 850;
  const background = Math.round(35 + rng() * 205);
  const { data: sourceData, info } = await sharp(sourcePath)
    .rotate()
    .removeAlpha()
    .resize(400, 550, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(outputWidth * outputHeight * 3, background);
  const sourceCorners = [
    [0, 0],
    [info.width - 1, 0],
    [info.width - 1, info.height - 1],
    [0, info.height - 1],
  ];
  const transformed = rotatedRectangle(rng, outputWidth, outputHeight);
  const targetCorners = transformed.corners;
  const h = homography(sourceCorners, targetCorners);
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const denominator = h[6] * x + h[7] * y + 1;
      const sourceX = (h[0] * x + h[1] * y + h[2]) / denominator;
      const sourceY = (h[3] * x + h[4] * y + h[5]) / denominator;
      const outputIndex = (y * outputWidth + x) * 3;
      writeBilinear(
        output,
        outputIndex,
        sourceData,
        info.width,
        info.height,
        sourceX,
        sourceY,
      );
    }
  }
  return {
    pipeline: sharp(output, {
      raw: { width: outputWidth, height: outputHeight, channels: 3 },
    }),
    rotationDegrees: transformed.angleDegrees,
  };
}

function glareSvg(width, height, rng) {
  const x = Math.round(rng() * width);
  const y = Math.round(rng() * height * 0.65);
  const radius = Math.round(width * (0.28 + rng() * 0.25));
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glare">
          <stop offset="0%" stop-color="#fff" stop-opacity="${(0.22 + rng() * 0.35).toFixed(2)}"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="${x}" cy="${y}" rx="${radius}" ry="${Math.round(radius * 0.62)}" fill="url(#glare)"/>
    </svg>
  `);
}

export async function generateSyntheticImage(sourcePath, targetPath, rng) {
  const transformed = await perspectiveComposite(sourcePath, rng);
  let pipeline = transformed.pipeline;
  const brightness = 0.72 + rng() * 0.5;
  const contrast = 0.72 + rng() * 0.55;
  const addGlare = rng() < 0.72;
  if (addGlare) {
    pipeline = pipeline.composite([
      {
        input: glareSvg(640, 850, rng),
        blend: "screen",
      },
    ]);
  }
  ensureDir(path.dirname(targetPath));
  const jpegQuality = Math.round(45 + rng() * 38);
  await pipeline
    .modulate({ brightness })
    .linear(contrast, 128 * (1 - contrast))
    .blur(0.3 + rng() * 0.9)
    .jpeg({ quality: jpegQuality, mozjpeg: true })
    .toFile(targetPath);
  return {
    rotationDegrees: transformed.rotationDegrees,
    brightness,
    contrast,
    glare: addGlare,
    jpegQuality,
  };
}

export function sameArtworkGroups(cards) {
  const groups = new Map();
  for (const card of cards) {
    const name = normalizeName(card.name);
    const key = card.artist
      ? `${name}|${normalizeName(card.artist)}`
      : `${name}|missing-artist`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card.cardKey);
  }
  return groups;
}
