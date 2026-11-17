/* Globe menu. Translation is done by Google Translate, so any of its languages works. */
(function () {
'use strict';
const { $, esc, toast } = DD;
const LANGS = [['en', 'English'], ['kn', 'ಕನ್ನಡ · Kannada'], ['hi', 'हिन्दी · Hindi'], ['ta', 'தமிழ் · Tamil'], ['te', 'తెలుగు · Telugu'], ['ml', 'മലയാളം · Malayalam'], ['mr', 'मराठी · Marathi'], ['bn', 'বাংলা · Bengali'], ['gu', 'ગુજરાતી · Gujarati'], ['pa', 'ਪੰਜਾਬੀ · Punjabi'], ['ur', 'اردو · Urdu'], ['ne', 'नेपाली · Nepali'], ['si', 'සිංහල · Sinhala'],
  ['es', 'Español · Spanish'], ['fr', 'Français · French'], ['pt', 'Português · Portuguese'], ['de', 'Deutsch · German'], ['it', 'Italiano · Italian'], ['nl', 'Nederlands · Dutch'], ['pl', 'Polski · Polish'], ['ru', 'Русский · Russian'], ['uk', 'Українська · Ukrainian'], ['el', 'Ελληνικά · Greek'], ['tr', 'Türkçe · Turkish'], ['ro', 'Română · Romanian'], ['sv', 'Svenska · Swedish'],
  ['ar', 'العربية · Arabic'], ['fa', 'فارسی · Persian'], ['he', 'עברית · Hebrew'], ['zh-CN', '简体中文 · Chinese (Simplified)'], ['zh-TW', '繁體中文 · Chinese (Traditional)'], ['ja', '日本語 · Japanese'], ['ko', '한국어 · Korean'], ['vi', 'Tiếng Việt · Vietnamese'], ['th', 'ไทย · Thai'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu · Malay'], ['tl', 'Filipino'], ['km', 'ខ្មែរ · Khmer'], ['my', 'မြန်မာ · Burmese'],
  ['sw', 'Kiswahili · Swahili'], ['am', 'አማርኛ · Amharic'], ['ha', 'Hausa'], ['yo', 'Yorùbá · Yoruba'], ['ig', 'Igbo'], ['zu', 'isiZulu · Zulu'], ['so', 'Soomaali · Somali'], ['af', 'Afrikaans'], ['ht', 'Kreyòl · Haitian Creole'], ['haw', 'ʻŌlelo Hawaiʻi · Hawaiian']];
const btn = $('#globe'), menu = $('#langMenu'), list = $('#langList'), find = $('#langFind');
const current = () => { const m = document.cookie.match(/googtrans=\/[^/]+\/([^;]+)/); return m ? m[1] : 'en'; };
function draw() {
  const q = find.value.trim().toLowerCase(), cur = current();
  const rows = LANGS.filter(l => !q || l[1].toLowerCase().includes(q) || l[0].toLowerCase() === q);
  list.innerHTML = rows.map(l => `<li><button class="notranslate ${l[0] === cur ? 'on' : ''}" data-lang="${l[0]}" translate="no">${esc(l[1])}</button></li>`).join('') ||
    (/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(q) ? `<li><button data-lang="${esc(q)}">Try language code “${esc(q)}”</button></li>` : '<li class="fine">No match. Type a language code like “fi”.</li>');
}
btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; if (!menu.hidden) { draw(); find.focus(); } });
document.addEventListener('click', e => { if (!e.target.closest('#langMenu')) menu.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
find.addEventListener('input', draw);

let loading;
function loadGoogle() {
  if (loading) return loading;
  return loading = new Promise((res, rej) => {
    window.googleTranslateElementInit = () => { try { new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'gt'); res(); } catch (e) { rej(e); } };
    const s = document.createElement('script'); s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'; s.onerror = rej; document.head.appendChild(s);
    setTimeout(() => rej(new Error('timeout')), 8000);
  });
}
function setCookie(code) {
  const host = location.hostname, v = code === 'en' ? 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT' : 'googtrans=/en/' + code;
  document.cookie = v + '; path=/';
  if (host.includes('.')) document.cookie = v + '; path=/; domain=.' + host.split('.').slice(-2).join('.');
}
async function choose(code) {
  menu.hidden = true;
  if (code === current()) return;
  setCookie(code);
  if (code === 'en') return location.reload();
  try {
    await loadGoogle();
    /* the widget builds a hidden <select>; drive it instead of showing Google's own bar */
    for (let i = 0; i < 30; i++) {
      const sel = document.querySelector('.goog-te-combo');
      if (sel && sel.options.length > 1) { sel.value = code; sel.dispatchEvent(new Event('change')); document.documentElement.lang = code; return; }
      await new Promise(r => setTimeout(r, 150));
    }
    location.reload();
  } catch (e) { setCookie('en'); toast('Translation couldn\'t load here. It works on the hosted site when Google Translate is reachable.'); }
}
list.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) choose(b.dataset.lang); });
/* returning visitor who already picked a language */
if (current() !== 'en') loadGoogle().catch(() => {});
})();
