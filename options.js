const FONTS_KO = [
  { v: '', label: 'Paperlogy (기본)' },
  { v: "'Pretendard Variable', Pretendard, sans-serif", label: 'Pretendard Variable' },
  { v: "'Noto Sans KR', sans-serif", label: 'Noto Sans KR' },
  { v: "'맑은 고딕', 'Malgun Gothic', sans-serif", label: '맑은 고딕' },
  { v: "'Apple SD Gothic Neo', sans-serif", label: 'Apple SD Gothic Neo (Mac)' },
  { v: "'나눔고딕', 'NanumGothic', sans-serif", label: '나눔고딕' },
  { v: 'serif', label: '세리프 시스템' }
];

const FONTS_EN = [
  { v: '', label: 'Paperlogy (기본, Latin 포함)' },
  { v: "Inter, sans-serif", label: 'Inter' },
  { v: "Georgia, 'Times New Roman', serif", label: 'Georgia (세리프)' },
  { v: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { v: "Helvetica, Arial, sans-serif", label: 'Helvetica / Arial' },
  { v: "'Segoe UI', system-ui, sans-serif", label: 'Segoe UI (Windows)' },
  { v: "'SF Pro Text', -apple-system, sans-serif", label: 'SF Pro (Mac)' },
  { v: "'JetBrains Mono', Consolas, monospace", label: 'JetBrains Mono (코드)' }
];

const DEFAULTS = {
  bodySize: 17,
  titleSize: 32,
  lineHeight: 1.75,
  maxWidth: 760,
  bodyFontKo: '',
  bodyFontEn: '',
  titleFontKo: '',
  titleFontEn: '',
  darkMode: false,
  tocHidden: false,
  figuresHidden: false
};

// Populate select options
function fillSelect(id, opts) {
  const el = document.getElementById(id);
  el.innerHTML = opts.map(o => `<option value="${o.v.replace(/"/g, '&quot;')}">${o.label}</option>`).join('');
}
fillSelect('titleFontKo', FONTS_KO);
fillSelect('titleFontEn', FONTS_EN);
fillSelect('bodyFontKo', FONTS_KO);
fillSelect('bodyFontEn', FONTS_EN);

const ids = Object.keys(DEFAULTS);
const els = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const vals = {
  bodySize: document.getElementById('bodySizeVal'),
  titleSize: document.getElementById('titleSizeVal'),
  lineHeight: document.getElementById('lineHeightVal'),
  maxWidth: document.getElementById('maxWidthVal')
};
const savedBadge = document.getElementById('saved');
let savedTimer = null;

function showSaved() {
  savedBadge.classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => savedBadge.classList.remove('show'), 1200);
}

function readForm() {
  return {
    bodySize: parseFloat(els.bodySize.value),
    titleSize: parseInt(els.titleSize.value, 10),
    lineHeight: parseFloat(els.lineHeight.value),
    maxWidth: parseInt(els.maxWidth.value, 10),
    bodyFontKo: els.bodyFontKo.value,
    bodyFontEn: els.bodyFontEn.value,
    titleFontKo: els.titleFontKo.value,
    titleFontEn: els.titleFontEn.value,
    darkMode: els.darkMode.checked,
    tocHidden: els.tocHidden.checked,
    figuresHidden: els.figuresHidden.checked
  };
}

function writeForm(p) {
  els.bodySize.value = p.bodySize;
  els.titleSize.value = p.titleSize;
  els.lineHeight.value = p.lineHeight;
  els.maxWidth.value = p.maxWidth;
  els.bodyFontKo.value = p.bodyFontKo ?? '';
  els.bodyFontEn.value = p.bodyFontEn ?? '';
  els.titleFontKo.value = p.titleFontKo ?? '';
  els.titleFontEn.value = p.titleFontEn ?? '';
  els.darkMode.checked = !!p.darkMode;
  els.tocHidden.checked = !!p.tocHidden;
  els.figuresHidden.checked = !!p.figuresHidden;
  vals.bodySize.textContent = p.bodySize;
  vals.titleSize.textContent = p.titleSize;
  vals.lineHeight.textContent = Number(p.lineHeight).toFixed(2);
  vals.maxWidth.textContent = p.maxWidth;
}

// Combine English + Korean fonts into a font stack (English first so Latin uses EN, Korean falls back)
function buildFontStack(en, ko) {
  const base = "'Paperlogy', 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  const parts = [];
  if (en) parts.push(en.replace(/,\s*(sans-serif|serif|monospace|system-ui).*$/i, ''));
  if (ko) parts.push(ko.replace(/,\s*(sans-serif|serif|monospace|system-ui).*$/i, ''));
  parts.push(base);
  return parts.filter(Boolean).join(', ');
}

function applyPreview(p) {
  const root = document.documentElement.style;
  root.setProperty('--mv-font-size', p.bodySize + 'px');
  root.setProperty('--mv-title-size', p.titleSize + 'px');
  root.setProperty('--mv-line-height', p.lineHeight);
  root.setProperty('--mv-max-width', p.maxWidth + 'px');
  root.setProperty('--mv-body-font', buildFontStack(p.bodyFontEn, p.bodyFontKo));
  root.setProperty('--mv-title-font', buildFontStack(p.titleFontEn, p.titleFontKo));
  root.setProperty('--mv-sans', buildFontStack(p.bodyFontEn, p.bodyFontKo)); // backcompat
  document.body.classList.toggle('mv-dark', !!p.darkMode);
}

function save() {
  const p = readForm();
  chrome.storage.sync.set(p, () => {
    applyPreview(p);
    showSaved();
  });
}

chrome.storage.sync.get(ids, (stored) => {
  const p = { ...DEFAULTS, ...stored };
  writeForm(p);
  applyPreview(p);
});

['input', 'change'].forEach(evt => {
  document.querySelector('.opt-page').addEventListener(evt, (e) => {
    if (!e.target.matches('input, select')) return;
    const p = readForm();
    if (vals[e.target.id]) {
      const v = p[e.target.id];
      vals[e.target.id].textContent = (e.target.id === 'lineHeight') ? v.toFixed(2) : v;
    }
    applyPreview(p);
    save();
  });
});

document.getElementById('reset').addEventListener('click', () => {
  writeForm(DEFAULTS);
  applyPreview(DEFAULTS);
  chrome.storage.sync.set(DEFAULTS, showSaved);
});
