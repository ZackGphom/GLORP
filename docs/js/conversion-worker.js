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
const MIN_NORMALIZE_PIXELS = 24 * 24;
const MAX_SAMPLE_PIXELS = 40000;

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

function getPixelKey(data, offset) {
  return rgbaToKey(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function createImageDataSafe(data, width, height) {
  if (typeof ImageData === 'function') {
    return new ImageData(data, width, height);
  }
  return { data, width, height };
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
      const offset = pixelOffset(x, y, W);
      const a = data[offset + 3];

      if (a > 0) {
        opaqueSamples++;
        if (a < 250) mixedAlphaSamples++;
      }

      quantizedUnique.add(quantizeKey(data[offset], data[offset + 1], data[offset + 2], a));
      if (quantizedUnique.size > 4096) break;
    }
    if (quantizedUnique.size > 4096) break;
  }

  const uniqueRatio = quantizedUnique.size / Math.max(1, sampleCount);
  const alphaMixRatio = mixedAlphaSamples / Math.max(1, opaqueSamples);

  let best = null;

  for (const scale of PIXEL_ART_SCALES) {
    const cellsX = Math.floor(W / scale);
    const cellsY = Math.floor(H / scale);
    if (cellsX < 4 || cellsY < 4) continue;

    const usableW = cellsX * scale;
    const usableH = cellsY * scale;
    const remainderPenalty = ((W - usableW) + (H - usableH)) / Math.max(1, scale * 2);
    const cellStepX = Math.max(1, Math.floor(cellsX / 24));
    const cellStepY = Math.max(1, Math.floor(cellsY / 24));

    let rowMatched = 0;
    let rowTotal = 0;
    let colMatched = 0;
    let colTotal = 0;

    for (let cy = 0; cy < cellsY; cy += cellStepY) {
      const y0 = cy * scale;

      for (let off = 1; off < scale; off++) {
        const y1 = y0 + off;

        for (let cx = 0; cx < cellsX; cx += cellStepX) {
          const x = cx * scale;
          const p0 = pixelOffset(x, y0, W);
          const p1 = pixelOffset(x, y1, W);

          if (
            data[p0] === data[p1] &&
            data[p0 + 1] === data[p1 + 1] &&
            data[p0 + 2] === data[p1 + 2] &&
            data[p0 + 3] === data[p1 + 3]
          ) {
            rowMatched++;
          }
          rowTotal++;
        }
      }
    }

    for (let cx = 0; cx < cellsX; cx += cellStepX) {
      const x0 = cx * scale;

      for (let off = 1; off < scale; off++) {
        const x1 = x0 + off;

        for (let cy = 0; cy < cellsY; cy += cellStepY) {
          const y = cy * scale;
          const p0 = pixelOffset(x0, y, W);
          const p1 = pixelOffset(x1, y, W);

          if (
            data[p0] === data[p1] &&
            data[p0 + 1] === data[p1 + 1] &&
            data[p0 + 2] === data[p1 + 2] &&
            data[p0 + 3] === data[p1 + 3]
          ) {
            colMatched++;
          }
          colTotal++;
        }
      }
    }

    const rowScore = rowTotal ? rowMatched / rowTotal : 0;
    const colScore = colTotal ? colMatched / colTotal : 0;

    let blockMatchedRatio = 0;
    let sampledBlocks = 0;
    const blockStepX = Math.max(1, Math.floor(cellsX / 16));
    const blockStepY = Math.max(1, Math.floor(cellsY / 16));

    for (let by = 0; by < cellsY; by += blockStepY) {
      for (let bx = 0; bx < cellsX; bx += blockStepX) {
        const counts = new Map();
        const startX = bx * scale;
        const startY = by * scale;

        let bestCount = 0;
        let pxCount = 0;

        for (let dy = 0; dy < scale; dy++) {
          let offset = pixelOffset(startX, startY + dy, W);

          for (let dx = 0; dx < scale; dx++) {
            const key = getPixelKey(data, offset);
            const next = (counts.get(key) || 0) + 1;
            counts.set(key, next);
            if (next > bestCount) bestCount = next;
            offset += 4;
            pxCount++;
          }
        }

        blockMatchedRatio += bestCount / Math.max(1, pxCount);
        sampledBlocks++;
      }
    }

    const blockScore = sampledBlocks ? blockMatchedRatio / sampledBlocks : 0;
    const divisibilityBonus = 1 - Math.min(1, Math.max(0, remainderPenalty) / Math.max(1, scale));
    const score = (rowScore * 0.38) + (colScore * 0.38) + (blockScore * 0.24);
    const adjustedScore = score * (0.92 + (divisibilityBonus * 0.08));

    if (!best || adjustedScore > best.score) {
      best = {
        scale,
        score: adjustedScore,
        rowScore,
        colScore,
        blockScore,
        uniqueRatio,
        alphaMixRatio,
        divisibilityBonus,
      };
    }
  }

  if (!best) return null;

  return {
    ...best,
    likelyPixelArt: isLikelyPixelArt(imageData, {
      uniqueRatio,
      alphaMixRatio,
      best,
    }),
  };
}

function isLikelyPixelArt(imageData, stats = null) {
  const { width: W, height: H } = imageData;
  if (W < 24 || H < 24 || W * H < MIN_NORMALIZE_PIXELS) {
    return false;
  }

  const s = stats || estimatePixelArtScale(imageData);
  if (!s) return false;

  const uniqueRatio = s.uniqueRatio ?? 1;
  const alphaMixRatio = s.alphaMixRatio ?? 1;
  const score = s.best?.score ?? s.score ?? 0;

  if (score >= 0.72) return true;
  if (score >= 0.66 && uniqueRatio <= 0.30 && alphaMixRatio <= 0.35) return true;
  if (score >= 0.62 && uniqueRatio <= 0.18) return true;
  return false;
}

function downsampleBlockMajority(data, W, H, scale) {
  const newW = Math.floor(W / scale);
  const newH = Math.floor(H / scale);
  const out = new Uint8ClampedArray(newW * newH * 4);

  for (let by = 0; by < newH; by++) {
    const srcY = by * scale;

    for (let bx = 0; bx < newW; bx++) {
      const srcX = bx * scale;
      const counts = new Map();
      let bestKey = 0;
      let bestCount = 0;
      let transparentCount = 0;

      for (let dy = 0; dy < scale; dy++) {
        let offset = pixelOffset(srcX, srcY + dy, W);

        for (let dx = 0; dx < scale; dx++) {
          const a = data[offset + 3];
          const key = a < 5
            ? 0
            : rgbaToKey(data[offset], data[offset + 1], data[offset + 2], a > 250 ? 255 : a);

          if (key === 0) transparentCount++;

          const next = (counts.get(key) || 0) + 1;
          counts.set(key, next);

          if (next > bestCount) {
            bestCount = next;
            bestKey = key;
          }

          offset += 4;
        }
      }

      if (transparentCount >= bestCount) {
        bestKey = 0;
      }

      const dst = (by * newW + bx) * 4;
      const rgba = keyToRgba(bestKey);
      out[dst] = rgba.r;
      out[dst + 1] = rgba.g;
      out[dst + 2] = rgba.b;
      out[dst + 3] = rgba.a;
    }
  }

  return { data: out, width: newW, height: newH };
}

function cleanupPixelNoise(imageData) {
  const { data, width: W, height: H } = imageData;
  const dst = new Uint8ClampedArray(data);
  const idx = (x, y) => ((y * W) + x) * 4;

  for (let pass = 0; pass < 2; pass++) {
    const current = pass === 0 ? dst : new Uint8ClampedArray(dst);
    const next = new Uint8ClampedArray(current);

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = idx(x, y);
        const a = current[p + 3];
        if (a < 5) continue;

        const currentKey = rgbaToKey(
          current[p],
          current[p + 1],
          current[p + 2],
          a > 250 ? 255 : a
        );

        let sameOrthogonal = 0;
        const neighborCounts = new Map();
        let bestNeighborKey = currentKey;
        let bestNeighborCount = 0;
        let validNeighbors = 0;

        for (let ny = -1; ny <= 1; ny++) {
          for (let nx = -1; nx <= 1; nx++) {
            if (nx === 0 && ny === 0) continue;

            const q = idx(x + nx, y + ny);
            const qa = current[q + 3];
            if (qa < 5) continue;

            const key = rgbaToKey(
              current[q],
              current[q + 1],
              current[q + 2],
              qa > 250 ? 255 : qa
            );

            validNeighbors++;
            const nextCount = (neighborCounts.get(key) || 0) + 1;
            neighborCounts.set(key, nextCount);

            if (nextCount > bestNeighborCount) {
              bestNeighborCount = nextCount;
              bestNeighborKey = key;
            }
          }
        }

        const leftOffset = idx(x - 1, y);
        const rightOffset = idx(x + 1, y);
        const upOffset = idx(x, y - 1);
        const downOffset = idx(x, y + 1);

        const leftKey = rgbaToKey(
          current[leftOffset],
          current[leftOffset + 1],
          current[leftOffset + 2],
          current[leftOffset + 3] > 250 ? 255 : current[leftOffset + 3]
        );
        const rightKey = rgbaToKey(
          current[rightOffset],
          current[rightOffset + 1],
          current[rightOffset + 2],
          current[rightOffset + 3] > 250 ? 255 : current[rightOffset + 3]
        );
        const upKey = rgbaToKey(
          current[upOffset],
          current[upOffset + 1],
          current[upOffset + 2],
          current[upOffset + 3] > 250 ? 255 : current[upOffset + 3]
        );
        const downKey = rgbaToKey(
          current[downOffset],
          current[downOffset + 1],
          current[downOffset + 2],
          current[downOffset + 3] > 250 ? 255 : current[downOffset + 3]
        );

        if (leftKey === currentKey) sameOrthogonal++;
        if (rightKey === currentKey) sameOrthogonal++;
        if (upKey === currentKey) sameOrthogonal++;
        if (downKey === currentKey) sameOrthogonal++;

        if (sameOrthogonal > 0) continue;
        if (validNeighbors < 5) continue;
        if (bestNeighborCount < 5) continue;
        if (bestNeighborCount / validNeighbors < 0.7) continue;

        const rgba = keyToRgba(bestNeighborKey);
        next[p] = rgba.r;
        next[p + 1] = rgba.g;
        next[p + 2] = rgba.b;
        next[p + 3] = rgba.a;
      }
    }

    dst.set(next);
  }

  return { data: dst, width: W, height: H };
}

function normalizePixelArt(imageData) {
  const { width: W, height: H } = imageData;

  const estimate = estimatePixelArtScale(imageData);
  if (!estimate || !estimate.likelyPixelArt) return imageData;

  const scale = estimate.scale;
  if (!scale || scale < 2) return imageData;

  const cellsX = Math.floor(W / scale);
  const cellsY = Math.floor(H / scale);
  if (cellsX < 4 || cellsY < 4) return imageData;

  const downsampled = downsampleBlockMajority(imageData.data, W, H, scale);

  if (downsampled.width < 4 || downsampled.height < 4) {
    return imageData;
  }

  const cleaned = cleanupPixelNoise(downsampled);
  return createImageDataSafe(cleaned.data, cleaned.width, cleaned.height);
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
