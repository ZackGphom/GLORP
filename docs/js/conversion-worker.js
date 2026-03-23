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

function buildMonolithSvgFromImageData(imageData) {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const rects = [];

  const sameColor = (index, key) => {
    const i = index * 4;
    return rgbaToKey(data[i], data[i + 1], data[i + 2], data[i + 3]) === key;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const offset = idx * 4;
      const alpha = data[offset + 3];
      if (alpha === 0) {
        visited[idx] = 1;
        continue;
      }

      const key = rgbaToKey(data[offset], data[offset + 1], data[offset + 2], alpha);

      let rectWidth = 1;
      while (x + rectWidth < width) {
        const nextIndex = idx + rectWidth;
        if (visited[nextIndex] || !sameColor(nextIndex, key)) break;
        rectWidth += 1;
      }

      let rectHeight = 1;
      outer: while (y + rectHeight < height) {
        const rowIndex = (y + rectHeight) * width + x;
        for (let dx = 0; dx < rectWidth; dx++) {
          const probe = rowIndex + dx;
          if (visited[probe] || !sameColor(probe, key)) {
            break outer;
          }
        }
        rectHeight += 1;
      }

      for (let dy = 0; dy < rectHeight; dy++) {
        const rowBase = (y + dy) * width + x;
        for (let dx = 0; dx < rectWidth; dx++) {
          visited[rowBase + dx] = 1;
        }
      }

      rects.push({
        x,
        y,
        w: rectWidth,
        h: rectHeight,
        r: data[offset],
        g: data[offset + 1],
        b: data[offset + 2],
        a: alpha,
      });
    }
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`;
  for (const rect of rects) {
    svg += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${rgbaToHex(rect.r, rect.g, rect.b)}" fill-opacity="${(rect.a / 255).toFixed(3)}"/>`;
  }
  svg += '</svg>';
  return svg;
}

async function decodeFile(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not available in this worker');
  }

  const bitmap = await createImageBitmap(file);
  if (typeof OffscreenCanvas !== 'function') {
    if (bitmap.close) bitmap.close();
    throw new Error('OffscreenCanvas is not available in this worker');
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

    const svg = mode === 'lego'
      ? buildLegoSvgFromImageData(imageData)
      : buildMonolithSvgFromImageData(imageData);

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
