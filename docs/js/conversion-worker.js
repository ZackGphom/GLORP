// ---------------------------------------------------------
//  GLORP: The Pixel-to-Vector Beast v4.0.0 (Web Edition)
//  (c) 2026 ZackGphom. All rights reserved. 
//  This code is for NON-COMMERCIAL use only. 
//  If you use this code, you MUST credit ZackGphom.
// ---------------------------------------------------------
//  SPECIAL THANKS TO:
//  Harry Tsang
//  For the implementation of the high-performance Contour Meshing Engine.
// ---------------------------------------------------------

const CLOCKWISE = 1;
const ANTICLOCKWISE = 2;

const PIXEL_ART_SCALES = [2, 3, 4, 6, 8, 10, 12, 16];
const NORMALIZE_MAX_DIMENSION = 800;
const NORMALIZE_MAX_PIXELS = 800 * 800;
const MIN_NORMALIZE_PIXELS = 24 * 24;
const MAX_SAMPLE_PIXELS = 45000;
const MAX_NORMALIZED_OUTPUT_DIMENSION = 800;

function rgbaToKey(r, g, b, a) {
  return (((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
}

function rgbaToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function keyToRgba(key) {
  return {
    r: (key >>> 24) & 255,
    g: (key >>> 16) & 255,
    b: (key >>> 8) & 255,
    a: key & 255,
  };
}

function quantizeKey(r, g, b, a) {
  return (((r >>> 4) << 12) | ((g >>> 4) << 8) | ((b >>> 4) << 4) | (a >>> 4)) >>> 0;
}

function baseName(fileName) {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function pixelOffset(x, y, width) {
  return ((y * width) + x) * 4;
}

function createImageDataSafe(data, width, height) {
  if (typeof ImageData === 'function') {
    return new ImageData(data, width, height);
  }
  return { data, width, height };
}

function getPixelRGBA(data, offset) {
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  };
}

function getPixelKey(data, offset) {
  return rgbaToKey(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function estimatePixelArtScale(imageData) {
  const { data, width: W, height: H } = imageData;
  const totalPixels = W * H;

  if (W < 24 || H < 24 || totalPixels < MIN_NORMALIZE_PIXELS) {
    return null;
  }

  const sampleStep = Math.max(1, Math.floor(Math.sqrt(totalPixels / MAX_SAMPLE_PIXELS)));
  const sampleCount = Math.max(1, Math.floor(totalPixels / (sampleStep * sampleStep)));

  const quantizedUnique = new Set();
  let opaqueSamples = 0;
  let mixedAlphaSamples = 0;

  for (let y = 0; y < H; y += sampleStep) {
    for (let x = 0; x < W; x += sampleStep) {
      const off = pixelOffset(x, y, W);
      const a = data[off + 3];

      if (a > 0) {
        opaqueSamples++;
        if (a < 250) mixedAlphaSamples++;
      }

      quantizedUnique.add(quantizeKey(data[off], data[off + 1], data[off + 2], a));
      if (quantizedUnique.size > 8192) break;
    }
    if (quantizedUnique.size > 8192) break;
  }

  const uniqueRatio = quantizedUnique.size / Math.max(1, sampleCount);
  const alphaMixRatio = mixedAlphaSamples / Math.max(1, opaqueSamples);

  let best = null;

  for (const scale of PIXEL_ART_SCALES) {
    const cellsX = Math.floor(W / scale);
    const cellsY = Math.floor(H / scale);

    if (cellsX < 4 || cellsY < 4) continue;

    const sampleBlocksX = Math.max(2, Math.min(12, cellsX));
    const sampleBlocksY = Math.max(2, Math.min(12, cellsY));
    const strideX = Math.max(1, Math.floor(cellsX / sampleBlocksX));
    const strideY = Math.max(1, Math.floor(cellsY / sampleBlocksY));

    let totalBlockScore = 0;
    let sampledBlocks = 0;

    for (let by = 0; by < cellsY; by += strideY) {
      for (let bx = 0; bx < cellsX; bx += strideX) {
        const startX = bx * scale;
        const startY = by * scale;

        const blockKeys = new Uint32Array(scale * scale);
        const counts = new Map();

        let idx = 0;
        for (let dy = 0; dy < scale; dy++) {
          let offset = pixelOffset(startX, startY + dy, W);
          for (let dx = 0; dx < scale; dx++) {
            const key = quantizeKey(
              data[offset],
              data[offset + 1],
              data[offset + 2],
              data[offset + 3]
            );
            blockKeys[idx++] = key;
            counts.set(key, (counts.get(key) || 0) + 1);
            offset += 4;
          }
        }

        let dominantCount = 0;
        for (const value of counts.values()) {
          if (value > dominantCount) dominantCount = value;
        }

        let equalAdj = 0;
        let adjChecks = 0;

        for (let y = 0; y < scale; y++) {
          const rowBase = y * scale;
          for (let x = 1; x < scale; x++) {
            if (blockKeys[rowBase + x] === blockKeys[rowBase + x - 1]) equalAdj++;
            adjChecks++;
          }
        }

        for (let y = 1; y < scale; y++) {
          const rowBase = y * scale;
          const prevRowBase = (y - 1) * scale;
          for (let x = 0; x < scale; x++) {
            if (blockKeys[rowBase + x] === blockKeys[prevRowBase + x]) equalAdj++;
            adjChecks++;
          }
        }

        const dominantRatio = dominantCount / (scale * scale);
        const runScore = adjChecks ? (equalAdj / adjChecks) : 0;
        const blockScore = (dominantRatio * 0.72) + (runScore * 0.28);

        totalBlockScore += blockScore;
        sampledBlocks++;

        if (sampledBlocks >= 180) break;
      }
      if (sampledBlocks >= 180) break;
    }

    if (!sampledBlocks) continue;

    const avgBlockScore = totalBlockScore / sampledBlocks;

    let score = avgBlockScore;
    score -= Math.min(0.18, uniqueRatio * 0.12);
    score -= Math.min(0.12, alphaMixRatio * 0.16);

    if (W % scale === 0 && H % scale === 0) {
      score += 0.03;
    }

    if (!best || score > best.score) {
      best = {
        scale,
        score,
        uniqueRatio,
        alphaMixRatio,
        avgBlockScore,
      };
    }
  }

  return best;
}

function isLikelyPixelArt(imageData, stats = null) {
  const { width: W, height: H } = imageData;
  const totalPixels = W * H;

  if (W < 24 || H < 24 || totalPixels < MIN_NORMALIZE_PIXELS) {
    return false;
  }

  const s = stats || estimatePixelArtScale(imageData);
  if (!s) return false;

  const score = s.score ?? 0;
  const uniqueRatio = s.uniqueRatio ?? 1;
  const alphaMixRatio = s.alphaMixRatio ?? 1;

  if (score >= 0.58) return true;
  if (score >= 0.50 && uniqueRatio <= 0.65) return true;
  if (score >= 0.44 && uniqueRatio <= 0.45 && alphaMixRatio <= 0.45) return true;

  if (totalPixels >= 320000 && score >= 0.42 && uniqueRatio <= 0.80) {
    return true;
  }

  return false;
}

function downsampleByMajority(imageData, scale) {
  const { data, width: W, height: H } = imageData;
  const newW = Math.floor(W / scale);
  const newH = Math.floor(H / scale);

  if (newW < 1 || newH < 1) {
    return imageData;
  }

  const out = new Uint8ClampedArray(newW * newH * 4);

  for (let by = 0; by < newH; by++) {
    const srcY = by * scale;

    for (let bx = 0; bx < newW; bx++) {
      const srcX = bx * scale;
      const counts = new Map();
      let bestKey = 0;
      let bestCount = 0;
      let bestSample = null;
      let transparentCount = 0;

      for (let dy = 0; dy < scale; dy++) {
        let offset = pixelOffset(srcX, srcY + dy, W);

        for (let dx = 0; dx < scale; dx++) {
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          const a = data[offset + 3];

          const key = a < 5 ? 0 : quantizeKey(r, g, b, a > 250 ? 255 : a);

          if (key === 0) {
            transparentCount++;
          } else {
            let entry = counts.get(key);
            if (!entry) {
              entry = { count: 0, r, g, b, a: a > 250 ? 255 : a };
              counts.set(key, entry);
            }
            entry.count++;

            if (entry.count > bestCount) {
              bestCount = entry.count;
              bestKey = key;
              bestSample = entry;
            }
          }

          offset += 4;
        }
      }

      if (transparentCount >= bestCount) {
        bestKey = 0;
        bestSample = null;
      }

      const dst = (by * newW + bx) * 4;

      if (bestKey === 0 || !bestSample) {
        out[dst] = 0;
        out[dst + 1] = 0;
        out[dst + 2] = 0;
        out[dst + 3] = 0;
      } else {
        out[dst] = bestSample.r;
        out[dst + 1] = bestSample.g;
        out[dst + 2] = bestSample.b;
        out[dst + 3] = bestSample.a;
      }
    }
  }

  return createImageDataSafe(out, newW, newH);
}

function cleanupPixelNoise(imageData) {
  const { data, width: W, height: H } = imageData;
  const current = new Uint8ClampedArray(data);
  const idx = (x, y) => ((y * W) + x) * 4;

  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? current : new Uint8ClampedArray(current);
    const dst = new Uint8ClampedArray(src);

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = idx(x, y);
        const a = src[p + 3];
        if (a < 5) continue;

        const selfKey = rgbaToKey(
          src[p],
          src[p + 1],
          src[p + 2],
          a > 250 ? 255 : a
        );

        let orthSame = 0;
        let validNeighbors = 0;
        const counts = new Map();
        let bestNeighborKey = selfKey;
        let bestNeighborCount = 0;

        const offsets = [
          idx(x - 1, y),
          idx(x + 1, y),
          idx(x, y - 1),
          idx(x, y + 1),
          idx(x - 1, y - 1),
          idx(x + 1, y - 1),
          idx(x - 1, y + 1),
          idx(x + 1, y + 1),
        ];

        for (let n = 0; n < offsets.length; n++) {
          const q = offsets[n];
          const na = src[q + 3];
          if (na < 5) continue;

          const nk = rgbaToKey(
            src[q],
            src[q + 1],
            src[q + 2],
            na > 250 ? 255 : na
          );

          validNeighbors++;
          const nextCount = (counts.get(nk) || 0) + 1;
          counts.set(nk, nextCount);

          if (nextCount > bestNeighborCount) {
            bestNeighborCount = nextCount;
            bestNeighborKey = nk;
          }

          if (n < 4 && nk === selfKey) orthSame++;
        }

        if (orthSame > 0) continue;
        if (validNeighbors < 5) continue;
        if (bestNeighborCount < 5) continue;
        if (bestNeighborCount / validNeighbors < 0.7) continue;

        const rgba = keyToRgba(bestNeighborKey);
        dst[p] = rgba.r;
        dst[p + 1] = rgba.g;
        dst[p + 2] = rgba.b;
        dst[p + 3] = rgba.a;
      }
    }

    current.set(dst);
  }

  return createImageDataSafe(current, W, H);
}

function limitOutputSize(imageData, maxDimension = MAX_NORMALIZED_OUTPUT_DIMENSION) {
  const { width: W, height: H } = imageData;
  const maxSide = Math.max(W, H);

  if (maxSide <= maxDimension) return imageData;

  const safetyScale = Math.ceil(maxSide / maxDimension);
  if (safetyScale <= 1) return imageData;

  return downsampleByMajority(imageData, safetyScale);
}

function normalizePixelArt(imageData) {
  const { width: W, height: H } = imageData;

  if (W <= NORMALIZE_MAX_DIMENSION && H <= NORMALIZE_MAX_DIMENSION && (W * H) <= NORMALIZE_MAX_PIXELS) {
    return imageData;
  }

  const estimate = estimatePixelArtScale(imageData);
  if (!estimate || !isLikelyPixelArt(imageData, estimate)) {
    return imageData;
  }

  const scale = estimate.scale;
  if (!scale || scale < 2) return imageData;

  const cellsX = Math.floor(W / scale);
  const cellsY = Math.floor(H / scale);
  if (cellsX < 4 || cellsY < 4) return imageData;

  let normalized = downsampleByMajority(imageData, scale);
  normalized = cleanupPixelNoise(normalized);
  normalized = limitOutputSize(normalized, MAX_NORMALIZED_OUTPUT_DIMENSION);

  if (
    normalized &&
    normalized.width >= 4 &&
    normalized.height >= 4 &&
    normalized.width * normalized.height >= 16
  ) {
    normalized = cleanupPixelNoise(normalized);
  }

  return normalized;
}

// --- CORE MESHING ENGINE ---

function edgeFinding(grid, W, H) {
  const ver_edges = new Uint8Array(H * (W + 1));
  const hor_edges = new Uint8Array((H + 1) * W);

  for (let r = 0; r <= H; r++) {
    for (let c = 0; c < W; c++) {
      const p = (r < H) ? grid[r * W + c] : 0;
      const prev_p = (r > 0) ? grid[(r - 1) * W + c] : 0;
      const n = 1 - prev_p;

      if (p === 1 && n === 1) hor_edges[r * W + c] = CLOCKWISE;
      else if (p === 0 && n === 0) hor_edges[r * W + c] = ANTICLOCKWISE;
    }
  }

  for (let r = 0; r < H; r++) {
    for (let c = 0; c <= W; c++) {
      const p = (c < W) ? grid[r * W + c] : 0;
      const prev_p = (c > 0) ? grid[r * W + (c - 1)] : 0;
      const n = 1 - prev_p;

      if (p === 1 && n === 1) ver_edges[r * (W + 1) + c] = ANTICLOCKWISE;
      else if (p === 0 && n === 0) ver_edges[r * (W + 1) + c] = CLOCKWISE;
    }
  }

  return { ver_edges, hor_edges };
}

function tracePath(startR, startC, ver_edges, hor_edges, W, H) {
  let path = "";
  let r = startR;
  let c = startC;
  let dir = 'R';

  while (true) {
    if (dir === 'R') {
      let destC;
      for (destC = c; destC < W; destC++) {
        if (hor_edges[r * W + destC] === CLOCKWISE) hor_edges[r * W + destC] = 0;
        else break;
      }
      path += `h${destC - c}`;
      if (destC < (W + 1) && ver_edges[r * (W + 1) + destC] === CLOCKWISE) {
        c = destC; dir = 'D';
      } else if (r > 0 && ver_edges[(r - 1) * (W + 1) + destC] === ANTICLOCKWISE) {
        r = r - 1; c = destC; dir = 'U';
      } else break;

    } else if (dir === 'D') {
      let destR;
      for (destR = r; destR < H; destR++) {
        if (ver_edges[destR * (W + 1) + c] === CLOCKWISE) ver_edges[destR * (W + 1) + c] = 0;
        else break;
      }
      path += `v${destR - r}`;
      if (c > 0 && hor_edges[destR * W + (c - 1)] === ANTICLOCKWISE) {
        r = destR; c = c - 1; dir = 'L';
      } else if (destR < (H + 1) && hor_edges[destR * W + c] === CLOCKWISE) {
        r = destR; dir = 'R';
      } else break;

    } else if (dir === 'L') {
      let destC;
      for (destC = c; destC >= 0; destC--) {
        if (hor_edges[r * W + destC] === ANTICLOCKWISE) hor_edges[r * W + destC] = 0;
        else break;
      }
      path += `h${destC - c}`;
      if (r > 0 && ver_edges[(r - 1) * (W + 1) + (destC + 1)] === ANTICLOCKWISE) {
        r = r - 1; c = destC + 1; dir = 'U';
      } else if ((destC + 1) < (W + 1) && ver_edges[r * (W + 1) + (destC + 1)] === CLOCKWISE) {
        c = destC + 1; dir = 'D';
      } else break;

    } else if (dir === 'U') {
      let destR;
      for (destR = r; destR >= 0; destR--) {
        if (ver_edges[destR * (W + 1) + c] === ANTICLOCKWISE) ver_edges[destR * (W + 1) + c] = 0;
        else break;
      }
      path += `v${destR - r}`;
      if (hor_edges[(destR + 1) * W + c] === CLOCKWISE) {
        r = destR + 1; dir = 'R';
      } else if (c > 0 && hor_edges[(destR + 1) * W + (c - 1)] === ANTICLOCKWISE) {
        r = destR + 1; c = c - 1; dir = 'L';
      } else break;
    }
  }
  return path;
}

function pathFinding(grid, W, H) {
  const { ver_edges, hor_edges } = edgeFinding(grid, W, H);
  let path_data = "";
  const hor_len = (H + 1) * W;

  for (let i = 0; i < hor_len; i++) {
    if (hor_edges[i] === CLOCKWISE) {
      let r = Math.floor(i / W);
      let c = i % W;
      path_data += `M${c},${r}`;
      path_data += tracePath(r, c, ver_edges, hor_edges, W, H);
      path_data += "z";
    }
  }
  return path_data;
}

function buildLegoSvgFromImageData(imageData) {
  const { data, width, height } = imageData;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${rgbaToHex(data[i], data[i + 1], data[i + 2])}" fill-opacity="${(alpha / 255).toFixed(3)}"/>`;
  }

  svg += '</svg>';
  return svg;
}

function buildMonolithSvgFromImageData(imageData) {
  const { data, width: W, height: H } = imageData;

  const uniqueColors = new Map();
  const colorMap = new Uint32Array(W * H);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let a = data[i + 3];

    if (a < 5) {
      colorMap[i / 4] = 0;
      continue;
    }

    if (a > 250) a = 255;

    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

    if (!uniqueColors.has(key)) {
      uniqueColors.set(key, { r, g, b, a });
    }
    colorMap[i / 4] = key;
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`;
  const grid = new Uint8Array(W * H);

  for (const [key, p] of uniqueColors) {
    grid.fill(0);
    let hasPixels = false;

    for (let i = 0; i < W * H; i++) {
      if (colorMap[i] === key) {
        grid[i] = 1;
        hasPixels = true;
      }
    }

    if (hasPixels) {
      const pathData = pathFinding(grid, W, H);
      if (pathData) {
        svg += `<path d="${pathData}" fill="${rgbaToHex(p.r, p.g, p.b)}" fill-opacity="${(p.a / 255).toFixed(3)}" fill-rule="evenodd"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

async function decodeFile(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not available in this worker');
  }

  const bitmap = await createImageBitmap(file, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none'
  });

  if (typeof OffscreenCanvas !== 'function') {
    if (bitmap.close) bitmap.close();
    throw new Error('OffscreenCanvas is not available in this worker');
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { 
    willReadFrequently: true,
    colorSpace: 'srgb'
  });
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb' });
  return { canvas, imageData, width: canvas.width, height: canvas.height };
}

self.onmessage = async (event) => {
  const { id, file, mode } = event.data || {};

  try {
    const { canvas, imageData } = await decodeFile(file);
    const filename = `${baseName(file.name)}.${mode === 'webp' ? 'webp' : 'svg'}`;

    if (mode === 'webp') {
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 1 });
      self.postMessage({ id, ok: true, blob, filename });
      return;
    }

    const normalizedImageData = normalizePixelArt(imageData);

    const svg = mode === 'lego'
      ? buildLegoSvgFromImageData(normalizedImageData)
      : buildMonolithSvgFromImageData(normalizedImageData);

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    self.postMessage({ id, ok: true, blob, filename });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: String(error && error.message ? error.message : error || 'Conversion failed'),
    });
  }
};
