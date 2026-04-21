const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyDgo-V24srcF2nAVzrPKb6iqYp-mTCwzAfN6fWizx1gyA3jxluVG_bQg7ucBRnoeLe/exec';
const FEEDBACK_SECRET = atob('YWZzODk3cjVoIV9hOXM4Zmg5MzVoXyY/Zzk4MzVoOW5mOThuM2g0XyEy');
const FEEDBACK_COOLDOWN_MS = 60 * 60 * 1000;
const FEEDBACK_COOLDOWN_KEY = 'glorp_feedback_last_submit_at';
const ACCEPTED_IMAGE_RE = /\.(png|gif|webp|jpe?g)$/i;
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/gif', 'image/webp', 'image/jpeg', 'image/jpg']);
const MAX_COLOR_SAMPLE_PIXELS = 80000;
const MAX_UNIQUE_COLOR_THRESHOLD = 4096;
const AI_BLOCKING_TYPES = new Set(['ai', 'colors']);
const AI_METADATA_SIGNATURES = [
  /(?:^|[^a-z0-9])ai[-_\s]*generated(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])generated[-_\s]*with[-_\s]*ai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])generated[-_\s]*by[-_\s]*ai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])created[-_\s]*with[-_\s]*ai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])created[-_\s]*by[-_\s]*ai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])made[-_\s]*with[-_\s]*ai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])artificial[-_\s]*intelligence(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])openai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])chatgpt(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])gpt[-_\s]*[0-9]+(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])gemini(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])google[-_\s]*gemini(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bard(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])claude(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])anthropic(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])midjourney(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])stable[-_\s]*diffusion(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])sdxl(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flux(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])dall[-_\s]*e(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])dalle(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])ideogram(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])leonardo(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])runway(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])firefly(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])copilot(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])canva(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])krea(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])novelai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])pixai(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])niji(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])prompt(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])negative[-_\s]*prompt(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])controlnet(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])lora(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])checkpoint(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])sampler(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])seed(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])steps(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])cfg[-_\s]*scale(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])txt2img(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])img2img(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])generative[-_\s]*fill(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])magic[-_\s]*media(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])image[-_\s]*generation(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])image[-_\s]*creator(?:[^a-z0-9]|$)/i,
];

const state = {
  selectedFiles: [],
  appInView: true,
  headerLock: false,
  worker: null,
  workerReqId: 0,
  workerRequests: new Map(),
  feedbackLoaded: false,
  feedbackScriptPromise: null,
  feedbackReadyPromise: null,
  fileValidationCache: new WeakMap(),
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeInspectionText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0000/g, ' ')
    .replace(/[\r\n\t]+/g, ' ');
}

function isAllowedImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  return ACCEPTED_IMAGE_RE.test(file.name) || ACCEPTED_IMAGE_TYPES.has(type);
}

function findAiMetadataSignature(text) {
  const haystack = normalizeInspectionText(text);
  for (const signature of AI_METADATA_SIGNATURES) {
    if (signature.test(haystack)) return signature.source || 'ai metadata';
  }
  return '';
}

async function readFileHeaderText(file, maxBytes = 512 * 1024) {
  const slice = file.slice(0, Math.min(file.size, maxBytes));
  const buffer = await slice.arrayBuffer();
  const latin1 = new TextDecoder('latin1').decode(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return `${latin1}
${utf8}`;
}

async function inspectFileForAiSignals(file) {
  const headerText = await readFileHeaderText(file);
  const match = findAiMetadataSignature(`${file.name}
${headerText}`);
  return match ? { blocked: true, reason: 'AI metadata / tags detected', blockType: 'ai' } : { blocked: false, reason: '', blockType: '' };
}

function estimateUniqueColors(imageData) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  if (!totalPixels) return { uniqueCount: 0, blocked: false };

  const samplePixels = Math.min(totalPixels, MAX_COLOR_SAMPLE_PIXELS);
  const step = Math.max(1, Math.floor(totalPixels / samplePixels));
  const unique = new Set();

  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const idx = pixel * 4;
    const a = data[idx + 3];
    if (a === 0) continue;
    const key = (((data[idx] << 24) | (data[idx + 1] << 16) | (data[idx + 2] << 8) | a) >>> 0);
    unique.add(key);
    if (unique.size > MAX_UNIQUE_COLOR_THRESHOLD) {
      return { uniqueCount: unique.size, blocked: true, blockType: 'colors' };
    }
  }

  return { uniqueCount: unique.size, blocked: unique.size > MAX_UNIQUE_COLOR_THRESHOLD, blockType: unique.size > MAX_UNIQUE_COLOR_THRESHOLD ? 'colors' : '' };
}

async function inspectFileForBlockingReasons(file) {
  if (!file) return { blocked: true, reason: 'Invalid file' };
if (!isAllowedImageFile(file)) {
  return { blocked: true, reason: 'Only PNG, GIF, WEBP, JPG, and JPEG are allowed', blockType: 'format' };
}

  const metadataInspection = await inspectFileForAiSignals(file);
  if (metadataInspection.blocked) return metadataInspection;

  try {
    const { canvas, ctx, width, height } = await decodeFileToCanvas(file);
    const imageData = ctx.getImageData(0, 0, width, height);
    const colorInspection = estimateUniqueColors(imageData);
    if (colorInspection.blocked) {
      return {
        blocked: true,
        reason: `too many colors (${colorInspection.uniqueCount.toLocaleString()} sampled)`
      };
    }
    return { blocked: false, reason: '' };
  } catch (error) {
    console.error('File inspection failed:', error);
    return { blocked: true, reason: 'Unreadable image', blockType: 'format' };
  }
}

function showToast(message, type = 'success', ms = 2200) {
  const toast = $('#toast');
  if (!toast) return;
  toast.className = '';
  toast.classList.add(type === 'error' ? 'error' : 'success');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => {
    toast.classList.remove('show', 'success', 'error');
  }, ms);
}

function openRulesOverlay() {
  const overlay = $('#rules-overlay');
  if (!overlay) return;
  overlay.classList.remove('dismissed');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('rules-active');
}

function closeRulesOverlay() {
  const overlay = $('#rules-overlay');
  if (!overlay) return;
  overlay.classList.add('dismissed');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('rules-active');
}

function showAiBlockOverlay(reason = '') {
  const overlay = $('#ai-block-overlay');
  if (!overlay) return;
  overlay.classList.remove('dismissed');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ai-active');
  const subtitle = $('#ai-block-subtitle');
  if (subtitle) subtitle.textContent = 'read the rules in -> ?';
}

function hideAiBlockOverlay() {
  const overlay = $('#ai-block-overlay');
  if (!overlay) return;
  overlay.classList.add('dismissed');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ai-active');
}

function setLoadingDone() {
  const screen = $('#loading-screen');
  if (!screen) return;
  screen.classList.add('loaded');
}

function syncHeaderState() {
  if (state.headerLock) return;
  const header = $('#main-header');
  if (!header) return;
  const hasFiles = state.selectedFiles.length > 0;
  header.classList.toggle('files-hidden', hasFiles);
  header.classList.toggle('compact', !hasFiles && !state.appInView);
}

function updateUI() {
  const hasFiles = state.selectedFiles.length > 0;
  syncHeaderState();

  const drawer = $('#file-drawer');
  const selectBlock = $('#select-block');
  const convertBlock = $('#convert-block');

  if (drawer) drawer.classList.toggle('open', hasFiles);
  if (selectBlock) selectBlock.style.display = hasFiles ? 'none' : 'block';
  if (convertBlock) convertBlock.classList.toggle('active', hasFiles);

  document.body.style.overflow = hasFiles ? 'hidden' : 'auto';
  document.documentElement.style.overflow = hasFiles ? 'hidden' : 'auto';

  const list = $('#file-list');
  if (list) {
    list.innerHTML = state.selectedFiles.map((file, index) => {
      const displayName = file.name.length > 28 ? `${file.name.substring(0, 25)}...` : file.name;
      return `<li><span title="${escapeHtml(file.name)}">${escapeHtml(displayName)}</span><span class="remove-file" data-index="${index}">×</span></li>`;
    }).join('');

    list.querySelectorAll('.remove-file').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = Number(btn.getAttribute('data-index'));
        removeFile(index);
      });
    });
  }
}

async function handleFiles(list) {
  const incoming = Array.from(list || []).filter((file) => {
    if (!file) return false;
    if (file.size === 0) return false;
    return isAllowedImageFile(file);
  });

  if (incoming.length === 0) {
    if (list && list.length > 0) showToast('No valid images found', 'error');
    return;
  }

  const accepted = [];
  const blocked = [];

  for (const file of incoming) {
    if (state.selectedFiles.some((existing) => existing.name === file.name && existing.size === file.size)) {
      continue;
    }

    let verdict = state.fileValidationCache.get(file);
    if (!verdict) {
      verdict = await inspectFileForBlockingReasons(file);
      state.fileValidationCache.set(file, verdict);
    }

    if (verdict.blocked) {
      blocked.push({ file, reason: verdict.reason || 'blocked', blockType: verdict.blockType || '' });
      if (AI_BLOCKING_TYPES.has(verdict.blockType)) {
        showAiBlockOverlay(verdict.blockType);
      }
      continue;
    }

    accepted.push(file);
  }

  if (accepted.length > 0) {
    state.selectedFiles.push(...accepted);
  }

  updateUI();

  if (blocked.length > 0) {
    const summary = blocked.slice(0, 2).map(({ file, reason }) => `${file.name}: ${reason}`).join(' | ');
    showToast(blocked.length === 1 ? `Blocked: ${summary}` : `Blocked ${blocked.length} file(s): ${summary}`, 'error', 4200);
  }

  if (accepted.length > 0) {
    showToast(`${accepted.length} file(s) added`, 'success', 1400);
  }
}

function removeFile(index) {
  state.selectedFiles.splice(index, 1);
  updateUI();
  showToast('File removed', 'success', 900);
}

function clearAll() {
  state.selectedFiles = [];
  updateUI();
  showToast('Queue cleared', 'success', 900);
}

window.removeFile = removeFile;
window.clearAll = clearAll;

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromSource(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = src;
  });
}

async function decodeFileToCanvas(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none'
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    
    if (bitmap.close) bitmap.close();
    return { canvas, ctx, width: canvas.width, height: canvas.height };
  }

  const dataUrl = await fileToDataURL(file);
  const img = await loadImageFromSource(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

function rgbaToHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function buildLegoSvgFromImageData(imageData) {
  const { data, width, height } = imageData;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${rgbaToHex(data[i], data[i + 1], data[i + 2])}" fill-opacity="${(a / 255).toFixed(3)}"/>`;
  }

  svg += '</svg>';
  return svg;
}

const CLOCKWISE = 1;
const ANTICLOCKWISE = 2;

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
  const uniqueColors = new Set();
  
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const key = (((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | a) >>> 0);
    uniqueColors.add(key);
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`;
  const grid = new Uint8Array(W * H);

  for (const key of uniqueColors) {
    grid.fill(0);
    let hasPixels = false;
    
    for (let i = 0; i < W * H; i++) {
      const idx = i * 4;
      const pKey = (((data[idx] << 24) | (data[idx + 1] << 16) | (data[idx + 2] << 8) | data[idx + 3]) >>> 0);
      if (pKey === key) {
        grid[i] = 1;
        hasPixels = true;
      }
    }

    if (hasPixels) {
      const pathData = pathFinding(grid, W, H);
      if (pathData) {
        const r = (key >>> 24) & 255;
        const g = (key >>> 16) & 255;
        const b = (key >>> 8) & 255;
        const a = key & 255;
        svg += `<path d="${pathData}" fill="${rgbaToHex(r, g, b)}" fill-opacity="${(a / 255).toFixed(3)}" fill-rule="evenodd"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
    }
    try {
      link.remove();
    } catch (error) {
    }
  }, 1500);
}

function getBaseName(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function getConversionWorker() {
  if (state.worker) return state.worker;

  const worker = new Worker('./js/conversion-worker.js');
  worker.onmessage = (event) => {
    const { id, ok, blob, filename, error } = event.data || {};
    const pending = state.workerRequests.get(id);
    if (!pending) return;
    state.workerRequests.delete(id);

    if (ok) {
      pending.resolve({ blob, filename });
    } else {
      pending.reject(new Error(error || 'Worker conversion failed'));
    }
  };

  worker.onerror = (error) => {
    const err = (error && error.error) || new Error((error && error.message) || 'Worker error');
    for (const [, pending] of state.workerRequests) pending.reject(err);
    state.workerRequests.clear();
    try {
      worker.terminate();
    } catch (terminateError) {
    }
    state.worker = null;
  };

  state.worker = worker;
  return worker;
}

function convertFileInWorker(file, mode) {
  const worker = getConversionWorker();
  const id = ++state.workerReqId;
  return new Promise((resolve, reject) => {
    state.workerRequests.set(id, { resolve, reject });
    worker.postMessage({ id, file, mode });
  });
}

async function convertFileInMainThread(file, mode) {
  const { canvas, ctx, width, height } = await decodeFileToCanvas(file);
  const imageData = ctx.getImageData(0, 0, width, height);
  const baseName = getBaseName(file.name);

  if (mode === 'webp') {
    const blob = await new Promise((resolve, reject) => {
      if (canvas.convertToBlob) {
        canvas.convertToBlob({ type: 'image/webp', quality: 1 })
          .then(resolve)
          .catch(reject);
      } else {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('WebP export failed'));
        }, 'image/webp', 1.0);
      }
    });
    return { blob, filename: `${baseName}.webp` };
  }

  const svg = mode === 'lego'
    ? buildLegoSvgFromImageData(imageData)
    : buildMonolithSvgFromImageData(imageData);

  return {
    blob: new Blob([svg], { type: 'image/svg+xml' }),
    filename: `${baseName}.svg`,
  };
}

async function convertSingleFile(file, mode) {
  try {
    const result = await convertFileInWorker(file, mode);
    await downloadBlob(result.blob, result.filename);
  } catch (error) {
    console.error('Worker conversion failed, falling back to main thread:', error);

    if (mode === 'monolith') {
      showToast('Engine error — falling back to monolith fallback', 'error', 3000);
      const fallback = await convertFileInMainThread(file, 'monolith');
      await downloadBlob(fallback.blob, fallback.filename);
      return;
    }

    if (mode === 'lego') {
      const fallback = await convertFileInMainThread(file, 'lego');
      await downloadBlob(fallback.blob, fallback.filename);
      return;
    }

    if (mode === 'webp') {
      const fallback = await convertFileInMainThread(file, 'webp');
      await downloadBlob(fallback.blob, fallback.filename);
      return;
    }

    throw error;
  }
}

async function convertSelectedFiles() {
  const activeTab = $('.mode-tab.active');
  const mode = activeTab ? activeTab.dataset.mode : 'monolith';
  const status = $('#status-msg');

  if (state.selectedFiles.length === 0) {
    if (status) status.innerText = 'NO FILES SELECTED';
    showToast('No files selected', 'error');
    return;
  }

  if (status) status.innerText = `CONVERTING ${state.selectedFiles.length} ASSETS...`;
  showToast(`Converting ${state.selectedFiles.length} file(s)...`, 'success', 1400);

  for (const file of state.selectedFiles.slice()) {
    try {
      let verdict = state.fileValidationCache.get(file);
      if (!verdict) {
        verdict = await inspectFileForBlockingReasons(file);
        state.fileValidationCache.set(file, verdict);
      }

      if (verdict.blocked) {
        state.selectedFiles = state.selectedFiles.filter((item) => item !== file);
        updateUI();
        if (AI_BLOCKING_TYPES.has(verdict.blockType)) {
          showAiBlockOverlay(verdict.blockType);
        }
        showToast(`Removed: ${file.name} — ${verdict.reason}`, 'error', 3200);
        continue;
      }

      if (status) status.innerText = `CONVERTING: ${file.name}`;
      await convertSingleFile(file, mode);
      if (status) status.innerText = `CONVERTED: ${file.name}`;
      showToast(`Converted: ${file.name}`, 'success', 1200);
    } catch (error) {
      console.error('Conversion failed for', file.name, error);
      showToast(`Conversion failed: ${file.name}`, 'error', 2500);
    }
  }

  if (status) status.innerText = 'CONVERSION COMPLETE';
  showToast('Conversion complete', 'success', 1800);
  setTimeout(() => {
    if (status && status.innerText === 'CONVERSION COMPLETE') status.innerText = '';
  }, 4000);
  state.selectedFiles = [];
  updateUI();
}

function initLogoHover() {
  const logoBig = $('#logo-big');
  if (!logoBig) return;
  const hoverIn = () => logoBig.classList.add('logo-hovered');
  const hoverOut = () => logoBig.classList.remove('logo-hovered');
  logoBig.addEventListener('mouseenter', hoverIn);
  logoBig.addEventListener('mouseleave', hoverOut);
  logoBig.addEventListener('focus', hoverIn);
  logoBig.addEventListener('blur', hoverOut);
}

function initDragAndDrop() {
  const overlay = $('#drop-overlay');
  if (!overlay) return;

  window.addEventListener('dragover', (event) => {
    event.preventDefault();
    overlay.classList.add('visible');
  });

  window.addEventListener('dragleave', (event) => {
    if (
      event.clientX <= 0 ||
      event.clientY <= 0 ||
      event.clientX >= window.innerWidth ||
      event.clientY >= window.innerHeight
    ) {
      overlay.classList.remove('visible');
    }
  });

  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    overlay.classList.remove('visible');

    const items = event.dataTransfer && event.dataTransfer.items;
    let files = [];
    let foldersDetected = 0;

    if (items && items.length) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry && entry.isDirectory) {
          foldersDetected += 1;
          continue;
        }
        const file = item.getAsFile();
        if (file && file.size !== 0 && isAllowedImageFile(file)) {
          files.push(file);
        }
      }
    } else {
      files = Array.from(event.dataTransfer.files).filter((file) => {
        if (!file) return false;
        if (file.size === 0 && !ACCEPTED_IMAGE_RE.test(file.name)) {
          foldersDetected += 1;
          return false;
        }
        return isAllowedImageFile(file);
      });
    }

    if (foldersDetected > 0) {
      showToast('Folder upload available only in the desktop app.', 'error', 5000);
    }

    if (!files.length) return;

    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      let fallbackTimer = null;
      const checkTimer = setInterval(() => {
        if (window.scrollY <= 0) {
          clearInterval(checkTimer);
          if (fallbackTimer) clearTimeout(fallbackTimer);
          handleFiles(files);
        }
      }, 50);
      fallbackTimer = setTimeout(() => {
        clearInterval(checkTimer);
        handleFiles(files);
      }, 800);
    } else {
      handleFiles(files);
    }
  });
}

function scrollToSection(target, offset = 0) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const top = (window.pageYOffset || window.scrollY || 0) + rect.top + offset;
  window.scrollTo({ behavior: 'smooth', top: Math.max(0, top) });
}

function ensureFeedbackModuleLoaded() {
  if (window.GlorpFeedback && typeof window.GlorpFeedback.mount === 'function') {
    return Promise.resolve(window.GlorpFeedback);
  }

  if (state.feedbackReadyPromise) return state.feedbackReadyPromise;

  if (!state.feedbackScriptPromise) {
    state.feedbackScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-feedback-module="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load feedback module')));
        return;
      }

      const script = document.createElement('script');
      script.src = './js/feedback.js';
      script.defer = true;
      script.async = true;
      script.dataset.feedbackModule = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load feedback module'));
      document.head.appendChild(script);
    });
  }

  state.feedbackReadyPromise = state.feedbackScriptPromise.then(() => {
    if (!window.GlorpFeedback || typeof window.GlorpFeedback.mount !== 'function') {
      throw new Error('Feedback module did not register correctly');
    }
    return window.GlorpFeedback;
  });

  return state.feedbackReadyPromise;
}

window.loadFeedbackModule = ensureFeedbackModuleLoaded;

function mountFeedbackIfNeeded() {
  const root = $('#feedback-root');
  if (!root) return;
  if (state.feedbackLoaded) return;
  state.feedbackLoaded = true;

  ensureFeedbackModuleLoaded()
    .then((api) => {
      if (api && typeof api.mount === 'function') {
        api.mount(root, {
          endpoint: ENDPOINT,
          secret: FEEDBACK_SECRET,
          cooldownMs: FEEDBACK_COOLDOWN_MS,
          cooldownKey: FEEDBACK_COOLDOWN_KEY,
        });
      }
    })
    .catch((error) => {
      console.error('Feedback module failed to load:', error);
      state.feedbackLoaded = false;
      const target = $('#feedback-root');
      if (target) {
        target.innerHTML = '<div style="padding:40px 20px;color:#888;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Feedback is unavailable right now.</div>';
      }
    });
}

function initNavigation() {
  const mainHeader = $('#main-header');
  const appSection = $('#app');
  const feedbackSection = $('#feedback');

  if (appSection) {
    const appObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        state.appInView = entry.intersectionRatio >= 0.6;
        syncHeaderState();
      });
    }, { threshold: [0, 0.25, 0.6, 0.95] });
    appObserver.observe(appSection);
  }

  if (feedbackSection) {
    const preloadObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          mountFeedbackIfNeeded();
          preloadObserver.disconnect();
        }
      });
    }, { threshold: 0.15 });
    preloadObserver.observe(feedbackSection);

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => mountFeedbackIfNeeded(), { timeout: 2500 });
    } else {
      setTimeout(() => mountFeedbackIfNeeded(), 1200);
    }
  }

  $$('nav a').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      const target = document.querySelector(href);
      if (!target) return;

      if (href === '#app') {
        state.headerLock = true;
        mainHeader && mainHeader.classList.remove('compact');
        setTimeout(() => {
          state.headerLock = false;
        }, 1200);
        scrollToSection(target, -120);
        return;
      }

      if (href === '#compare') {
        mainHeader && mainHeader.classList.add('compact');
        scrollToSection(target, -120);
        return;
      }

      if (href === '#feedback') {
        mainHeader && mainHeader.classList.add('compact');
        mountFeedbackIfNeeded();
        scrollToSection(target, -120);
        return;
      }

      mainHeader && mainHeader.classList.add('compact');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initRevealObservers() {
  const sections = $$('section');
  const paras = $$('.reveal-para');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.intersectionRatio > 0.10) {
        entry.target.classList.add('revealed');
      } else {
        entry.target.classList.remove('revealed');
      }
    });
  }, { threshold: [0, 0.10, 0.4] });
  sections.forEach((section) => sectionObserver.observe(section));

  const paraObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.intersectionRatio > 0.12) {
        el.classList.add('visible');
      } else {
        el.classList.remove('visible');
      }
    });
  }, { threshold: [0, 0.12, 0.5] });
  paras.forEach((para) => paraObserver.observe(para));
}

function initBloom() {
  const bloom = $('#bloom');
  if (!bloom) return;

  function updateBloom() {
    const max = 420;
    const y = window.scrollY || window.pageYOffset;
    const progress = Math.min(Math.max(y / max, 0), 1);
    const scale = 0.95 + 0.5 * progress;
    const translateY = 20 - 20 * progress;
    const height = 80 + (180 - 80) * progress;
    const opacity = 0.85 - 0.5 * progress;
    bloom.style.transform = `translateX(-50%) translateY(${translateY}px) scaleX(${scale})`;
    bloom.style.height = `${height}px`;
    bloom.style.opacity = `${opacity}`;
  }

  window.addEventListener('scroll', updateBloom, { passive: true });
  updateBloom();
}

function initFaq() {
  let faqSwitchTimer = null;
  $$('.faq-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.parentElement;
      const wasOpen = card.classList.contains('open');
      const prev = $('.faq-card.open');
      if (faqSwitchTimer) {
        clearTimeout(faqSwitchTimer);
        faqSwitchTimer = null;
      }
      if (wasOpen) {
        card.classList.remove('open');
        return;
      }
      if (prev && prev !== card) {
        prev.classList.remove('open');
        faqSwitchTimer = setTimeout(() => {
          card.classList.add('open');
          faqSwitchTimer = null;
        }, 520);
      } else {
        card.classList.add('open');
      }
    });
  });
}

function initFileInput() {
  const input = $('#file-input');
  if (!input) return;
  input.addEventListener('change', (event) => { handleFiles(event.target.files); });
}

function initConvertButton() {
  const button = $('#btn-convert');
  if (!button) return;
  button.addEventListener('click', convertSelectedFiles);
}

function initModeTabs() {
  $$('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.mode-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function initLoadingScreen() {
  requestAnimationFrame(() => {
    setLoadingDone();
  });
}

function initRulesOverlay() {
  const dismiss = $('#rules-dismiss');
  const backdrop = $('#rules-backdrop');
  const openBtn = $('#rules-open-btn');
  if (dismiss) dismiss.addEventListener('click', closeRulesOverlay);
  if (backdrop) backdrop.addEventListener('click', closeRulesOverlay);
  if (openBtn) openBtn.addEventListener('click', openRulesOverlay);
}

function initAiOverlay() {
  const dismiss = $('#ai-block-dismiss');
  const backdrop = $('#ai-block-backdrop');
  if (dismiss) dismiss.addEventListener('click', hideAiBlockOverlay);
  if (backdrop) backdrop.addEventListener('click', hideAiBlockOverlay);
}

function initLogoAndAppButton() {
  initLogoHover();
  const selectButton = $('#btn-select');
  if (selectButton) {
    selectButton.addEventListener('click', () => {
      const input = $('#file-input');
      if (input) input.click();
    });
  }
}

function bootstrap() {
  initLoadingScreen();
  initRulesOverlay();
  initAiOverlay();
  initLogoAndAppButton();
  initDragAndDrop();
  initNavigation();
  initRevealObservers();
  initBloom();
  initFaq();
  initFileInput();
  initModeTabs();
  initConvertButton();
  updateUI();
}

bootstrap();
