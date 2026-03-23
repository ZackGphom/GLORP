const CLOCKWISE = 1;
const ANTICLOCKWISE = 2;

function rgbaToKey(r, g, b, a) {
  return (((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
}

function keyToCssRgba(key) {
  const r = (key >>> 24) & 255;
  const g = (key >>> 16) & 255;
  const b = (key >>> 8) & 255;
  const a = key & 255;
  return {
    fill: `rgb(${r} ${g} ${b})`,
    opacity: (a / 255).toFixed(6),
  };
}

function edgeFinding(grid, width, height, color) {
  const verEdges = new Uint8Array(height * (width + 1));
  const horEdges = new Uint8Array((height + 1) * width);

  const positiveVer = new Uint8Array(height * (width + 1));
  const positiveHor = new Uint8Array((height + 1) * width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === color) {
        positiveVer[y * (width + 1) + x] = 1;
        positiveHor[y * width + x] = 1;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    const rowBase = y * (width + 1);
    for (let x = 0; x < width + 1; x++) {
      const current = positiveVer[rowBase + x];
      const prevX = x === 0 ? width : x - 1;
      const rolled = 1 - positiveVer[rowBase + prevX];
      if (current - rolled === 0) {
        verEdges[rowBase + x] = (current + rolled === 2) ? 2 : 1;
      }
    }
  }

  for (let y = 0; y < height + 1; y++) {
    const rowBase = y * width;
    const prevY = y === 0 ? height : y - 1;
    const rolledBase = prevY * width;
    for (let x = 0; x < width; x++) {
      const current = positiveHor[rowBase + x];
      const rolled = 1 - positiveHor[rolledBase + x];
      if (current - rolled === 0) {
        horEdges[rowBase + x] = (current + rolled === 2) ? 1 : 2;
      }
    }
  }

  return { verEdges, horEdges };
}

function exploreUp(x, y, verEdges, horEdges, width, height) {
  let destX = x;
  let broke = false;

  for (; destX >= 0; destX--) {
    const idx = destX * (width + 1) + y;
    if (verEdges[idx] === ANTICLOCKWISE) {
      verEdges[idx] = 0;
    } else {
      broke = true;
      break;
    }
  }

  if (!broke) destX -= 1;

  let path = `v${destX - x}`;

  const nextRow = destX + 1;
  if (nextRow < height + 1) {
    const rightIdx = nextRow * width + y;
    if (horEdges[rightIdx] === CLOCKWISE) {
      return path + exploreRight(nextRow, y, verEdges, horEdges, width, height);
    }

    if (y > 0) {
      const leftIdx = nextRow * width + (y - 1);
      if (horEdges[leftIdx] === ANTICLOCKWISE) {
        return path + exploreLeft(nextRow, y - 1, verEdges, horEdges, width, height);
      }
    }
  }

  return path;
}

function exploreLeft(x, y, verEdges, horEdges, width, height) {
  let destY = y;
  let broke = false;

  for (; destY >= 0; destY--) {
    const idx = x * width + destY;
    if (horEdges[idx] === ANTICLOCKWISE) {
      horEdges[idx] = 0;
    } else {
      broke = true;
      break;
    }
  }

  if (!broke) destY -= 1;

  let path = `h${destY - y}`;

  if (x > 0) {
    const upIdx = (x - 1) * (width + 1) + (destY + 1);
    if (verEdges[upIdx] === ANTICLOCKWISE) {
      return path + exploreUp(x - 1, destY + 1, verEdges, horEdges, width, height);
    }
  }

  if (destY < width) {
    const downIdx = x * (width + 1) + (destY + 1);
    if (verEdges[downIdx] === CLOCKWISE) {
      return path + exploreDown(x, destY + 1, verEdges, horEdges, width, height);
    }
  }

  return path;
}

function exploreDown(x, y, verEdges, horEdges, width, height) {
  let destX = x;
  let broke = false;

  for (; destX < height; destX++) {
    const idx = destX * (width + 1) + y;
    if (verEdges[idx] === CLOCKWISE) {
      verEdges[idx] = 0;
    } else {
      broke = true;
      break;
    }
  }

  if (!broke) destX += 1;

  let path = `v${destX - x}`;

  if (y > 0) {
    const leftIdx = destX * width + (y - 1);
    if (horEdges[leftIdx] === ANTICLOCKWISE) {
      return path + exploreLeft(destX, y - 1, verEdges, horEdges, width, height);
    }
  }

  if (destX < height + 1) {
    const rightIdx = destX * width + y;
    if (horEdges[rightIdx] === CLOCKWISE) {
      return path + exploreRight(destX, y, verEdges, horEdges, width, height);
    }
  }

  return path;
}

function exploreRight(x, y, verEdges, horEdges, width, height) {
  let destY = y;
  let broke = false;

  for (; destY < width; destY++) {
    const idx = x * width + destY;
    if (horEdges[idx] === CLOCKWISE) {
      horEdges[idx] = 0;
    } else {
      broke = true;
      break;
    }
  }

  if (!broke) destY += 1;

  let path = `h${destY - y}`;

  if (destY < width + 1) {
    const downIdx = x * (width + 1) + destY;
    if (verEdges[downIdx] === CLOCKWISE) {
      return path + exploreDown(x, destY, verEdges, horEdges, width, height);
    }
  }

  if (x > 0) {
    const upIdx = (x - 1) * (width + 1) + destY;
    if (verEdges[upIdx] === ANTICLOCKWISE) {
      return path + exploreUp(x - 1, destY, verEdges, horEdges, width, height);
    }
  }

  return path;
}

function pathFinding(grid, width, height, color) {
  const { verEdges, horEdges } = edgeFinding(grid, width, height, color);
  let pathData = '';

  while (true) {
    let startX = -1;
    let startY = -1;

    for (let x = 0; x < height + 1 && startX === -1; x++) {
      for (let y = 0; y < width; y++) {
        if (horEdges[x * width + y] === CLOCKWISE) {
          startX = x;
          startY = y;
          break;
        }
      }
    }

    if (startX === -1) break;

    pathData += `M${startY},${startX}`;
    pathData += exploreRight(startX, startY, verEdges, horEdges, width, height);
    pathData += 'z';
  }

  return pathData;
}

function collectColorsAndGrid(imageData) {
  const { data, width, height } = imageData;
  const grid = new Uint32Array(width * height);
  const colors = [];
  const seen = new Map();

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    if (a === 0) {
      grid[p] = 0;
      continue;
    }

    const key = rgbaToKey(data[i], data[i + 1], data[i + 2], a);
    grid[p] = key;

    if (!seen.has(key)) {
      seen.set(key, true);
      colors.push(key);
    }
  }

  return { grid, colors, width, height };
}

function buildSvgFromImageData(imageData) {
  const { grid, colors, width, height } = collectColorsAndGrid(imageData);
  const parts = [];

  for (const color of colors) {
    const d = pathFinding(grid, width, height, color);
    if (!d) continue;

    const { fill, opacity } = keyToCssRgba(color);
    parts.push(`<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${parts.join('')}</svg>`;
}

async function decodeFile(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not available');
  }

  const bitmap = await createImageBitmap(file);
  if (typeof OffscreenCanvas !== 'function') {
    if (bitmap.close) bitmap.close();
    throw new Error('OffscreenCanvas is not available');
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();

  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

async function convertToWebP(file) {
  const { canvas } = await decodeFile(file);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 1 });
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return { blob, filename: `${base}.webp` };
}

async function convertToSvg(file) {
  const { ctx, width, height } = await decodeFile(file);
  const imageData = ctx.getImageData(0, 0, width, height);
  const svg = buildSvgFromImageData(imageData);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return { blob, filename: `${base}.svg` };
}

self.onmessage = async (event) => {
  const { id, file, mode } = event.data || {};

  try {
    let result;
    if (mode === 'webp') {
      result = await convertToWebP(file);
    } else {
      result = await convertToSvg(file);
    }

    self.postMessage({ id, ok: true, blob: result.blob, filename: result.filename });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
};
