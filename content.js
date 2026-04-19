(() => {
  if (!/\.(md|markdown|mdown|mkd)$/i.test(location.pathname)) return;

  // 파일별 저장 키 (모든 파일별 저장이 이걸 공유)
  const FILE_PREF_KEY = 'prefs:' + location.pathname;
  let filePrefs = {};
  let globalPrefs = {};
  let currentSectionId = null;  // 현재 스크롤 위치의 섹션 id

  function saveFilePrefSingle(key, value) {
    filePrefs[key] = value;
    try { chrome.storage.local.set({ [FILE_PREF_KEY]: filePrefs }); } catch {}
  }

  // ---- 폰트 주입 (chrome-extension:// 절대 경로로 확실하게 로드) ----
  try {
    const FONTS = [
      { family: 'Paperlogy', weight: 400, file: 'Paperlogy-4Regular.woff2' },
      { family: 'Paperlogy', weight: 500, file: 'Paperlogy-5Medium.woff2' },
      { family: 'Paperlogy', weight: 600, file: 'Paperlogy-6SemiBold.woff2' },
      { family: 'Paperlogy', weight: 700, file: 'Paperlogy-7Bold.woff2' },
      { family: 'Pretendard Variable', weight: '45 920', file: 'PretendardVariable.woff2', variations: true }
    ];
    const fontCSS = FONTS.map(f => {
      const url = chrome.runtime.getURL('fonts/' + f.file);
      const fmt = f.variations ? 'woff2-variations' : 'woff2';
      return `@font-face{font-family:'${f.family}';src:url('${url}') format('${fmt}');font-weight:${f.weight};font-display:swap;}`;
    }).join('\n');
    const s = document.createElement('style');
    s.id = 'mv-fonts';
    s.textContent = fontCSS;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[Markview] font inject failed:', e);
  }

  const pre = document.body.querySelector('pre');
  if (!pre) return;
  const rawSrc = pre.innerText;

  // ---- 저장된 스크롤 위치 복원 (자동 새로고침 시) ----
  const SCROLL_KEY = 'mv-scroll:' + location.pathname;
  const savedScroll = sessionStorage.getItem(SCROLL_KEY);
  if (savedScroll) {
    sessionStorage.removeItem(SCROLL_KEY);
    const y = parseInt(savedScroll, 10);
    // 본문 렌더 + 이미지 로드까지 기다렸다가 스크롤
    window.addEventListener('load', () => {
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    }, { once: true });
  }

  // ---- 원문 .md 파일 변경 감지 (폴링) → 자동 새로고침 ----
  (function setupLiveReload() {
    const POLL_MS = 2000;
    // 크기 + 앞/뒤 100자로 변경 여부 빠르게 확인
    const snap = (s) => s.length + '|' + s.slice(0, 100) + '|' + s.slice(-100);
    let lastSig = snap(rawSrc);

    async function check() {
      if (document.hidden) return;
      try {
        const resp = await fetch(location.href, { cache: 'no-store' });
        if (!resp.ok) return;
        const text = await resp.text();
        const sig = snap(text);
        if (sig !== lastSig) {
          lastSig = sig;
          sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
          location.reload();
        }
      } catch {}
    }

    setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    window.addEventListener('focus', check);
  })();

  function preprocessFootnotes(md) {
    const defs = new Map();
    md = md.replace(/^\[\^([^\]]+)\]:[ \t]*((?:.+(?:\n(?:[ \t]+.+|(?=\n)))*)?)/gm, (_, id, body) => {
      defs.set(id, body.trim().replace(/\n[ \t]+/g, ' '));
      return '';
    });
    const order = new Map();
    let counter = 0;
    md = md.replace(/\[\^([^\]]+)\]/g, (m, id) => {
      if (!defs.has(id)) return m;
      if (!order.has(id)) order.set(id, ++counter);
      const n = order.get(id);
      return `<sup class="mv-fnref" id="fnref-${id}"><a href="#fn-${id}">${n}</a></sup>`;
    });
    if (order.size) {
      let section = '\n\n<section class="mv-footnotes"><h2>Notes</h2><ol>';
      for (const [id] of order) {
        section += `<li id="fn-${id}"><p>${defs.get(id) || ''} <a href="#fnref-${id}" class="mv-fnback" title="본문으로">↩</a></p></li>`;
      }
      section += '</ol></section>';
      md += section;
    }
    return md;
  }

  marked.use({ gfm: true, breaks: false });

  const titleMatch = rawSrc.match(/^#\s+(.+)$/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : (location.pathname.split('/').pop() || 'Markview');
  document.title = docTitle;
  document.documentElement.lang = 'ko';

  const processed = preprocessFootnotes(rawSrc);
  const html = marked.parse(processed);

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^\w\s\u3131-\uD79D-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
  }

  document.body.innerHTML = `
    <button class="mv-toc-reveal" data-action="toggle-toc" title="목차 열기 (T)" aria-label="목차 열기">»</button>
    <aside class="mv-toc-panel" aria-label="목차">
      <div class="mv-toc-brand" aria-label="MARKO">
        <span class="mv-toc-brand-marks" aria-hidden="true">
          <span class="mv-toc-brand-mark mark-a"></span>
          <span class="mv-toc-brand-mark mark-b"></span>
          <span class="mv-toc-brand-mark mark-c"></span>
        </span>
        <span class="mv-toc-brand-name">MARKO</span>
      </div>
      <button class="mv-toc-collapse" data-action="toggle-toc" title="목차 접기 (T)" aria-label="목차 접기">«</button>
      <nav class="mv-toc"></nav>
    </aside>
    <main class="mv-split">
      <div class="mv-text-col">
        <article class="mv-article"></article>
      </div>
      <div class="mv-figure-col" aria-label="그림 패널">
        <div class="mv-figure-stack"></div>
      </div>
    </main>
    <div class="mv-controls">
      <button class="mv-btn" data-action="toggle-toc" title="목차 토글 (T)" aria-label="목차 토글">☰</button>
      <button class="mv-btn" data-action="toggle-figures" title="그림 패널 토글 (F)" aria-label="그림 패널 토글">▦</button>
      <button class="mv-btn" data-action="toggle-dark" title="다크모드 토글 (D)" aria-label="다크모드 토글">◐</button>
      <button class="mv-btn" data-action="clear-all-hl" title="모든 하이라이트 지우기" aria-label="모든 하이라이트 지우기">⌫</button>
      <button class="mv-btn" data-action="toggle-drawer" title="설정" aria-label="설정">⚙</button>
    </div>
    <aside class="mv-drawer" aria-label="설정" aria-hidden="true">
      <div class="mv-drawer-head">
        <h2 class="mv-drawer-title">설정</h2>
        <button class="mv-drawer-close" data-action="toggle-drawer" aria-label="닫기">✕</button>
      </div>
      <div class="mv-drawer-body">
        <section class="mv-drawer-sec">
          <h3>제목 (H1 · H2)</h3>
          <div class="mv-drawer-row"><label>한글</label><select data-pref="titleFontKo" data-lang="ko"></select></div>
          <div class="mv-drawer-row"><label>영문</label><select data-pref="titleFontEn" data-lang="en"></select></div>
          <div class="mv-drawer-row"><label>H1 크기 <span data-val="titleSize">32</span>px</label>
            <input type="range" data-pref="titleSize" min="22" max="44" step="1" value="32"></div>
        </section>
        <section class="mv-drawer-sec">
          <h3>본문</h3>
          <div class="mv-drawer-row"><label>한글</label><select data-pref="bodyFontKo" data-lang="ko"></select></div>
          <div class="mv-drawer-row"><label>영문</label><select data-pref="bodyFontEn" data-lang="en"></select></div>
          <div class="mv-drawer-row"><label>크기 <span data-val="bodySize">17</span>px</label>
            <input type="range" data-pref="bodySize" min="13" max="22" step="0.5" value="17"></div>
        </section>
        <section class="mv-drawer-sec">
          <h3>레이아웃</h3>
          <div class="mv-drawer-row"><label>줄간격 <span data-val="lineHeight">1.75</span></label>
            <input type="range" data-pref="lineHeight" min="1.4" max="2.0" step="0.05" value="1.75"></div>
          <div class="mv-drawer-row"><label>최대폭 <span data-val="maxWidth">760</span>px</label>
            <input type="range" data-pref="maxWidth" min="500" max="1600" step="10" value="760"></div>
        </section>
        <section class="mv-drawer-sec">
          <h3>테마</h3>
          <div class="mv-drawer-row mv-drawer-check"><input type="checkbox" id="mv-dark" data-pref="darkMode"><label for="mv-dark">다크모드</label></div>
        </section>
      </div>
      <div class="mv-drawer-foot">
        <button class="mv-drawer-btn ghost" data-action="reset-file">이 파일 설정 초기화</button>
        <button class="mv-drawer-btn" data-action="apply-default">현재 설정을 기본값으로 저장…</button>
        <div class="mv-drawer-status" id="mv-drawer-status"></div>
      </div>
    </aside>
    <div class="mv-drawer-overlay" data-action="toggle-drawer" aria-hidden="true"></div>
    <div id="mv-memo-editor" class="mv-memo-editor" aria-hidden="true">
      <div class="mv-memo-editor-quote"></div>
      <textarea class="mv-memo-editor-text" placeholder="메모를 입력하세요..."></textarea>
      <div class="mv-memo-editor-actions">
        <span class="mv-memo-editor-hint">Ctrl + Enter 저장</span>
        <button data-action="cancel-memo">취소</button>
        <button data-action="save-memo" class="primary">저장</button>
      </div>
    </div>
    <div id="mv-palette" role="toolbar" aria-label="형광펜·글자색">
      <button data-hl="y" title="노랑 형광펜"></button>
      <button data-hl="g" title="연두 형광펜"></button>
      <button data-hl="b" title="하늘 형광펜"></button>
      <button data-hl="p" title="분홍 형광펜"></button>
      <button data-hl="r" title="빨강 형광펜"></button>
      <span class="mv-pal-sep"></span>
      <button data-hl="fy" title="찐 형광 노랑"></button>
      <button data-hl="fg" title="찐 형광 초록"></button>
      <button data-hl="fp" title="찐 형광 분홍"></button>
      <span class="mv-pal-sep"></span>
      <button data-co="r" title="빨간 글자">A</button>
      <button data-co="b" title="파란 글자">A</button>
      <button data-co="g" title="녹색 글자">A</button>
      <span class="mv-pal-sep"></span>
      <button data-action="clear-hl" title="하이라이트 제거">✕</button>
      <span class="mv-pal-sep"></span>
      <button data-action="add-anchor-memo" title="선택 텍스트에 메모 앵커">메모</button>
    </div>
  `;

  const article = document.querySelector('.mv-article');
  article.innerHTML = html;

  if (typeof renderMathInElement === 'function') {
    try {
      renderMathInElement(article, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoredClasses: ['mv-fnref']
      });
    } catch (e) {
      console.warn('[Markview] KaTeX render error:', e);
    }
  }

  const tocEl = document.querySelector('.mv-toc');
  const headings = article.querySelectorAll('h1, h2, h3');
  const usedIds = new Set();
  headings.forEach((h, i) => {
    let id = h.id || slugify(h.textContent);
    if (!id || usedIds.has(id)) id = 'mv-h-' + i;
    h.id = id;
    usedIds.add(id);
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.className = 'mv-toc-' + h.tagName.toLowerCase();
    a.addEventListener('click', () => {
      // 좁은 화면에서만 자동 닫기 (노션 스타일: 넓은 화면에선 열린 채로 유지)
      if (window.matchMedia('(max-width: 1100px)').matches) {
        document.body.classList.add('mv-toc-hidden');
        chrome.storage?.sync.set({ tocHidden: true });
      }
    });
    tocEl.appendChild(a);
  });

  // ---- Build fig-groups (one per heading section, always) ----
  const stack = document.querySelector('.mv-figure-stack');
  const emptyNote = { classList: { add(){}, remove(){}, toggle(){} } };  // no-op (UI element removed)

  // Create empty groups for every heading section
  headings.forEach(h => {
    if (!h.id) return;
    const group = document.createElement('div');
    group.className = 'mv-fig-group';
    group.dataset.section = h.id;
    group.innerHTML = `<div class="mv-fig-figures"></div><div class="mv-fig-memos"></div>`;
    stack.appendChild(group);
  });

  // Walk article; move images into their section's figures container
  {
    let curSec = null;
    for (const node of Array.from(article.children)) {
      if (/^H[1-3]$/.test(node.tagName)) { curSec = node.id; continue; }
      const imgs = node.tagName === 'IMG'
        ? [node]
        : Array.from(node.querySelectorAll?.('img') || []);
      if (!curSec || !imgs.length) continue;
      const container = stack.querySelector(`.mv-fig-group[data-section="${CSS.escape(curSec)}"] .mv-fig-figures`);
      if (!container) continue;
      for (const img of imgs) {
        const fig = document.createElement('figure');
        const moved = img.cloneNode(true);
        moved.loading = 'lazy';
        fig.appendChild(moved);
        const alt = (img.alt || '').trim();
        if (alt) {
          const cap = document.createElement('figcaption');
          cap.textContent = alt;
          fig.appendChild(cap);
        }
        container.appendChild(fig);
        const p = img.parentElement;
        img.remove();
        if (p && p.tagName === 'P' && !p.textContent.trim() && !p.querySelector('img')) {
          p.remove();
        }
      }
    }
  }

  // First group active initially
  const firstGroup = stack.querySelector('.mv-fig-group');
  if (firstGroup) firstGroup.classList.add('active');

  function isGroupEmpty(group) {
    return !group.querySelector('.mv-fig-figures figure, .mv-fig-memos .mv-fig-memo');
  }

  function activateFigureSection(sectionId) {
    const group = stack.querySelector(`.mv-fig-group[data-section="${CSS.escape(sectionId)}"]`);
    if (!group) { emptyNote.classList.add('show'); return; }
    stack.querySelectorAll('.mv-fig-group').forEach(g => g.classList.remove('active'));
    group.classList.add('active');
    emptyNote.classList.toggle('show', isGroupEmpty(group));
  }

  if (headings.length) {
    currentSectionId = headings[0].id;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          tocEl.querySelectorAll('a').forEach(a => a.classList.remove('active'));
          const active = tocEl.querySelector(`a[href="#${CSS.escape(e.target.id)}"]`);
          if (active) active.classList.add('active');
          activateFigureSection(e.target.id);
          setCurrentSection(e.target.id);
        }
      });
    }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 });
    headings.forEach(h => obs.observe(h));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'toggle-toc') {
      const v = document.body.classList.toggle('mv-toc-hidden');
      saveFilePrefSingle('tocHidden', v);
    }
    if (a === 'toggle-figures') {
      const v = document.body.classList.toggle('mv-figures-hidden');
      saveFilePrefSingle('figuresHidden', v);
    }
    if (a === 'toggle-dark') {
      const v = document.body.classList.toggle('mv-dark');
      saveFilePrefSingle('darkMode', v);
    }
    if (a === 'clear-all-hl') {
      if (confirm('이 파일의 모든 하이라이트를 지울까요?')) {
        article.querySelectorAll('.mv-hl, .mv-co').forEach(unwrapEl);
        try { chrome.storage.local.remove(HL_KEY); } catch {}
      }
    }
    if (a === 'toggle-drawer') {
      toggleDrawer();
    }
    if (a === 'apply-default') {
      saveScope('default');
    }
    if (a === 'reset-file') {
      resetFile();
    }
  });

  // ===== Highlight & text color feature =====
  const HL_KEY = 'hl-' + location.pathname;
  const palette = document.getElementById('mv-palette');
  let lastRange = null;

  function hidePalette() { palette.classList.remove('show'); }
  function showPaletteAt(rect) {
    palette.classList.add('show');
    const pw = palette.offsetWidth, ph = palette.offsetHeight;
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
    let top = rect.top - ph - 10;
    if (top < 10) top = rect.bottom + 10;
    palette.style.left = left + 'px';
    palette.style.top = top + 'px';
  }

  article.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        hidePalette();
        lastRange = null;
        return;
      }
      const range = sel.getRangeAt(0);
      const anc = range.commonAncestorContainer;
      if (!article.contains(anc) && anc !== article) {
        hidePalette();
        return;
      }
      lastRange = range.cloneRange();
      showPaletteAt(range.getBoundingClientRect());
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#mv-palette') && !e.target.closest('.mv-article')) {
      hidePalette();
    }
  });
  window.addEventListener('scroll', hidePalette, true);
  window.addEventListener('resize', hidePalette);

  function wrapRange(range, className) {
    const span = document.createElement('span');
    span.className = className;
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    return span;
  }

  function unwrapEl(el) {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  }

  palette.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !lastRange) return;
    const hl = btn.dataset.hl, co = btn.dataset.co, act = btn.dataset.action;
    if (act === 'clear-hl') {
      let n = lastRange.commonAncestorContainer;
      if (n.nodeType === 3) n = n.parentElement;
      const mk = n.closest('.mv-hl, .mv-co');
      if (mk) unwrapEl(mk);
      saveHighlights();
    } else if (act === 'add-anchor-memo') {
      showEditor(lastRange);
    } else if (hl) {
      wrapRange(lastRange, 'mv-hl mv-hl-' + hl);
      saveHighlights();
    } else if (co) {
      wrapRange(lastRange, 'mv-co mv-co-' + co);
      saveHighlights();
    }
    window.getSelection().removeAllRanges();
    hidePalette();
    lastRange = null;
  });

  function saveHighlights() {
    const marks = Array.from(article.querySelectorAll('.mv-hl, .mv-co'));
    const data = marks.map(m => ({
      text: m.textContent,
      classes: m.className
    }));
    try { chrome.storage.local.set({ [HL_KEY]: data }); } catch {}
  }

  function wrapFirstOccurrence(text, className) {
    if (!text) return;
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.parentElement.closest('.mv-hl, .mv-co')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.nodeValue.indexOf(text);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + text.length);
        try { wrapRange(range, className); } catch {}
        return;
      }
    }
  }

  function restoreHighlights() {
    try {
      chrome.storage.local.get([HL_KEY], (r) => {
        const data = r?.[HL_KEY];
        if (!Array.isArray(data)) return;
        for (const h of data) wrapFirstOccurrence(h.text, h.classes);
      });
    } catch {}
  }
  restoreHighlights();

  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { hidePalette(); return; }
    if (e.key === 't' || e.key === 'T') {
      saveFilePrefSingle('tocHidden', document.body.classList.toggle('mv-toc-hidden'));
    }
    if (e.key === 'f' || e.key === 'F') {
      saveFilePrefSingle('figuresHidden', document.body.classList.toggle('mv-figures-hidden'));
    }
    if (e.key === 'd' || e.key === 'D') {
      saveFilePrefSingle('darkMode', document.body.classList.toggle('mv-dark'));
    }
  });

  const BASE_STACK = "'Paperlogy', 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  function buildFontStack(en, ko) {
    const strip = (f) => f ? f.replace(/,\s*(sans-serif|serif|monospace|system-ui).*$/i, '') : '';
    return [strip(en), strip(ko), BASE_STACK].filter(Boolean).join(', ');
  }
  const applyPrefs = (p) => {
    document.body.classList.toggle('mv-dark', !!p.darkMode);
    document.body.classList.toggle('mv-toc-hidden', !!p.tocHidden);
    document.body.classList.toggle('mv-figures-hidden', !!p.figuresHidden);
    const root = document.documentElement.style;
    // 크기
    const bodySize = p.bodySize ?? p.fontSize;
    if (bodySize) root.setProperty('--mv-font-size', bodySize + 'px');
    if (p.titleSize) root.setProperty('--mv-title-size', p.titleSize + 'px');
    if (p.maxWidth)  root.setProperty('--mv-max-width', p.maxWidth + 'px');
    if (p.lineHeight) root.setProperty('--mv-line-height', p.lineHeight);
    // 폰트 — 한·영 별도 지정이 있으면 조합, 아니면 legacy fontFamily 사용
    if (p.bodyFontEn !== undefined || p.bodyFontKo !== undefined) {
      const stack = buildFontStack(p.bodyFontEn, p.bodyFontKo);
      root.setProperty('--mv-body-font', stack);
      root.setProperty('--mv-sans', stack);
    } else if (p.fontFamily) {
      root.setProperty('--mv-body-font', p.fontFamily);
      root.setProperty('--mv-sans', p.fontFamily);
    }
    if (p.titleFontEn !== undefined || p.titleFontKo !== undefined) {
      root.setProperty('--mv-title-font', buildFontStack(p.titleFontEn, p.titleFontKo));
    }
  };

  // ===== Memo feature (anchor-only, inline editor → fig-group) =====
  const MEMO_KEY = 'memo:' + location.pathname;
  let memos = [];              // [{ id, text, sectionId, anchor:{quote, sectionId} }]
  let memoSaveTimer = null;

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function saveMemos() {
    clearTimeout(memoSaveTimer);
    memoSaveTimer = setTimeout(() => {
      try { chrome.storage.local.set({ [MEMO_KEY]: memos }); } catch {}
    }, 300);
  }

  function sectionIdOfNode(node) {
    const hs = Array.from(article.querySelectorAll('h1, h2, h3'));
    let last = null;
    for (const h of hs) {
      const cmp = h.compareDocumentPosition(node);
      if (cmp & Node.DOCUMENT_POSITION_FOLLOWING) last = h; else break;
    }
    return last ? last.id : null;
  }

  function wrapRangeAsAnchor(range, memoId) {
    const span = document.createElement('span');
    span.className = 'mv-anchor';
    span.dataset.memoId = memoId;
    try { range.surroundContents(span); }
    catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
    return span;
  }

  function getSectionNodes(sectionId) {
    if (!sectionId) return [article];
    const heading = article.querySelector('#' + CSS.escape(sectionId));
    if (!heading) return [article];
    const level = parseInt(heading.tagName[1]);
    const nodes = [];
    let n = heading.nextElementSibling;
    while (n) {
      if (/^H[1-6]$/.test(n.tagName) && parseInt(n.tagName[1]) <= level) break;
      nodes.push(n);
      n = n.nextElementSibling;
    }
    return nodes.length ? nodes : [article];
  }

  function findAndWrapAnchor(memo) {
    if (!memo.anchor?.quote) return false;
    const quote = memo.anchor.quote;
    const roots = getSectionNodes(memo.anchor.sectionId);
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          return n.parentElement?.closest('.mv-anchor, .mv-hl, .mv-co')
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.nodeValue.indexOf(quote);
        if (idx !== -1) {
          const r = document.createRange();
          r.setStart(node, idx);
          r.setEnd(node, idx + quote.length);
          wrapRangeAsAnchor(r, memo.id);
          return true;
        }
      }
    }
    return false;
  }

  function numberAnchors() {
    const spans = article.querySelectorAll('.mv-anchor');
    spans.forEach((sp, i) => {
      sp.dataset.num = i + 1;
      const id = sp.dataset.memoId;
      const m = memos.find(mm => mm.id === id);
      if (m) m.num = i + 1;
    });
  }

  function removeAnchor(memoId) {
    const sp = article.querySelector(`.mv-anchor[data-memo-id="${memoId}"]`);
    if (sp) unwrapEl(sp);
  }

  function flashHighlight(el) {
    if (!el) return;
    el.classList.add('mv-flash');
    setTimeout(() => el.classList.remove('mv-flash'), 1200);
  }

  // ---- Render memo cards in fig-group ----
  function memoCardHTML(m) {
    const q = m.anchor?.quote || '';
    const short = q.length > 100 ? q.slice(0, 100) + '…' : q;
    return `
      <div class="mv-fig-memo" data-id="${m.id}">
        <div class="mv-fig-memo-quote" data-action="goto-anchor" title="본문 위치로 이동">
          <span class="mv-fig-memo-num">${m.num ?? ''}</span>
          <span class="mv-fig-memo-quote-text">"${escapeHTML(short)}"</span>
        </div>
        <textarea class="mv-fig-memo-text" rows="2" placeholder="메모...">${escapeHTML(m.text || '')}</textarea>
        <div class="mv-fig-memo-actions">
          <button class="mv-fig-memo-btn" data-action="copy-memo" title="클립보드 복사">복사</button>
          <button class="mv-fig-memo-btn mv-fig-memo-del" data-action="del-memo" title="삭제">✕</button>
        </div>
      </div>
    `;
  }

  function renderSectionMemos(sectionId) {
    if (!sectionId) return;
    const container = stack.querySelector(`.mv-fig-group[data-section="${CSS.escape(sectionId)}"] .mv-fig-memos`);
    if (!container) return;
    const list = memos.filter(m => m.sectionId === sectionId);
    container.innerHTML = list.map(memoCardHTML).join('');
    container.querySelectorAll('.mv-fig-memo-text').forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }

  function renderAllMemos() {
    const sectionIds = new Set(memos.map(m => m.sectionId).filter(Boolean));
    sectionIds.forEach(renderSectionMemos);
  }

  // ---- Inline editor (popup near selection) ----
  const editor = document.getElementById('mv-memo-editor');
  const editorText = editor.querySelector('.mv-memo-editor-text');
  const editorQuote = editor.querySelector('.mv-memo-editor-quote');
  let editorRange = null;

  function positionEditor(rect) {
    const ew = editor.offsetWidth, eh = editor.offsetHeight;
    let left = rect.left + rect.width / 2 - ew / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - ew - 12));
    let top = rect.bottom + 10;
    if (top + eh > window.innerHeight - 12) top = rect.top - eh - 10;
    if (top < 12) top = 12;
    editor.style.left = left + 'px';
    editor.style.top = top + 'px';
  }

  function showEditor(range) {
    editorRange = range.cloneRange();
    const quote = range.toString().trim();
    editorQuote.textContent = `"${quote.length > 120 ? quote.slice(0, 120) + '…' : quote}"`;
    editorText.value = '';
    editor.classList.add('show');
    editor.setAttribute('aria-hidden', 'false');
    positionEditor(range.getBoundingClientRect());
    editorText.focus();
  }

  function hideEditor() {
    editor.classList.remove('show');
    editor.setAttribute('aria-hidden', 'true');
    editorRange = null;
  }

  function commitEditor() {
    if (!editorRange) return;
    const text = editorText.value.trim();
    const quote = editorRange.toString().trim();
    if (!quote) { hideEditor(); return; }
    const sectionId = sectionIdOfNode(editorRange.startContainer);
    const id = 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    wrapRangeAsAnchor(editorRange, id);
    memos.push({ id, text, sectionId, anchor: { quote, sectionId } });
    numberAnchors();
    renderSectionMemos(sectionId);
    // 메모가 달린 섹션의 fig-group을 바로 활성화 (현재 스크롤 섹션과 달라도 즉시 보이게)
    activateFigureSection(sectionId);
    saveMemos();
    hideEditor();
  }

  editor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'save-memo') commitEditor();
    else if (btn.dataset.action === 'cancel-memo') hideEditor();
  });

  editorText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitEditor();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideEditor();
    }
  });

  window.addEventListener('scroll', () => {
    if (editor.classList.contains('show') && editorRange) {
      // Reposition on scroll
      positionEditor(editorRange.getBoundingClientRect());
    }
  }, true);

  // ---- Fig-memo card interactions (edit, copy, delete) ----
  stack.addEventListener('input', (e) => {
    const ta = e.target;
    if (!ta.classList.contains('mv-fig-memo-text')) return;
    const id = ta.closest('.mv-fig-memo').dataset.id;
    const m = memos.find(mm => mm.id === id);
    if (m) { m.text = ta.value; saveMemos(); }
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });

  stack.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const memoEl = btn.closest('.mv-fig-memo');
    if (!memoEl) return;
    const id = memoEl.dataset.id;
    const m = memos.find(mm => mm.id === id);
    const a = btn.dataset.action;

    if (a === 'goto-anchor') {
      const anchor = article.querySelector(`.mv-anchor[data-memo-id="${id}"]`);
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashHighlight(anchor);
      }
    }

    if (a === 'copy-memo' && m) {
      navigator.clipboard.writeText(m.text || '').then(() => {
        btn.textContent = '복사됨';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('copied'); }, 1200);
      }).catch(err => console.warn('[Markview] clipboard:', err));
    }

    if (a === 'del-memo') {
      if (m && (!m.text || m.text.length === 0 || confirm('이 메모를 삭제할까요?'))) {
        if (m.anchor) removeAnchor(id);
        memos = memos.filter(x => x.id !== id);
        numberAnchors();
        renderSectionMemos(m.sectionId);
        const active = stack.querySelector('.mv-fig-group.active');
        if (active) emptyNote.classList.toggle('show', isGroupEmpty(active));
        saveMemos();
      }
    }
  });

  // ---- Click anchor in body → scroll memo card into view ----
  article.addEventListener('click', (e) => {
    const anchor = e.target.closest('.mv-anchor');
    if (!anchor) return;
    const id = anchor.dataset.memoId;
    const m = memos.find(mm => mm.id === id);
    if (!m) return;
    activateFigureSection(m.sectionId);
    setTimeout(() => {
      const memoEl = stack.querySelector(`.mv-fig-memo[data-id="${id}"]`);
      if (memoEl) {
        memoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashHighlight(memoEl);
      }
    }, 120);
  });

  // ---- Load memos on startup ----
  (function loadMemos() {
    try {
      chrome.storage.local.get([MEMO_KEY], (r) => {
        const raw = Array.isArray(r?.[MEMO_KEY]) ? r[MEMO_KEY] : [];
        memos = raw.filter(m => m.anchor && m.anchor.quote);
        memos.forEach(findAndWrapAnchor);
        numberAnchors();
        renderAllMemos();

        // 초기 진입 시: 사용자가 아직 스크롤 안 했으면, 현재 active가 비어 있을 때
        // 문서 내 첫 번째 "내용 있는" 섹션을 보여줌 (첫 그림/메모)
        if (window.scrollY < 50) {
          const active = stack.querySelector('.mv-fig-group.active');
          if (!active || isGroupEmpty(active)) {
            const firstNonEmpty = Array.from(stack.querySelectorAll('.mv-fig-group'))
              .find(g => !isGroupEmpty(g));
            if (firstNonEmpty) {
              stack.querySelectorAll('.mv-fig-group').forEach(g => g.classList.remove('active'));
              firstNonEmpty.classList.add('active');
            }
          }
        }
        const cur = stack.querySelector('.mv-fig-group.active');
        emptyNote.classList.toggle('show', !cur || isGroupEmpty(cur));
      });
    } catch {}
  })();

  // Trivial noop — legacy setCurrentSection still called from observer
  function setCurrentSection(id) { currentSectionId = id; }

  // ===== Per-file + global settings =====
  const PREF_KEYS = [
    'darkMode', 'tocHidden', 'figuresHidden',
    'bodySize', 'titleSize', 'maxWidth', 'lineHeight',
    'bodyFontKo', 'bodyFontEn', 'titleFontKo', 'titleFontEn',
    'fontSize', 'fontFamily'  // legacy
  ];

  let effectivePrefs = {};

  function mergePrefs() {
    effectivePrefs = { ...globalPrefs, ...filePrefs };
    return effectivePrefs;
  }

  function loadPrefs(cb) {
    try {
      chrome.storage.local.get([FILE_PREF_KEY], (local) => {
        chrome.storage.sync.get(PREF_KEYS, (global) => {
          globalPrefs = global || {};
          filePrefs = (local && local[FILE_PREF_KEY]) || {};
          applyPrefs(mergePrefs());
          cb?.();
        });
      });
    } catch {
      cb?.();
    }
  }

  // ===== Drawer =====
  const FONTS_KO = [
    { v: '', label: 'Paperlogy (기본)' },
    { v: "'Pretendard Variable', Pretendard, sans-serif", label: 'Pretendard Variable' },
    { v: "'Noto Sans KR', sans-serif", label: 'Noto Sans KR' },
    { v: "'맑은 고딕', 'Malgun Gothic', sans-serif", label: '맑은 고딕' },
    { v: "'Apple SD Gothic Neo', sans-serif", label: 'Apple SD Gothic Neo' },
    { v: "'나눔고딕', 'NanumGothic', sans-serif", label: '나눔고딕' },
    { v: 'serif', label: '세리프 시스템' }
  ];
  const FONTS_EN = [
    { v: '', label: 'Paperlogy (기본)' },
    { v: "Inter, sans-serif", label: 'Inter' },
    { v: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
    { v: "'Times New Roman', Times, serif", label: 'Times New Roman' },
    { v: "Helvetica, Arial, sans-serif", label: 'Helvetica / Arial' },
    { v: "'Segoe UI', system-ui, sans-serif", label: 'Segoe UI' },
    { v: "'SF Pro Text', -apple-system, sans-serif", label: 'SF Pro' },
    { v: "'JetBrains Mono', Consolas, monospace", label: 'JetBrains Mono' }
  ];

  const drawer = document.querySelector('.mv-drawer');
  const overlay = document.querySelector('.mv-drawer-overlay');
  const status = document.getElementById('mv-drawer-status');

  // Populate font selects
  drawer.querySelectorAll('select[data-lang]').forEach(sel => {
    const list = sel.dataset.lang === 'ko' ? FONTS_KO : FONTS_EN;
    sel.innerHTML = list.map(o =>
      `<option value="${o.v.replace(/"/g, '&quot;')}">${o.label}</option>`
    ).join('');
  });

  function populateDrawer() {
    const p = { ...mergePrefs() };
    const d = {
      titleFontKo: '', titleFontEn: '', titleSize: 32,
      bodyFontKo: '', bodyFontEn: '', bodySize: p.fontSize ?? 17,
      lineHeight: 1.75, maxWidth: 760, darkMode: false
    };
    const v = { ...d, ...p };
    drawer.querySelectorAll('[data-pref]').forEach(el => {
      const k = el.dataset.pref;
      if (el.type === 'checkbox') el.checked = !!v[k];
      else el.value = v[k] ?? '';
    });
    drawer.querySelectorAll('[data-val]').forEach(el => {
      const k = el.dataset.val;
      el.textContent = k === 'lineHeight' ? Number(v[k]).toFixed(2) : v[k];
    });
    setStatus('');
  }

  function readDrawer() {
    const out = {};
    drawer.querySelectorAll('[data-pref]').forEach(el => {
      const k = el.dataset.pref;
      if (el.type === 'checkbox') out[k] = el.checked;
      else if (el.type === 'range') out[k] = parseFloat(el.value);
      else out[k] = el.value;
    });
    return out;
  }

  function setStatus(msg) {
    if (!status) return;
    status.textContent = msg || '';
    status.classList.toggle('show', !!msg);
  }

  function toggleDrawer() {
    const open = document.body.classList.toggle('mv-drawer-open');
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) populateDrawer();
  }

  // 컨트롤 조정 시 곧바로 이 파일에 저장 (별도 적용 버튼 없음)
  drawer.addEventListener('input', (e) => {
    if (!e.target.matches('[data-pref]')) return;
    const key = e.target.dataset.pref;
    let val;
    if (e.target.type === 'checkbox') val = e.target.checked;
    else if (e.target.type === 'range') val = parseFloat(e.target.value);
    else val = e.target.value;
    filePrefs[key] = val;
    try { chrome.storage.local.set({ [FILE_PREF_KEY]: filePrefs }); } catch {}
    applyPrefs(mergePrefs());
    const valEl = drawer.querySelector(`[data-val="${key}"]`);
    if (valEl) valEl.textContent = key === 'lineHeight' ? Number(val).toFixed(2) : val;
  });

  overlay.addEventListener('click', () => toggleDrawer());

  function saveScope(scope) {
    if (scope !== 'default') return;
    const p = readDrawer();
    const ok = confirm(
      '현재 설정을 모든 마크다운 파일의 기본값으로 저장할까요?\n\n' +
      '· 이 파일의 개별 설정은 그대로 유지됩니다.\n' +
      '· 다른 파일(개별 설정 없는 것)은 이 값들을 기본값으로 사용합니다.'
    );
    if (!ok) return;
    try {
      chrome.storage.sync.set(p, () => {
        globalPrefs = { ...globalPrefs, ...p };
        applyPrefs(mergePrefs());
        setStatus('✓ 기본값으로 저장됨');
      });
    } catch (e) {
      setStatus('저장 실패: ' + e.message);
    }
  }

  function resetFile() {
    try {
      chrome.storage.local.remove(FILE_PREF_KEY, () => {
        filePrefs = {};
        applyPrefs(mergePrefs());
        populateDrawer();
        setStatus('✓ 이 파일 설정 제거됨 (기본값 적용)');
      });
    } catch {}
  }

  // Storage change listener (cross-tab sync)
  try {
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area === 'sync') {
        for (const k in changes) globalPrefs[k] = changes[k].newValue;
      } else if (area === 'local' && changes[FILE_PREF_KEY]) {
        filePrefs = changes[FILE_PREF_KEY].newValue || {};
      } else return;
      if (!document.body.classList.contains('mv-drawer-open')) {
        applyPrefs(mergePrefs());
      }
    });
  } catch {}

  // Initial load
  loadPrefs(() => document.body.classList.add('mv-ready'));
})();
