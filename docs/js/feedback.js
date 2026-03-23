(function () {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return () => {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeFeedback(item, index = 0) {
    const name = String(item?.name || 'Anonymous').trim().slice(0, 24) || 'Anonymous';
    const text = String(item?.text || '').trim().slice(0, 1200);
    if (!text) return null;

    const ratingRaw = item?.rating ?? item?.stars ?? item?.score;
    let rating = parseInt(ratingRaw, 10);
    if (Number.isNaN(rating)) rating = 5;
    rating = clamp(rating, 1, 5);

    const status = String(item?.status || 'approved').trim().toLowerCase();
    const rawId = item?.id || item?.date || `${name}-${text.slice(0, 48)}-${index}`;
    const seed = hashString(String(rawId));
    const rand = mulberry32(seed);
    const createdAt = new Date(item?.date || Date.now()).getTime();

    return {
      id: String(rawId),
      seed,
      name,
      text,
      rating,
      status,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      revealDelay: 0.04 + rand() * 0.5,
      startScale: 0.72 + rand() * 0.1,
      hoverScale: 1.01 + rand() * 0.03,
      hoverLift: 2 + rand() * 4,
    };
  }

  function formatCooldown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  function masonryColumns(items, columnsCount) {
    const columns = Array.from({ length: columnsCount }, () => []);
    const heights = Array.from({ length: columnsCount }, () => 0);

    items.forEach((comment, index) => {
      const approxHeight = 120 + Math.min(220, (comment.text?.length || 0) * 0.42) + Math.min(24, (comment.name?.length || 0) * 1.2);
      let targetColumn = 0;
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < heights[targetColumn]) targetColumn = i;
      }
      heights[targetColumn] += approxHeight;
      columns[targetColumn].push({ comment, index });
    });

    return columns;
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === 'string') el.textContent = text;
    return el;
  }

  async function fetchFeedback(endpoint) {
    const response = await fetch(`${endpoint}?t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    const raw = Array.isArray(data) ? data : Array.isArray(data?.comments) ? data.comments : [];

    return raw
      .map(normalizeFeedback)
      .filter((item) => item && item.status === 'approved')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
  }

  function mount(root, options) {
    if (!root) return null;

    const config = {
      endpoint: options?.endpoint || '',
      secret: options?.secret || '',
      cooldownMs: Number(options?.cooldownMs || 60 * 60 * 1000),
      cooldownKey: options?.cooldownKey || 'glorp_feedback_last_submit_at',
    };

    const state = {
      items: [],
      name: '',
      text: '',
      rating: 5,
      isSubmitting: false,
      submitStatus: '',
      inView: false,
      expanded: false,
      cooldownLeft: 0,
      fetchLock: false,
      refreshTimer: null,
      cooldownTimer: null,
      observer: null,
      resizeTimer: null,
      mounted: false,
    };

    root.innerHTML = `
      <div class="feedback-stage">
        <div class="feedback-inner">
          <div class="feedback-form-wrap">
            <div class="feedback-form">
              <div class="feedback-title">Feedback</div>
              <div class="feedback-subtitle">Leave your review</div>
              <form class="feedback-form-inner" novalidate></form>
            </div>
          </div>
          <div class="feedback-list-wrapper">
            <div class="feedback-list"></div>
            <div class="feedback-mask hidden">
              <button type="button" class="feedback-more">More</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const form = root.querySelector('.feedback-form-inner');
    const list = root.querySelector('.feedback-list');
    const mask = root.querySelector('.feedback-mask');
    const moreButton = root.querySelector('.feedback-more');

    const nameInput = createEl('input', 'feedback-field');
    nameInput.type = 'text';
    nameInput.placeholder = 'NAME';
    nameInput.maxLength = 24;

    const textarea = createEl('textarea', 'feedback-textarea');
    textarea.placeholder = 'TYPE YOUR REVIEW...';
    textarea.required = true;
    textarea.maxLength = 1200;
    textarea.rows = 6;

    const charline = createEl('div', 'feedback-charline');
    const charLeft = createEl('span', '', '');
    const charRight = createEl('span', '', '0/1200');
    charline.append(charLeft, charRight);

    const starsPicker = createEl('div', 'feedback-stars-picker');
    starsPicker.setAttribute('aria-label', 'Rating selector');
    const ratingsRow = [1, 2, 3, 4, 5];
    const starButtons = ratingsRow.map((value) => {
      const btn = createEl('button', 'feedback-star-btn', '★');
      btn.type = 'button';
      btn.setAttribute('aria-label', `${value} stars`);
      btn.addEventListener('click', () => {
        state.rating = value;
        syncStars();
      });
      starsPicker.appendChild(btn);
      return btn;
    });

    const sendButton = createEl('button', 'feedback-send', 'Send feedback');
    sendButton.type = 'submit';

    form.append(nameInput, textarea, charline, starsPicker, sendButton);

    function syncStars() {
      starButtons.forEach((btn, index) => {
        btn.classList.toggle('active', index + 1 <= state.rating);
      });
    }

    function syncCooldown() {
      const lastSubmitted = Number(localStorage.getItem(config.cooldownKey) || 0);
      state.cooldownLeft = Math.max(0, (lastSubmitted + config.cooldownMs) - Date.now());
      sendButton.disabled = state.isSubmitting || !state.text.trim() || state.cooldownLeft > 0;
      sendButton.textContent = state.submitStatus || (state.cooldownLeft > 0 ? `Wait ${formatCooldown(state.cooldownLeft)}` : 'Send feedback');
    }

    function setSubmitStatus(value) {
      state.submitStatus = value || '';
      syncCooldown();
    }

    function setText(value) {
      state.text = String(value || '').slice(0, 1200);
      textarea.value = state.text;
      charRight.textContent = `${state.text.length}/1200`;
      syncCooldown();
    }

    function setName(value) {
      state.name = String(value || '').slice(0, 24);
      nameInput.value = state.name;
    }

    function renderComments() {
      list.innerHTML = '';

      const items = state.items;
      if (!items.length) {
        list.innerHTML = '<div style="padding:24px 0;color:rgba(255,255,255,.42);text-align:center;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Loading comments...</div>';
        mask.classList.add('hidden');
        return;
      }

      const columnsCount = window.innerWidth <= 600 ? 1 : window.innerWidth <= 1024 ? 2 : 3;
      const columns = masonryColumns(items, columnsCount);

      columns.forEach((column) => {
        const columnEl = createEl('div', 'feedback-list-column');
        column.forEach(({ comment, index }) => {
          const commentEl = createEl('div', 'feedback-comment');
          commentEl.style.opacity = '0';
          commentEl.style.transform = 'translateY(14px) scale(0.98)';
          commentEl.style.transitionDelay = `${Math.min(240, index * 35)}ms`;
          commentEl.style.transition = 'opacity .56s cubic-bezier(0.16,1,0.22,1), transform .56s cubic-bezier(0.16,1,0.22,1), background .34s cubic-bezier(0.19,1,0.22,1), border-color .34s cubic-bezier(0.19,1,0.22,1), box-shadow .34s cubic-bezier(0.19,1,0.22,1), filter .34s cubic-bezier(0.19,1,0.22,1)';
          commentEl.style.zIndex = String(index + 1);

          const nameEl = createEl('div', 'feedback-name', comment.name);
          const textEl = createEl('div', 'feedback-text', comment.text);
          const starsEl = createEl('div', 'feedback-stars');
          starsEl.setAttribute('aria-label', `Rating ${comment.rating} of 5`);

          for (let i = 0; i < 5; i++) {
            const star = createEl('span', i < comment.rating ? 'filled' : '', '★');
            starsEl.appendChild(star);
          }

          commentEl.append(nameEl, textEl, starsEl);
          columnEl.appendChild(commentEl);

          requestAnimationFrame(() => {
            commentEl.style.opacity = '1';
            commentEl.style.transform = 'translateY(0) scale(1)';
          });
        });
        list.appendChild(columnEl);
      });

      const shouldMask = items.length > 6;
      mask.classList.toggle('hidden', !shouldMask || state.expanded);
      mask.classList.toggle('expanded', state.expanded);
    }

    function applyFormState() {
      nameInput.value = state.name;
      textarea.value = state.text;
      charRight.textContent = `${state.text.length}/1200`;
      syncStars();
      syncCooldown();
    }

    async function refresh() {
      if (state.fetchLock) return;
      state.fetchLock = true;

      try {
        const items = await fetchFeedback(config.endpoint);
        state.items = items;
        renderComments();
      } catch (error) {
        console.error(error);
        list.innerHTML = '<div style="padding:24px 0;color:rgba(255,255,255,.42);text-align:center;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Comments unavailable</div>';
        mask.classList.add('hidden');
      } finally {
        state.fetchLock = false;
      }
    }

    async function handleSubmit(event) {
      event.preventDefault();
      if (state.isSubmitting || !state.text.trim()) return;

      const lastSubmitted = Number(localStorage.getItem(config.cooldownKey) || 0);
      const cooldownRemaining = Math.max(0, (lastSubmitted + config.cooldownMs) - Date.now());
      if (cooldownRemaining > 0) {
        setSubmitStatus(`Wait ${formatCooldown(cooldownRemaining)}`);
        return;
      }

      state.isSubmitting = true;
      setSubmitStatus('Sending...');

      try {
        const payload = {
          name: state.name.trim() || 'Anonymous',
          text: state.text.trim().slice(0, 1200),
          rating: String(clamp(Number(state.rating) || 5, 1, 5)),
          status: 'pending',
          secret: config.secret,
          elapsed: '4000',
          extra_field: '',
        };

        await fetch(config.endpoint, {
          method: 'POST',
          mode: 'no-cors',
          credentials: 'omit',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        localStorage.setItem(config.cooldownKey, String(Date.now()));
        state.cooldownLeft = config.cooldownMs;
        setSubmitStatus('Sent');
        setText('');
        state.rating = 5;
        syncStars();
        localStorage.setItem(config.cooldownKey, String(Date.now()));

        setTimeout(async () => {
          await refresh();
          setSubmitStatus('');
        }, 1800);
      } catch (error) {
        console.error(error);
        setSubmitStatus('Error');
        setTimeout(() => setSubmitStatus(''), 2400);
      } finally {
        state.isSubmitting = false;
        syncCooldown();
      }
    }

    function setExpanded(value) {
      state.expanded = Boolean(value);
      renderComments();
    }

    function wireEvents() {
      nameInput.addEventListener('input', () => {
        setName(nameInput.value);
      });

      textarea.addEventListener('input', () => {
        setText(textarea.value);
      });

      form.addEventListener('submit', handleSubmit);

      moreButton.addEventListener('click', () => {
        setExpanded(true);
      });

      state.observer = new IntersectionObserver(([entry]) => {
        state.inView = Boolean(entry && entry.isIntersecting);
        const formWrap = root.querySelector('.feedback-form-wrap');
        if (formWrap) {
          formWrap.style.opacity = state.inView ? '1' : '0';
          formWrap.style.transform = state.inView ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.98)';
        }
      }, { threshold: 0.16 });
      state.observer.observe(root);

      window.addEventListener('resize', () => {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = setTimeout(renderComments, 120);
      }, { passive: true });
    }

    function boot() {
      const formWrap = root.querySelector('.feedback-form-wrap');
      if (formWrap) {
        formWrap.style.opacity = '0';
        formWrap.style.transform = 'translateY(18px) scale(0.98)';
        formWrap.style.transition = 'opacity .72s cubic-bezier(0.16,1,0.22,1), transform .72s cubic-bezier(0.16,1,0.22,1)';
      }

      applyFormState();
      wireEvents();
      renderComments();
      refresh();
      state.refreshTimer = setInterval(refresh, 30000);
      state.cooldownTimer = setInterval(syncCooldown, 1000);
      syncCooldown();

      requestAnimationFrame(() => {
        if (formWrap) {
          formWrap.style.opacity = '1';
          formWrap.style.transform = 'translateY(0) scale(1)';
        }
      });
    }

    if (!state.mounted) {
      state.mounted = true;
      boot();
    }

    return {
      refresh,
      destroy() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (state.cooldownTimer) clearInterval(state.cooldownTimer);
        if (state.observer) state.observer.disconnect();
      },
    };
  }

  window.GlorpFeedback = {
    mount,
  };
})();
