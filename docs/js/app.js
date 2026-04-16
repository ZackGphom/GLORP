const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyDgo-V24srcF2nAVzrPKb6iqYp-mTCwzAfN6fWizx1gyA3jxluVG_bQg7ucBRnoeLe/exec';
const FEEDBACK_SECRET = atob('YWZzODk3cjVoIV9hOXM4Zmg5MzVoXyY/Zzk4MzVoOW5mOThuM2g0XyEy');
const FEEDBACK_COOLDOWN_MS = 60 * 60 * 1000;
const FEEDBACK_COOLDOWN_KEY = 'glorp_feedback_last_submit_at';
const ACCEPTED_IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const SUPPORTED_LANGS = new Set(['en', 'ru']);

const STRINGS = {
  en: {
    seo: {
      title: 'Pixel Art to SVG Converter — GLORP',
      description: 'Convert pixel art to SVG locally in your browser with GLORP. Batch PNG to SVG, pixel to vector, and raster export in one dark minimal tool.',
      ogTitle: 'Pixel Art to SVG Converter — GLORP',
      ogDescription: 'Convert pixel art to SVG locally in your browser. Batch PNG to SVG, pixel to vector, and raster export.',
    },
    nav: { modes: 'Modes', what: 'What is GLORP?', faq: 'FAQ', feedback: 'Feedback', support: 'Support' },
    hero: {
      eyebrow: 'Pixel art to SVG converter',
      title: 'Pixel Art to SVG Converter',
      subtitle: 'Convert pixel art to SVG locally in your browser. Batch PNG to SVG, pixel to vector, and raster export without sending images to a server.',
      chips: ['Local browser processing', 'Batch upload', 'PNG to SVG'],
      select: 'Select files',
      convert: 'Convert',
      drag: 'Drag and drop anywhere on the page.',
      note: 'The first screen is the converter. The explanation stays in the tutorial and below.',
      statusEmpty: '',
      statusNoFiles: 'No files selected',
      statusConvertingCount: (n) => `Converting ${n} assets...`,
      statusConvertingFile: (name) => `Converting: ${name}`,
      statusConvertedFile: (name) => `Converted: ${name}`,
      statusComplete: 'Conversion complete',
    },
    tutorial: {
      title: 'GLORP: THE RULES',
      button: 'Got it',
      langNote: 'English is the default interface language. Russian opens automatically when the system language is Russian.',
      lines: [
        '<strong>1:1 Pixel Ratio.</strong> Upload the file exactly as you saved it from your editor (Aseprite, Photoshop, etc.). Do not resize it.',
        '<strong>PNG Only.</strong> JPEG compression creates invisible color noise. Noise = broken SVG.',
        '<strong>No Post-FX.</strong> No blurs, soft shadows, or gradients. Only solid colors.',
        '<strong>The golden rule:</strong> if the image looks blurry or too big for its resolution, GLORP will see it as trash data and crash. Keep it original.',
      ],
    },
    modes: {
      eyebrow: 'Pick the output you need',
      title: 'Modes',
      cards: [
        { tag: 'Clean SVG', title: 'Monolith', text: 'Best for cleaner vectors. It merges matching color areas into compact paths, so the SVG stays lighter and easier to use.' },
        { tag: 'Exact pixels', title: 'Lego', text: 'Best for a true 1:1 look. Every pixel becomes its own square, which keeps the artwork faithful to the original grid.' },
        { tag: 'Raster export', title: 'WebP', text: 'Best when you need a bitmap file instead of SVG. It keeps the browser-side workflow and exports a raster version.' },
      ],
    },
    what: {
      eyebrow: 'Simple, local, fast',
      title: 'What is GLORP?',
      paragraphs: [
        'GLORP is an online tool for converting pixel art to SVG. It is made for people who need clean vectors from pixel-based artwork without leaving the browser.',
        'Processing happens locally in your browser. Your images are not sent to a server, which keeps the workflow fast and private.',
        'It is useful for artists, game asset creators, NFT and collectible makers, poster and print work, and developers who want a quick pixel to vector pipeline.',
      ],
      seo: 'GLORP works as a pixel art to SVG converter, a PNG to SVG converter, and a pixel to vector tool for batch workflows, local browser processing, and lightweight export.',
    },
    technical: {
      eyebrow: 'Small technical notes',
      title: 'Extra details',
      cards: [
        { title: 'Local by design', text: 'Images are decoded and converted in the browser. There is no upload step and no backend conversion queue.' },
        { title: 'Batch upload stays', text: 'You can drop many files at once. The queue still runs file by file so the export flow stays predictable.' },
        { title: 'Smart warnings', text: 'Large scenes trigger a warning before conversion, so you can stop before the browser gets overloaded.' },
        { title: 'Output modes', text: 'Monolith makes denser SVG paths, Lego keeps the pixel grid exact, and WebP exports a raster version when SVG is not needed.' },
      ],
    },
    faq: {
      eyebrow: 'Answers before you ask',
      title: 'FAQ',
      items: [
        { q: 'Can I upload multiple files at once?', a: 'Yes. The queue supports batch upload, and every file is processed one by one.' },
        { q: 'What file type works best?', a: 'PNG is the safest choice. It keeps hard edges and transparency clean, which matters for pixel art.' },
        { q: 'Does GLORP send files to a server?', a: 'No. The conversion happens locally in your browser.' },
        { q: 'Why do big images warn me?', a: 'Large pixel art scenes can freeze the UI or create very heavy vectors, so GLORP warns you before processing.' },
      ],
    },
    contact: { eyebrow: 'Elsewhere', title: 'Links' },
    feedback: { eyebrow: 'Tell us what breaks', title: 'Feedback', unavailable: 'Feedback is unavailable right now.' },
    warnings: {
      noValid: 'No valid images found',
      folderDesktop: 'Folder upload is available only in the desktop app.',
      large: 'Large image detected. Processing may be slower.',
      massiveTitle: 'MASSIVE SCENE DETECTED',
      massiveBody: 'Processing may freeze your browser. Continue anyway?',
      cancel: 'Cancel',
      continue: 'Continue anyway',
      removed: 'File removed',
      cleared: 'Queue cleared',
      addedOne: (count) => `${count} file(s) added`,
      badFile: 'This file could not be decoded.',
      convertNone: 'No files selected',
      converted: 'Conversion complete',
      failed: (name) => `Conversion failed: ${name}`,
      converting: (count) => `Converting ${count} assets...`,
      convertingFile: (name) => `Converting: ${name}`,
      convertedFile: (name) => `Converted: ${name}`,
      workerError: 'Engine error — falling back to main thread',
    },
    lang: 'EN',
  },
  ru: {
    seo: {
      title: 'Конвертер pixel art to SVG — GLORP',
      description: 'GLORP конвертирует pixel art в SVG локально в браузере. Batch PNG to SVG, pixel to vector и raster export в одном тёмном минималистичном инструменте.',
      ogTitle: 'Конвертер pixel art to SVG — GLORP',
      ogDescription: 'GLORP конвертирует pixel art в SVG локально в браузере. Batch PNG to SVG, pixel to vector и raster export.',
    },
    nav: { modes: 'Режимы', what: 'Что такое GLORP?', faq: 'FAQ', feedback: 'Отзывы', support: 'Поддержать' },
    hero: {
      eyebrow: 'Конвертер pixel art to SVG',
      title: 'Конвертер Pixel Art to SVG',
      subtitle: 'GLORP конвертирует pixel art в SVG локально в браузере. Batch PNG to SVG, pixel to vector и raster export без отправки изображений на сервер.',
      chips: ['Локальная обработка', 'Batch upload', 'PNG to SVG'],
      select: 'Выбрать файлы',
      convert: 'Конвертировать',
      drag: 'Перетащи файлы в любое место страницы.',
      note: 'Первый экран — это конвертер. Объяснение остаётся в tutorial и ниже.',
      statusEmpty: '',
      statusNoFiles: 'Файлы не выбраны',
      statusConvertingCount: (n) => `Конвертация: ${n} файлов...`,
      statusConvertingFile: (name) => `Конвертирую: ${name}`,
      statusConvertedFile: (name) => `Готово: ${name}`,
      statusComplete: 'Конвертация завершена',
    },
    tutorial: {
      title: 'GLORP: ПРАВИЛА',
      button: 'Понял',
      langNote: 'Английский — язык по умолчанию. Русский включается автоматически, если язык системы русский.',
      lines: [
        '<strong>Пиксельный размер 1:1.</strong> Загружай файл ровно в том виде, как он сохранён из редактора (Aseprite, Photoshop и т. д.). Не меняй размер.',
        '<strong>Только PNG.</strong> JPEG добавляет невидимый шум цвета. Шум = сломанный SVG.',
        '<strong>Без пост-эффектов.</strong> Никаких blur, мягких теней и градиентов. Только плотные цвета.',
        '<strong>Золотое правило:</strong> если картинка выглядит размыто или слишком большой для своего размера, GLORP воспримет это как мусорные данные и сломается. Оставляй оригинал.',
      ],
    },
    modes: {
      eyebrow: 'Выбери нужный выход',
      title: 'Режимы',
      cards: [
        { tag: 'Чистый SVG', title: 'Monolith', text: 'Лучше для более чистого вектора. Он объединяет одинаковые цветовые области в компактные контуры, поэтому SVG получается легче.' },
        { tag: 'Точные пиксели', title: 'Lego', text: 'Лучше для честного 1:1 вида. Каждый пиксель превращается в отдельный квадрат и сохраняет оригинальную сетку.' },
        { tag: 'Растровый экспорт', title: 'WebP', text: 'Лучше, когда нужен не SVG, а bitmap-файл. Поток остаётся локальным, а результат сохраняется как raster.' },
      ],
    },
    what: {
      eyebrow: 'Просто, локально, быстро',
      title: 'Что такое GLORP?',
      paragraphs: [
        'GLORP — это online tool for converting pixel art to SVG. Он нужен тем, кто хочет получить чистый вектор из пиксельной графики, не выходя из браузера.',
        'Обработка происходит локально в браузере. Изображения не отправляются на сервер, поэтому workflow остаётся быстрым и приватным.',
        'Полезно для artists, game asset creators, NFT и collectible makers, poster / print work и developers, которым нужен быстрый pixel to vector пайплайн.',
      ],
      seo: 'GLORP работает как pixel art to SVG converter, png to svg converter и pixel to vector инструмент для batch-задач, локальной browser processing и лёгкого экспорта.',
    },
    technical: {
      eyebrow: 'Коротко по технике',
      title: 'Дополнительно',
      cards: [
        { title: 'Локально по умолчанию', text: 'Изображения декодируются и конвертируются прямо в браузере. Без загрузки на сервер и без бэкенд-очереди.' },
        { title: 'Batch upload остаётся', text: 'Можно добавить сразу много файлов. Очередь обрабатывает их по одному, чтобы экспорт был предсказуемым.' },
        { title: 'Умные предупреждения', text: 'Большие сцены получают предупреждение до старта конвертации, чтобы не повесить интерфейс.' },
        { title: 'Режимы вывода', text: 'Monolith даёт более плотный SVG, Lego оставляет пиксельную сетку точной, а WebP сохраняет растровый вариант.' },
      ],
    },
    faq: {
      eyebrow: 'Ответы до вопросов',
      title: 'FAQ',
      items: [
        { q: 'Можно загрузить сразу несколько файлов?', a: 'Да. Очередь поддерживает batch upload, и каждый файл идёт по одному.' },
        { q: 'Какой формат лучше?', a: 'PNG — самый безопасный вариант. Он лучше всего держит жёсткие края и прозрачность.' },
        { q: 'GLORP отправляет файлы на сервер?', a: 'Нет. Конвертация идёт локально в браузере.' },
        { q: 'Почему большие изображения предупреждаются?', a: 'Большие pixel art сцены могут подвесить интерфейс или создать тяжёлый SVG, поэтому GLORP предупреждает заранее.' },
      ],
    },
    contact: { eyebrow: 'Внешние ссылки', title: 'Ссылки' },
    feedback: { eyebrow: 'Скажи, что ломается', title: 'Отзывы', unavailable: 'Сейчас модуль отзывов недоступен.' },
    warnings: {
      noValid: 'Подходящих изображений не найдено',
      folderDesktop: 'Загрузка папок доступна только в desktop-версии.',
      large: 'Обнаружено большое изображение. Обработка может идти медленнее.',
      massiveTitle: 'ОБНАРУЖЕНА ОГРОМНАЯ СЦЕНА',
      massiveBody: 'Обработка может подвесить браузер. Продолжить всё равно?',
      cancel: 'Отмена',
      continue: 'Всё равно продолжить',
      removed: 'Файл удалён',
      cleared: 'Очередь очищена',
      addedOne: (count) => `Добавлено файлов: ${count}`,
      badFile: 'Не удалось декодировать этот файл.',
      convertNone: 'Файлы не выбраны',
      converted: 'Конвертация завершена',
      failed: (name) => `Ошибка конвертации: ${name}`,
      converting: (count) => `Конвертация: ${count} файлов...`,
      convertingFile: (name) => `Конвертирую: ${name}`,
      convertedFile: (name) => `Готово: ${name}`,
      workerError: 'Ошибка движка — перехожу на main thread',
    },
    lang: 'RU',
  },
};

const state = {
  selectedFiles: [],
  appInView: true,
  headerLock: false,
  tutorialAccepted: false,
  worker: null,
  workerReqId: 0,
  workerRequests: new Map(),
  feedbackLoaded: false,
  feedbackScriptPromise: null,
  feedbackReadyPromise: null,
  language: 'en',
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

function formatText(template, vars = {}) {
  if (typeof template === 'function') return template(vars.count ?? vars.name ?? vars.value ?? vars);
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''));
}

function t(path, vars) {
  const keys = path.split('.');
  let value = STRINGS[state.language] || STRINGS.en;
  for (const key of keys) value = value && value[key];
  if (value === undefined) {
    value = STRINGS.en;
    for (const key of keys) value = value && value[key];
  }
  return formatText(value, vars);
}

function detectLanguage() {
  let stored = null;
  try { stored = localStorage.getItem('glorp_language'); } catch (error) {}
  if (stored && SUPPORTED_LANGS.has(stored)) return stored;
  const navLangs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const lang of navLangs) if (/^ru/i.test(lang)) return 'ru';
  return 'en';
}

function persistLanguage(lang) {
  try { localStorage.setItem('glorp_language', lang); } catch (error) {}
}

function updateSeo(lang) {
  const seo = STRINGS[lang].seo;
  document.title = seo.title;
  const setMeta = (selector, attr = 'content', value) => {
    const el = $(selector);
    if (el) el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', 'content', seo.description);
  setMeta('meta[property="og:title"]', 'content', seo.ogTitle);
  setMeta('meta[property="og:description"]', 'content', seo.ogDescription);
  setMeta('meta[name="twitter:title"]', 'content', seo.ogTitle);
  setMeta('meta[name="twitter:description"]', 'content', seo.ogDescription);
  document.documentElement.lang = lang;
}

function buildShell() {
  document.body.innerHTML = `
    <div id="tutorial-modal" class="rules-modal" aria-modal="true" role="dialog">
      <div class="rules-card">
        <div id="rules-title" class="rules-title"></div>
        <div id="rules-list" class="rules-list"></div>
        <div class="rules-actions">
          <button id="rules-close" class="rules-btn primary" type="button"></button>
        </div>
        <div id="rules-lang-note" class="lang-note"></div>
      </div>
    </div>

    <header id="main-header">
      <a class="brand" href="#app" aria-label="GLORP"><span class="brand-mark">GLORP</span></a>
      <nav>
        <a href="#modes" data-nav="modes"></a>
        <a href="#what" data-nav="what"></a>
        <a href="#faq" data-nav="faq"></a>
        <a href="#feedback" data-nav="feedback"></a>
      </nav>
      <div class="header-actions">
        <button id="lang-switch" class="btn btn-ghost btn-small lang-toggle" type="button"></button>
        <a class="btn btn-small support-link" href="https://www.donationalerts.com/r/zackgphom" target="_blank" rel="noopener noreferrer" id="support-link"></a>
      </div>
    </header>

    <main class="page-shell">
      <section id="app" class="section hero reveal in">
        <div class="container hero-inner">
          <div class="hero-copy">
            <div class="eyebrow" id="hero-eyebrow"></div>
            <h1 id="hero-title"></h1>
            <p class="lead" id="hero-subtitle"></p>
            <div class="chip-row" id="hero-chips"></div>
          </div>
          <div class="workflow">
            <div class="stack">
              <div class="upload-zone">
                <div class="upload-actions">
                  <button id="btn-select" class="btn btn-primary" type="button"></button>
                  <button id="btn-convert" class="btn" type="button" style="display:none"></button>
                </div>
                <div class="mini-note" id="drag-hint"></div>
                <div class="status" id="status-msg"></div>
              </div>
              <div class="mode-tabs" id="mode-tabs">
                <button class="mode-tab active" data-mode="monolith" type="button">Monolith</button>
                <button class="mode-tab" data-mode="lego" type="button">Lego</button>
                <button class="mode-tab" data-mode="webp" type="button">WebP</button>
              </div>
              <div class="mini-note" id="hero-note"></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px"><div class="mini-note" id="queue-count" style="margin:0"></div><button id="clear-all" class="btn btn-ghost btn-small" type="button" onclick="clearAll()">Clear all</button></div><ul id="file-list" style="list-style:none;padding:0;margin:10px 0 0;display:grid;gap:8px"></ul>
            </div>
            <input type="file" id="file-input" class="hidden-input" multiple accept="image/*,.png,.jpg,.jpeg,.webp,.gif">
          </div>
        </div>
      </section>

      <section id="modes" class="section reveal">
        <div class="container">
          <div class="section-head">
            <div class="eyebrow" id="modes-eyebrow"></div>
            <h2 id="modes-title"></h2>
          </div>
          <div class="panel-grid" id="modes-grid"></div>
        </div>
      </section>

      <section id="what" class="section reveal">
        <div class="container">
          <div class="section-head">
            <div class="eyebrow" id="what-eyebrow"></div>
            <h2 id="what-title"></h2>
          </div>
          <div class="what-copy" id="what-copy"></div>
          <p class="seo subtle" id="what-seo" style="margin-top:20px;max-width:900px"></p>
        </div>
      </section>

      <section id="technical" class="section reveal">
        <div class="container">
          <div class="section-head">
            <div class="eyebrow" id="tech-eyebrow"></div>
            <h2 id="tech-title"></h2>
          </div>
          <div class="tech-grid" id="technical-grid"></div>
        </div>
      </section>

      <section id="faq" class="section reveal">
        <div class="container">
          <div class="section-head">
            <div class="eyebrow" id="faq-eyebrow"></div>
            <h2 id="faq-title"></h2>
          </div>
          <div class="faq-grid" id="faq-grid"></div>
        </div>
      </section>

      <section id="contact" class="section reveal">
        <div class="container">
          <div class="section-head">
            <div class="eyebrow" id="contact-eyebrow"></div>
            <h2 id="contact-title"></h2>
          </div>
          <div class="links" role="list">
            <a class="icon-link" href="https://zack-gphom.itch.io/glorp-pixel-to-svg" target="_blank" rel="noopener noreferrer" title="Itch.io" aria-label="Itch.io">
              <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5c-3.252 0-7.688.05-8.588.13c-1.01.607-3.01 2.901-3.03 3.497v1C4.383 10.89 5.567 12 6.638 12C7.92 12 8.99 10.93 8.99 9.668C8.99 10.93 10.03 12 11.312 12c1.293 0 2.293-1.069 2.293-2.332c0 1.262 1.09 2.332 2.383 2.332h.022c1.293 0 2.383-1.069 2.383-2.332c0 1.262 1.01 2.332 2.293 2.332s2.324-1.069 2.324-2.332c0 1.262 1.07 2.332 2.353 2.332c1.071 0 2.252-1.11 2.252-2.373v-1c-.02-.596-2.02-2.89-3.03-3.496C21.445 5.02 19.253 5 16 5m-2.45 6.742c-1.052 1.81-3.698 1.832-4.73.012c-.63 1.092-2.056 1.514-2.666 1.307c-.178 1.899-.3 11.648.992 13.283c3.797.885 14.019.866 17.708 0c1.495-1.524 1.16-11.522.992-13.283c-.61.207-2.037-.215-2.657-1.307c-1.043 1.82-3.688 1.798-4.74-.012c-.325.59-1.082 1.367-2.449 1.367a2.73 2.73 0 0 1-2.45-1.367M11.42 14c.8 0 1.53 0 2.41.98c1.45-.15 2.89-.15 4.34 0c.89-.97 1.61-.97 2.41-.97c2.58 0 3.2 3.81 4.13 7.09c.84 3.05-.28 3.13-1.67 3.13c-2.07-.08-3.22-1.58-3.22-3.09c-1.93.32-5.01.44-7.64 0c0 1.51-1.15 3.01-3.22 3.09c-1.39 0-2.51-.08-1.67-3.13c.93-3.3 1.55-7.09 4.13-7.09zM16 16.877s-1.694 1.562-2 2.107l1.107-.04v.966c0 .058.819.008.893.008c.447.017.893.033.893-.008v-.967l1.107.041c-.306-.546-2-2.107-2-2.107"/></svg>
            </a>
            <a class="icon-link" href="https://github.com/ZackGphom/GLORP" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5c-6.3 0-11.4 5.1-11.4 11.4 0 5 3.3 9.3 7.8 10.8.6.1.8-.3.8-.6v-2c-3.2.7-3.8-1.5-3.8-1.5-.5-1.3-1.3-1.6-1.3-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.2-1.3-5.2-5.6 0-1.2.4-2.2 1.2-3-.1-.3-.5-1.4.1-3 0 0 .9-.3 3 1.1.9-.2 1.8-.3 2.8-.3.9 0 1.9.1 2.8.3 2.1-1.4 3-1.1 3-1.1.6 1.6.2 2.7.1 3 .7.8 1.2 1.8 1.2 3 0 4.3-2.6 5.3-5.2 5.6.4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.8 0-6.3-5.1-11.4-11.4-11.4z"/></svg>
            </a>
            <a class="icon-link" href="https://x.com/ZackGphom" target="_blank" rel="noopener noreferrer" title="X" aria-label="X">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a class="icon-link" href="mailto:zackgphom@gmail.com" title="Email" aria-label="Email">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            </a>
          </div>
        </div>
      </section>

      <section id="feedback" class="section reveal" style="padding-bottom:0">
        <div class="container">
          <div class="section-head">
            <div class="eyebrow" id="feedback-eyebrow"></div>
            <h2 id="feedback-title"></h2>
          </div>
          <div id="feedback-root"></div>
        </div>
      </section>

      <div class="footer">GLORP v4.0.0 · 2026</div>
    </main>

    <div id="toast" role="status" aria-live="polite"></div>
    <div id="bloom" aria-hidden="true"></div>
  `;
}

function injectStyles() {
  const css = `
    :root{--bg:#0a0a0a;--panel:#111;--panel2:#171717;--line:#2f2f2f;--text:#ececec;--muted:#9a9a9a;--ease:cubic-bezier(0.19,1,0.22,1);--radius:18px;--max:1200px}
    html{scroll-behavior:smooth;overflow-x:hidden}
    html.glorp-preinit body{visibility:hidden}
    html.glorp-ready body{visibility:visible}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif;overflow-x:hidden}
    a{color:inherit} button,input,textarea{font:inherit}
    .container{width:min(var(--max),calc(100vw - 32px));margin:0 auto}
    .reveal{opacity:0;transform:translateY(22px);transition:opacity .75s var(--ease),transform .75s var(--ease)} .reveal.in{opacity:1;transform:none}
    .section{padding:96px 0} .section-head{margin:0 0 24px} .eyebrow{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;font-weight:800}
    h1,h2,h3,p{margin:0} h1{font-size:clamp(38px,6vw,74px);line-height:.95;letter-spacing:-.04em;margin:0 0 16px;font-weight:900;max-width:10ch} h2{font-size:clamp(28px,3.4vw,44px);line-height:1;font-weight:900;letter-spacing:-.03em}
    .lead{max-width:760px;color:var(--muted);font-size:clamp(16px,1.45vw,19px);line-height:1.72} .subtle{color:var(--muted);font-size:14px;line-height:1.7}
    .chip-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px} .chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:rgba(255,255,255,.02);color:#d9d9d9;border-radius:999px;padding:10px 14px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;font-weight:800}
    .btn{height:52px;border-radius:14px;border:1px solid var(--line);background:var(--panel2);color:#fff;padding:0 18px;font-size:12px;text-transform:uppercase;letter-spacing:.18em;font-weight:900;cursor:pointer;transition:transform .25s var(--ease),background .25s var(--ease),border-color .25s var(--ease),box-shadow .25s var(--ease),opacity .25s var(--ease)}
    .btn:hover{transform:translateY(-2px);background:#1d1d1d;border-color:#343434;box-shadow:0 12px 28px rgba(0,0,0,.28)} .btn:active{transform:translateY(1px)} .btn-primary{background:#fff;color:#000;border-color:#fff} .btn-primary:hover{background:#f1f1f1} .btn-ghost{background:transparent} .btn-ghost:hover{background:rgba(255,255,255,.04)} .btn-small{height:38px;padding:0 12px;font-size:10px}
    header{position:fixed;top:16px;left:50%;transform:translateX(-50%);width:min(calc(100vw - 24px),var(--max));z-index:1200;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.05);background:rgba(17,17,17,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:18px;transition:opacity .75s var(--ease),transform .75s var(--ease),width .75s var(--ease),background .75s var(--ease);box-shadow:0 18px 50px rgba(0,0,0,.22)} body:not(.tutorial-accepted) header{opacity:0;transform:translateX(-50%) translateY(-12px);pointer-events:none} body.tutorial-accepted header{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}
    .brand{text-decoration:none} .brand-mark{font-weight:900;letter-spacing:.2em;text-transform:uppercase;font-size:14px;color:#fff}
    nav{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;min-width:0} nav a{text-decoration:none;color:#9a9a9a;font-size:11px;text-transform:uppercase;letter-spacing:.18em;font-weight:800;padding:8px 10px;border-radius:999px;transition:background .22s var(--ease),color .22s var(--ease);white-space:nowrap} nav a:hover{background:rgba(255,255,255,.05);color:#fff}
    .header-actions{display:flex;align-items:center;gap:10px;justify-content:flex-end} .lang-toggle{min-width:76px;text-align:center} .support-link{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    .hero{min-height:100vh;display:flex;align-items:center;padding-top:120px;padding-bottom:80px} .hero-inner{width:100%;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:32px;align-items:center}
    .workflow{border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);border-radius:24px;padding:24px;box-shadow:0 20px 70px rgba(0,0,0,.24)} .workflow .stack{display:grid;gap:14px} .upload-zone{display:grid;gap:12px} .upload-actions{display:flex;gap:12px;flex-wrap:wrap} .status{min-height:20px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#6f6f6f;font-weight:900} .mode-tabs{display:flex;gap:10px;flex-wrap:wrap} .mode-tab{border:1px solid var(--line);background:rgba(255,255,255,.02);color:#9f9f9f;border-radius:999px;padding:10px 14px;cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:.18em;font-weight:900;transition:background .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease),transform .2s var(--ease)} .mode-tab:hover{transform:translateY(-1px);color:#fff;border-color:#444} .mode-tab.active{background:#fff;color:#000;border-color:#fff}
    .mini-note{font-size:12px;color:var(--muted);line-height:1.65} .hidden-input{display:none}
    .panel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:26px}.panel{border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);border-radius:22px;padding:22px;box-shadow:0 16px 50px rgba(0,0,0,.16);min-height:170px}.panel h3{font-size:16px;line-height:1.2;margin-bottom:10px;font-weight:900}.panel p{color:var(--muted);line-height:1.7;font-size:14px}.panel .tag{display:inline-flex;margin-bottom:12px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#fff;font-weight:900;opacity:.78}
    .what-copy{display:grid;gap:18px;max-width:880px}.what-copy .lead{max-width:none}.what-copy .seo{border-left:2px solid rgba(255,255,255,.14);padding-left:16px;color:#d4d4d4;line-height:1.8;font-size:14px}
    .tech-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px}
    .faq-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;max-width:840px}.faq-card{border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);border-radius:18px;overflow:hidden}.faq-btn{width:100%;border:0;background:transparent;color:#fff;padding:18px 18px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;text-align:left;font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.faq-dot{width:8px;height:8px;border-radius:999px;background:#333;flex:0 0 auto}.faq-card.open .faq-dot{background:#fff}.faq-ans{max-height:0;overflow:hidden;opacity:0;color:var(--muted);padding:0 18px;transition:max-height .45s var(--ease),padding .45s var(--ease),opacity .35s var(--ease);line-height:1.75;font-size:14px}.faq-card.open .faq-ans{opacity:1;max-height:240px;padding:0 18px 18px}
    .links{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.icon-link{width:72px;height:72px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;transition:transform .22s var(--ease),background .22s var(--ease),border-color .22s var(--ease)} .icon-link:hover{transform:translateY(-2px);background:rgba(255,255,255,.05);border-color:#3a3a3a}.icon-link svg{width:30px;height:30px;fill:#fff;opacity:.8}
    .footer{padding:28px 0 40px;border-top:1px solid #151515;color:#555;text-align:center;font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:900}
    #toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);z-index:3000;background:rgba(17,17,17,.96);color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px 16px;opacity:0;pointer-events:none;transition:opacity .3s var(--ease),transform .3s var(--ease);font-size:13px;font-weight:800;letter-spacing:.02em;box-shadow:0 16px 36px rgba(0,0,0,.35);max-width:min(90vw,560px);text-align:center} #toast.show{opacity:1;transform:translateX(-50%) translateY(0)} #toast.error{border-color:rgba(255,68,68,.25)} #toast.success{border-color:rgba(255,255,255,.1)}
    #bloom{position:fixed;left:50%;bottom:-8px;transform:translateX(-50%);width:140%;height:86px;pointer-events:none;background:radial-gradient(ellipse at center bottom,rgba(255,255,255,.08) 0%,rgba(255,255,255,.02) 24%,rgba(0,0,0,0) 65%);filter:blur(18px);opacity:.8;z-index:100}
    .rules-modal{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:1;transition:opacity .45s var(--ease)} .rules-modal.closing{opacity:0}.rules-card{width:min(760px,100%);background:#111;border:1px solid #333;border-radius:18px;padding:24px;box-shadow:0 20px 80px rgba(0,0,0,.5);transform:translateY(0);transition:transform .45s var(--ease),opacity .45s var(--ease)} .rules-modal.closing .rules-card{transform:translateY(24px);opacity:0}.rules-title{color:#ff4444;font-size:18px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;margin-bottom:16px}.rules-list{display:grid;gap:14px;color:#cfcfcf;line-height:1.7;font-size:14px}.rules-list strong{color:#fff}.rules-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.rules-btn{height:42px;padding:0 14px;border-radius:12px;border:1px solid #333;background:transparent;color:#d6d6d6;font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:900;cursor:pointer;transition:transform .2s var(--ease),background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease)} .rules-btn:hover{transform:translateY(-1px);border-color:#555;background:rgba(255,255,255,.04);color:#fff}.rules-btn.primary{background:#fff;color:#000;border-color:#fff}.rules-btn.primary:hover{background:#f1f1f1;color:#000}.lang-note{font-size:12px;color:var(--muted);margin-top:10px}
    @media (max-width:980px){.hero-inner{grid-template-columns:1fr;gap:18px}.panel-grid{grid-template-columns:1fr}.tech-grid{grid-template-columns:1fr}nav{display:none}header{grid-template-columns:auto auto auto}}
    @media (max-width:620px){.section{padding:72px 0}.hero{padding-top:110px;min-height:auto}.workflow{padding:18px}.upload-actions{display:grid;grid-template-columns:1fr}.btn{width:100%}.rules-card{padding:18px}.rules-actions{flex-direction:column}.rules-btn{width:100%}.header-actions{gap:8px}.lang-toggle{min-width:64px}.icon-link{width:64px;height:64px}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

function renderLocale(lang) {
  state.language = SUPPORTED_LANGS.has(lang) ? lang : 'en';
  updateSeo(state.language);
  const strings = STRINGS[state.language];
  const setText = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  setText('#hero-eyebrow', strings.hero.eyebrow);
  setText('#hero-title', strings.hero.title);
  setText('#hero-subtitle', strings.hero.subtitle);
  setText('#btn-select', strings.hero.select);
  setText('#btn-convert', strings.hero.convert);
  setText('#drag-hint', strings.hero.drag);
  setText('#hero-note', strings.hero.note);
  setText('#modes-eyebrow', strings.modes.eyebrow);
  setText('#modes-title', strings.modes.title);
  setText('#what-eyebrow', strings.what.eyebrow);
  setText('#what-title', strings.what.title);
  setText('#what-seo', strings.what.seo);
  setText('#tech-eyebrow', strings.technical.eyebrow);
  setText('#tech-title', strings.technical.title);
  setText('#faq-eyebrow', strings.faq.eyebrow);
  setText('#faq-title', strings.faq.title);
  setText('#contact-eyebrow', strings.contact.eyebrow);
  setText('#contact-title', strings.contact.title);
  setText('#feedback-eyebrow', strings.feedback.eyebrow);
  setText('#feedback-title', strings.feedback.title);
  setText('#support-link', strings.nav.support);
  setText('#lang-switch', strings.lang);
  setText('#rules-title', strings.tutorial.title);
  setText('#rules-close', strings.tutorial.button);
  setText('#rules-lang-note', strings.tutorial.langNote);
  $$('nav a[data-nav]').forEach((link) => { link.textContent = strings.nav[link.dataset.nav]; });
  const chips = $('#hero-chips');
  if (chips) chips.innerHTML = strings.hero.chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join('');
  const rulesList = $('#rules-list');
  if (rulesList) rulesList.innerHTML = strings.tutorial.lines.map((line) => `<div>${line}</div>`).join('');
  renderModes(); renderWhat(); renderTechnical(); renderFaq();
}

function renderModes() {
  const grid = $('#modes-grid'); if (!grid) return;
  grid.innerHTML = STRINGS[state.language].modes.cards.map((card) => `
    <article class="panel"><span class="tag">${escapeHtml(card.tag)}</span><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.text)}</p></article>
  `).join('');
}
function renderWhat() {
  const wrap = $('#what-copy'); if (!wrap) return;
  wrap.innerHTML = STRINGS[state.language].what.paragraphs.map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join('');
}
function renderTechnical() {
  const grid = $('#technical-grid'); if (!grid) return;
  grid.innerHTML = STRINGS[state.language].technical.cards.map((card) => `
    <article class="panel"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.text)}</p></article>
  `).join('');
}
function renderFaq() {
  const grid = $('#faq-grid'); if (!grid) return;
  grid.innerHTML = STRINGS[state.language].faq.items.map((item, idx) => `
    <div class="faq-card${idx === 0 ? ' open' : ''}"><button class="faq-btn" type="button"><span>${escapeHtml(item.q)}</span><span class="faq-dot" aria-hidden="true"></span></button><div class="faq-ans">${escapeHtml(item.a)}</div></div>
  `).join('');
  initFaq();
}

function showToast(message, type = 'success', ms = 2200) {
  const toast = $('#toast'); if (!toast) return;
  toast.className = ''; toast.classList.add(type === 'error' ? 'error' : 'success'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => toast.classList.remove('show', 'success', 'error'), ms);
}

function setLoadingDone() {
  document.documentElement.classList.remove('glorp-preinit');
  document.documentElement.classList.add('glorp-ready');
}

function syncHeaderState() {
  if (state.headerLock || !state.tutorialAccepted) return;
  const header = $('#main-header'); if (!header) return;
  header.classList.toggle('files-hidden', state.selectedFiles.length > 0);
}

function updateUI() {
  const hasFiles = state.selectedFiles.length > 0;
  syncHeaderState();
  const convertButton = $('#btn-convert');
  if (convertButton) convertButton.style.display = hasFiles ? 'inline-flex' : 'none';
  const queueCount = $('#queue-count');
  if (queueCount) queueCount.textContent = hasFiles ? t('warnings.addedOne', { count: state.selectedFiles.length }) : '';

  const list = $('#file-list');
  if (list) {
    if (!hasFiles) {
      list.innerHTML = '';
    } else {
      list.innerHTML = state.selectedFiles.map((file, index) => {
        const displayName = file.name.length > 28 ? file.name.substring(0, 25) + '...' : file.name;
        return '<li style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#0f0f0f;color:#888;font-size:12px"><span title="' + escapeHtml(file.name) + '">' + escapeHtml(displayName) + '</span><button type="button" data-remove="' + index + '" style="border:0;background:transparent;color:#666;font-weight:900;font-size:18px;cursor:pointer;line-height:1">×</button></li>';
      }).join('');
      list.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const index = Number(btn.getAttribute('data-remove'));
          removeFile(index);
        });
      });
    }
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
function loadImageFromSource(src) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Image load error')); img.src = src; });
}
async function decodeFileToCanvas(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; ctx.drawImage(bitmap, 0, 0); if (bitmap.close) bitmap.close();
    return { canvas, ctx, width: canvas.width, height: canvas.height };
  }
  const dataUrl = await fileToDataURL(file); const img = await loadImageFromSource(dataUrl);
  const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0);
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}
function rgbaToHex(r, g, b) { return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`; }
function buildLegoSvgFromImageData(imageData) { const { data, width, height } = imageData; let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`; for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; if (a === 0) continue; const pixel = i / 4; const x = pixel % width; const y = Math.floor(pixel / width); svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${rgbaToHex(data[i], data[i + 1], data[i + 2])}" fill-opacity="${(a / 255).toFixed(3)}"/>`; } return svg + '</svg>'; }
const CLOCKWISE = 1; const ANTICLOCKWISE = 2;
function edgeFinding(grid, W, H) { const ver_edges = new Uint8Array(H * (W + 1)); const hor_edges = new Uint8Array((H + 1) * W); for (let r = 0; r <= H; r++) for (let c = 0; c < W; c++) { const p = (r < H) ? grid[r * W + c] : 0; const prev_p = (r > 0) ? grid[(r - 1) * W + c] : 0; const n = 1 - prev_p; if (p === 1 && n === 1) hor_edges[r * W + c] = CLOCKWISE; else if (p === 0 && n === 0) hor_edges[r * W + c] = ANTICLOCKWISE; } for (let r = 0; r < H; r++) for (let c = 0; c <= W; c++) { const p = (c < W) ? grid[r * W + c] : 0; const prev_p = (c > 0) ? grid[r * W + (c - 1)] : 0; const n = 1 - prev_p; if (p === 1 && n === 1) ver_edges[r * (W + 1) + c] = ANTICLOCKWISE; else if (p === 0 && n === 0) ver_edges[r * (W + 1) + c] = CLOCKWISE; } return { ver_edges, hor_edges }; }
function tracePath(startR, startC, ver_edges, hor_edges, W, H) { let path = ''; let r = startR; let c = startC; let dir = 'R'; while (true) { if (dir === 'R') { let destC; for (destC = c; destC < W; destC++) { if (hor_edges[r * W + destC] === CLOCKWISE) hor_edges[r * W + destC] = 0; else break; } path += `h${destC - c}`; if (destC < (W + 1) && ver_edges[r * (W + 1) + destC] === CLOCKWISE) { c = destC; dir = 'D'; } else if (r > 0 && ver_edges[(r - 1) * (W + 1) + destC] === ANTICLOCKWISE) { r = r - 1; c = destC; dir = 'U'; } else break; } else if (dir === 'D') { let destR; for (destR = r; destR < H; destR++) { if (ver_edges[destR * (W + 1) + c] === CLOCKWISE) ver_edges[destR * (W + 1) + c] = 0; else break; } path += `v${destR - r}`; if (c > 0 && hor_edges[destR * W + (c - 1)] === ANTICLOCKWISE) { r = destR; c = c - 1; dir = 'L'; } else if (destR < (H + 1) && hor_edges[destR * W + c] === CLOCKWISE) { r = destR; dir = 'R'; } else break; } else if (dir === 'L') { let destC; for (destC = c; destC >= 0; destC--) { if (hor_edges[r * W + destC] === ANTICLOCKWISE) hor_edges[r * W + destC] = 0; else break; } path += `h${destC - c}`; if (r > 0 && ver_edges[(r - 1) * (W + 1) + (destC + 1)] === ANTICLOCKWISE) { r = r - 1; c = destC + 1; dir = 'U'; } else if ((destC + 1) < (W + 1) && ver_edges[r * (W + 1) + (destC + 1)] === CLOCKWISE) { c = destC + 1; dir = 'D'; } else break; } else if (dir === 'U') { let destR; for (destR = r; destR >= 0; destR--) { if (ver_edges[destR * (W + 1) + c] === ANTICLOCKWISE) ver_edges[destR * (W + 1) + c] = 0; else break; } path += `v${destR - r}`; if (hor_edges[(destR + 1) * W + c] === CLOCKWISE) { r = destR + 1; dir = 'R'; } else if (c > 0 && hor_edges[(destR + 1) * W + (c - 1)] === ANTICLOCKWISE) { r = destR + 1; c = c - 1; dir = 'L'; } else break; } } return path; }
function pathFinding(grid, W, H) { const { ver_edges, hor_edges } = edgeFinding(grid, W, H); let path_data = ''; const hor_len = (H + 1) * W; for (let i = 0; i < hor_len; i++) if (hor_edges[i] === CLOCKWISE) { const r = Math.floor(i / W); const c = i % W; path_data += `M${c},${r}`; path_data += tracePath(r, c, ver_edges, hor_edges, W, H); path_data += 'z'; } return path_data; }
function buildMonolithSvgFromImageData(imageData) { const { data, width: W, height: H } = imageData; const uniqueColors = new Map(); const colorMap = new Uint32Array(W * H); for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; let a = data[i + 3]; if (a < 5) { colorMap[i / 4] = 0; continue; } if (a > 250) a = 255; const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0; if (!uniqueColors.has(key)) uniqueColors.set(key, { r, g, b, a }); colorMap[i / 4] = key; } let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`; const grid = new Uint8Array(W * H); for (const [key, p] of uniqueColors) { grid.fill(0); let hasPixels = false; for (let i = 0; i < W * H; i++) if (colorMap[i] === key) { grid[i] = 1; hasPixels = true; } if (hasPixels) { const pathData = pathFinding(grid, W, H); if (pathData) svg += `<path d="${pathData}" fill="${rgbaToHex(p.r, p.g, p.b)}" fill-opacity="${(p.a / 255).toFixed(3)}" fill-rule="evenodd"/>`; } } return svg + '</svg>'; }
async function decodeFile(file) { if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is not available'); const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; ctx.drawImage(bitmap, 0, 0); if (bitmap.close) bitmap.close(); const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); return { canvas, imageData, width: canvas.width, height: canvas.height }; }

function customConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s ease';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(560px,100%);background:#111;border:1px solid #333;border-radius:16px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.5);transform:translateY(8px);transition:opacity .22s ease,transform .22s ease';
    card.innerHTML = `<div style="color:#ff4444;font-weight:900;letter-spacing:.18em;text-transform:uppercase;font-size:18px;margin-bottom:12px">${escapeHtml(title)}</div><div style="color:#aaa;line-height:1.7;font-size:14px">${escapeHtml(message)}</div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px"><button type="button" data-action="cancel" style="height:42px;padding:0 14px;border-radius:12px;border:1px solid #444;background:transparent;color:#d0d0d0;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">CANCEL</button><button type="button" data-action="continue" style="height:42px;padding:0 14px;border-radius:12px;border:1px solid #fff;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">CONTINUE ANYWAY</button></div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; card.style.transform = 'translateY(0)'; });

    const close = (value) => {
      overlay.style.opacity = '0';
      card.style.transform = 'translateY(8px)';
      setTimeout(() => { overlay.remove(); resolve(value); }, 220);
    };

    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(false); });
    card.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    card.querySelector('[data-action="continue"]').addEventListener('click', () => close(true));
  });
}

async function handleFiles(list) {
  const incoming = Array.from(list || []).filter((file) => file && ACCEPTED_IMAGE_RE.test(file.name));
  if (!incoming.length) {
    showToast(t('warnings.noValid'), 'error');
    return;
  }

  let addedCount = 0;

  for (const file of incoming) {
    try {
      const decoded = await decodeFileToCanvas(file);
      const maxDim = Math.max(decoded.width || 0, decoded.height || 0);

      if (maxDim > 800) {
        const ok = await customConfirm(t('warnings.massiveTitle'), t('warnings.massiveBody'));
        if (!ok) continue;
      } else if (maxDim > 500 && maxDim < 800) {
        showToast(t('warnings.large'), 'success', 2200);
      }

      state.selectedFiles.push(file);
      addedCount += 1;
    } catch (error) {
      console.error('File decode failed:', file.name, error);
      showToast(t('warnings.badFile'), 'error', 2200);
    }
  }

  if (addedCount > 0) {
    updateUI();
    showToast(t('warnings.addedOne', { count: addedCount }), 'success', 1500);
  }
}

function removeFile(index) {
  state.selectedFiles.splice(index, 1);
  updateUI();
  showToast(t('warnings.removed'), 'success', 900);
}

function clearAll() {
  state.selectedFiles = [];
  updateUI();
  showToast(t('warnings.cleared'), 'success', 900);
}

window.removeFile = removeFile;
window.clearAll = clearAll;

async function convertSingleFile(file, mode) {
  if (!state.worker) {
    state.worker = new Worker('./js/conversion-worker.js');
    state.worker.onmessage = (event) => {
      const { id, ok, blob, filename, error } = event.data || {};
      const pending = state.workerRequests.get(id);
      if (!pending) return;
      state.workerRequests.delete(id);
      if (ok) pending.resolve({ blob, filename });
      else pending.reject(new Error(error || 'Worker conversion failed'));
    };
    state.worker.onerror = (error) => {
      console.error('Worker error:', error);
      showToast(t('warnings.workerError'), 'error', 3000);
      state.worker = null;
    };
  }

  const id = ++state.workerReqId;
  const response = await new Promise((resolve, reject) => {
    state.workerRequests.set(id, { resolve, reject });
    state.worker.postMessage({ id, file, mode });
  });

  const url = URL.createObjectURL(response.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

async function convertSelectedFiles() {
  const activeTab = $('.mode-tab.active');
  const mode = activeTab ? activeTab.dataset.mode : 'monolith';
  const status = $('#status-msg');

  if (state.selectedFiles.length === 0) {
    if (status) status.textContent = t('hero.statusNoFiles');
    showToast(t('warnings.convertNone'), 'error');
    return;
  }

  if (status) status.textContent = t('warnings.converting', { count: state.selectedFiles.length });
  showToast(t('warnings.converting', { count: state.selectedFiles.length }), 'success', 1400);

  for (const file of state.selectedFiles.slice()) {
    try {
      if (status) status.textContent = t('warnings.convertingFile', { name: file.name });
      await convertSingleFile(file, mode);
      if (status) status.textContent = t('warnings.convertedFile', { name: file.name });
      showToast(t('warnings.convertedFile', { name: file.name }), 'success', 1200);
    } catch (error) {
      console.error('Conversion failed for', file.name, error);
      showToast(t('warnings.failed', { name: file.name }), 'error', 2500);
    }
  }

  if (status) status.textContent = t('warnings.converted');
  showToast(t('warnings.converted'), 'success', 1800);
  setTimeout(() => {
    if (status && status.textContent === t('warnings.converted')) status.textContent = '';
  }, 4000);

  state.selectedFiles = [];
  updateUI();
}

function initDragAndDrop() {
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', async (event) => {
    event.preventDefault();
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
        if (file && file.size !== 0 && ACCEPTED_IMAGE_RE.test(file.name)) files.push(file);
      }
    } else {
      files = Array.from(event.dataTransfer.files).filter((file) => {
        if (!file) return false;
        if (file.size === 0 && !ACCEPTED_IMAGE_RE.test(file.name)) {
          foldersDetected += 1;
          return false;
        }
        return ACCEPTED_IMAGE_RE.test(file.name);
      });
    }

    if (foldersDetected > 0) showToast(t('warnings.folderDesktop'), 'error', 5000);
    if (!files.length) return;
    await handleFiles(files);
  });
}

function scrollToSection(target, offset = 0) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const top = (window.pageYOffset || window.scrollY || 0) + rect.top + offset;
  window.scrollTo({ behavior: 'smooth', top: Math.max(0, top) });
}

function ensureFeedbackModuleLoaded() {
  if (window.GlorpFeedback && typeof window.GlorpFeedback.mount === 'function') return Promise.resolve(window.GlorpFeedback);
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
    if (!window.GlorpFeedback || typeof window.GlorpFeedback.mount !== 'function') throw new Error('Feedback module did not register correctly');
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
  ensureFeedbackModuleLoaded().then((api) => {
    if (api && typeof api.mount === 'function') {
      api.mount(root, { endpoint: ENDPOINT, secret: FEEDBACK_SECRET, cooldownMs: FEEDBACK_COOLDOWN_MS, cooldownKey: FEEDBACK_COOLDOWN_KEY, });
    }
  }).catch((error) => {
    console.error('Feedback module failed to load:', error);
    state.feedbackLoaded = false;
    const target = $('#feedback-root');
    if (target) target.innerHTML = `<div style="padding:40px 20px;color:#888;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(t('feedback.unavailable'))}</div>`;
  });
}

function initNavigation() {
  const header = $('#main-header');
  const appSection = $('#app');
  if (appSection) {
    const appObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        state.appInView = entry.intersectionRatio >= 0.6;
        syncHeaderState();
      });
    }, { threshold: [0, 0.25, 0.6, 0.95] });
    appObserver.observe(appSection);
  }
  const feedbackSection = $('#feedback');
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
    if ('requestIdleCallback' in window) requestIdleCallback(() => mountFeedbackIfNeeded(), { timeout: 2500 });
    else setTimeout(() => mountFeedbackIfNeeded(), 1200);
  }
  $$('nav a').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      const target = document.querySelector(href);
      if (!target) return;
      if (href === '#app') {
        state.headerLock = true;
        header && header.classList.remove('compact');
        setTimeout(() => {
          state.headerLock = false;
        }, 1200);
        scrollToSection(target, -120);
        return;
      }
      if (href === '#feedback') {
        header && header.classList.add('compact');
        mountFeedbackIfNeeded();
        scrollToSection(target, -120);
        return;
      }
      header && header.classList.add('compact');
      scrollToSection(target, -120);
    });
  });
}

function initRevealObservers() {
  const sections = $$('.reveal');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.intersectionRatio > 0.1) entry.target.classList.add('in');
    });
  }, { threshold: [0, 0.1, 0.4] });
  sections.forEach((section) => sectionObserver.observe(section));
}

function initBloom() {
  const bloom = $('#bloom');
  if (!bloom) return;
  function updateBloom() {
    const max = 420;
    const y = window.scrollY || window.pageYOffset;
    const progress = Math.min(Math.max(y / max, 0), 1);
    const scale = 0.95 + 0.5 * progress;
    const opacity = 0.8 - 0.45 * progress;
    bloom.style.transform = `translateX(-50%) scaleX(${scale})`;
    bloom.style.opacity = `${opacity}`;
  }
  window.addEventListener('scroll', updateBloom, { passive: true });
  updateBloom();
}

function initFaq() {
  $$('.faq-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.parentElement;
      const wasOpen = card.classList.contains('open');
      $$('.faq-card.open').forEach((openCard) => {
        if (openCard !== card) openCard.classList.remove('open');
      });
      card.classList.toggle('open', !wasOpen);
    });
  });
}

function initFileInput() {
  const input = $('#file-input');
  if (!input) return;
  input.addEventListener('change', async (event) => {
    await handleFiles(event.target.files);
    input.value = '';
  });
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

function openTutorial() {
  state.tutorialAccepted = false;
  const modal = $('#tutorial-modal');
  if (!modal) return;
  document.body.classList.remove('tutorial-accepted');
  document.body.style.overflow = 'hidden';
  const finish = () => {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      state.tutorialAccepted = true;
      document.body.classList.add('tutorial-accepted');
      document.body.style.overflow = '';
      syncHeaderState();
    }, 420);
  };
  $('#rules-close') && $('#rules-close').addEventListener('click', finish);
  modal.addEventListener('click', (event) => { if (event.target === modal) finish(); }, { once: true });
}

function initLanguageToggle() {
  const button = $('#lang-switch');
  if (!button) return;
  button.addEventListener('click', () => {
    const next = state.language === 'ru' ? 'en' : 'ru';
    persistLanguage(next);
    renderLocale(next);
    button.textContent = t('lang');
  });
}

function initLogoAndAppButton() {
  const selectButton = $('#btn-select');
  if (selectButton) selectButton.addEventListener('click', () => {
    const input = $('#file-input');
    if (input) input.click();
  });
}

async function bootstrap() {
  injectStyles();
  buildShell();
  renderLocale(detectLanguage());
  initLoadingScreen();
  initLogoAndAppButton();
  initDragAndDrop();
  initNavigation();
  initRevealObservers();
  initBloom();
  initFaq();
  initFileInput();
  initModeTabs();
  initConvertButton();
  initLanguageToggle();
  openTutorial();
  updateUI();
  document.body.classList.add('tutorial-open');
}

function initLoadingScreen() { requestAnimationFrame(() => { setLoadingDone(); }); }
bootstrap();
