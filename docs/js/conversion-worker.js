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

function rgbaToKey(r, g, b, a) {
  return (((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
}

function rgbaToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function baseName(fileName) {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
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

// --- AI / UPSCALE NORMALIZATION TOOLS ---

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

function detectPixelScale(imageData) {
  const { data, width, height } = imageData;
  const runLengths = {};
  const maxTestLines = 100;
  const step = Math.max(1, Math.floor(height / maxTestLines));

  for (let y = 0; y < height; y += step) {
    let currentRun = 1;
    let lastOff = (y * width) * 4;
    
    for (let x = 1; x < width; x++) {
      const off = (y * width + x) * 4;

      const dist = colorDistance(data[lastOff], data[lastOff+1], data[lastOff+2], data[off], data[off+1], data[off+2]);
      const alphaMatch = (data[lastOff+3] > 128) === (data[off+3] > 128);

      if (dist < 40 && alphaMatch) {
        currentRun++;
      } else {
        if (currentRun > 1 && currentRun < width / 4) {
          runLengths[currentRun] = (runLengths[currentRun] || 0) + 1;
        }
        currentRun = 1;
        lastOff = off;
      }
    }
  }

  let bestScale = 1;
  let maxCount = 0;
  
  // Ищем самую частую длину непрерывного цвета
  for (const [len, count] of Object.entries(runLengths)) {
    const l = parseInt(len);
    if (count > maxCount && l >= 2 && l <= 128) {
      maxCount = count;
      bestScale = l;
    }
  }
  
  return bestScale > 1 ? bestScale : Math.max(2, Math.floor(width / 150));
}

function downsampleBlockyImage(imageData, scale) {
  const { data, width: W, height: H } = imageData;
  const newW = Math.floor(W / scale);
  const newH = Math.floor(H / scale);
  const out = new Uint8ClampedArray(newW * newH * 4);

  for (let ny = 0; ny < newH; ny++) {
    for (let nx = 0; nx < newW; nx++) {
      const startX = nx * scale;
      const startY = ny * scale;
      const colorCounts = new Map();
      let bestKey = 0;
      let bestCount = 0;
      let bestColor = [0, 0, 0, 0];

      // Голосование за цвет внутри блока (majority vote)
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = startX + dx;
          const y = startY + dy;
          if (x >= W || y >= H) continue;
          
          const off = (y * W + x) * 4;
          let r = data[off];
          let g = data[off+1];
          let b = data[off+2];
          let a = data[off+3];
          
          if (a < 128) {
             r = 0; g = 0; b = 0; a = 0;
          } else {
             a = 255;
             r = Math.round(r / 16) * 16;
             g = Math.round(g / 16) * 16;
             b = Math.round(b / 16) * 16;
          }

          const key = (r << 24) | (g << 16) | (b << 8) | a;
          let count = (colorCounts.get(key) || 0) + 1;
          colorCounts.set(key, count);

          if (count > bestCount) {
            bestCount = count;
            bestKey = key;
            // Сохраняем оригинальный цвет (без квантизации) для финального рендера
            bestColor = [data[off], data[off+1], data[off+2], a]; 
          }
        }
      }

      const outOff = (ny * newW + nx) * 4;
      out[outOff] = bestColor[0];
      out[outOff+1] = bestColor[1];
      out[outOff+2] = bestColor[2];
      out[outOff+3] = bestColor[3];
    }
  }
  
  return { data: out, width: newW, height: newH };
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

    let finalImageData = imageData;
    if (imageData.width > 800 || imageData.height > 800) {
      const scale = detectPixelScale(imageData);
      if (scale > 1) {
        finalImageData = downsampleBlockyImage(imageData, scale);
      }
    }

    const svg = mode === 'lego'
      ? buildLegoSvgFromImageData(finalImageData)
      : buildMonolithSvgFromImageData(finalImageData);

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
