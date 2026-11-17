/* Accounts. Supabase handles Google and email sign-in; each user's data lives in the user_data table.
   If Supabase can't be reached (for example inside a sandboxed preview) accounts fall back to this device. */
(function () {
'use strict';
const { $, store, toast, fmt, esc, num, CONFIG } = DD;
let sb = null, mode = 'in', recovering = false;
const here = () => location.origin + location.pathname;
const users = () => store.get('users', {});

function chip() {
  const s = DD.session, a = $('#acct'), img = $('#acctImg');
  a.classList.toggle('in', !!s);
  a.setAttribute('aria-label', s ? 'Account: ' + (s.name || s.email) : 'Sign in');
  a.title = s ? (s.name || s.email) : 'Sign in';
  img.src = s && s.avatar ? s.avatar : 'bates-face.webp';
  img.onerror = () => { img.onerror = null; img.src = 'bates-face.webp'; };
}
function adopt(u, remote, quiet) {
  const guest = DD.session ? null : DD.data;
  DD.session = u; store.set('session', u.cloud ? null : u);
  let d = Object.assign(DD.blank(), store.get(DD.dataKey(), {}), remote || {});
  if (guest) {
    if (!d.settings.icr && guest.settings.icr) d.settings = guest.settings;
    if (guest.log.length) { d.log = guest.log.concat(d.log).slice(0, 200); }
    if (!(d.icr && d.icr.start) && guest.icr && guest.icr.start) d.icr = guest.icr;
    if (!d.prefs && guest.prefs) d.prefs = guest.prefs;
    store.del('data.guest');
  }
  DD.data = d; DD.save(); chip(); render(); DD.emit('settings'); DD.emit('account');
  if (!quiet) toast('Signed in as ' + (u.name || u.email) + '.');
}
function drop() {
  DD.session = null; store.del('session');
  DD.data = Object.assign(DD.blank(), store.get(DD.dataKey(), {}));
  chip(); render(); DD.emit('settings'); DD.emit('account');
}

/* ---------- Supabase ---------- */
function load(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function onUser(event, s) {
  if (event === 'PASSWORD_RECOVERY') { recovering = true; location.hash = 'account'; render(); return; }
  if (s && s.user) {
    const cur = DD.session;
    if (cur && cur.cloud && cur.id === s.user.id) return;
    const m = s.user.user_metadata || {};
    let remote = null;
    try { const r = await sb.from('user_data').select('data').eq('user_id', s.user.id).maybeSingle(); if (r.error) console.warn('DirectDose: user_data read failed', r.error.message); remote = r.data && r.data.data; } catch (e) {}
    adopt({ email: s.user.email, name: m.full_name || m.name || s.user.email.split('@')[0], avatar: m.avatar_url || m.picture || '', cloud: true, id: s.user.id }, remote, event === 'INITIAL_SESSION');
    let back = false; try { back = sessionStorage.getItem('dd.oauth'); sessionStorage.removeItem('dd.oauth'); } catch (e) {}
    if (back || event === 'SIGNED_IN' && !$('[data-view=account]').hidden) location.hash = 'account';
  } else if (DD.session && DD.session.cloud) drop();
}
async function init() {
  /* an OAuth error comes back in the address bar */
  const q = new URLSearchParams(location.search), hq = new URLSearchParams(location.hash.replace(/^#/, ''));
  const oerr = q.get('error_description') || hq.get('error_description');
  if (!CONFIG.supabaseAnonKey) { render(); return; }
  try {
    if (!window.supabase) await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    sb = DD.sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
    /* Never call Supabase from inside this callback: it holds a lock and the call would hang. Defer instead. */
    sb.auth.onAuthStateChange((event, s) => { setTimeout(() => onUser(event, s), 0); });
    /* reachability check, so a sandboxed preview falls back cleanly */
    const ping = await Promise.race([fetch(CONFIG.supabaseUrl + '/auth/v1/settings', { headers: { apikey: CONFIG.supabaseAnonKey } }).then(() => true, () => false), new Promise(r => setTimeout(() => r(false), 5000))]);
    if (!ping) { sb = DD.sb = null; }
  } catch (e) { sb = DD.sb = null; }
  render();
  if (oerr) { location.hash = 'account'; msg('provMsg', 'Sign-in didn\'t finish: ' + oerr.replace(/\+/g, ' ')); }
}

/* ---------- forms ---------- */
function msg(id, text, bad) { const el = $('#' + id); el.textContent = text; el.hidden = !text; el.classList.toggle('err', !!bad); }
function setMode(m) {
  mode = m; const up = m === 'up', fg = m === 'forgot';
  $('#authTitle').textContent = fg ? 'Reset password' : up ? 'Create account' : 'Sign in';
  $('#authSubmit').textContent = fg ? 'Email me a reset link' : up ? 'Create account' : 'Sign in';
  $('#nameRow').hidden = !up; $('#passRow').hidden = fg; $('#gBtn').hidden = fg; $('.or').hidden = fg;
  $('#switchText').textContent = up || fg ? 'Have an account?' : 'New here?';
  $('#authSwitch').textContent = up || fg ? 'Sign in' : 'Create an account';
  $('#forgot').hidden = m !== 'in' || !sb;
  $('#aPass').autocomplete = up ? 'new-password' : 'current-password';
  msg('authErr', ''); $('#resend').hidden = true;
}
$('#authSwitch').addEventListener('click', () => setMode(mode === 'in' ? 'up' : 'in'));
$('#forgot').addEventListener('click', () => setMode('forgot'));
$('#gBtn').addEventListener('click', async () => {
  if (!sb) return msg('provMsg', 'Google sign-in can\'t reach the server from this page. It works on your hosted site.');
  try { sessionStorage.setItem('dd.oauth', '1'); } catch (e) {}
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
  if (error) msg('provMsg', 'Google sign-in failed: ' + error.message, true);
});
const hex16 = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hashPw(pw, saltHex) {
  const enc = new TextEncoder(), salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex16(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256));
}
let lastEmail = '';
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = m => msg('authErr', m, true);
  msg('authErr', ''); $('#resend').hidden = true;
  const email = $('#aEmail').value.trim().toLowerCase(), pw = $('#aPass').value, name = $('#aName').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Enter a full email address, like name@example.com.');
  if (mode === 'forgot') {
    const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: here() });
    return r.error ? err(mailErr(r.error)) : msg('authErr', 'If that email has an account, a reset link is on its way.');
  }
  if (pw.length < 8) return err('Use a password with at least 8 characters.');
  if (mode === 'up' && !name) return err('Add your name so Bates knows what to call you.');
  const btn = $('#authSubmit'); btn.disabled = true;
  try {
    if (sb) {
      if (mode === 'up') {
        const r = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name }, emailRedirectTo: here() } });
        if (r.error) return err(mailErr(r.error));
        if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) return err('That email already has an account. Sign in instead, or use Google if that\'s how you signed up.');
        if (!r.data.session) { lastEmail = email; msg('authErr', 'Almost there. Open the confirmation link we emailed to ' + email + ', then sign in.'); $('#resend').hidden = false; }
      } else {
        const r = await sb.auth.signInWithPassword({ email, password: pw });
        if (r.error) { if (/confirm/i.test(r.error.message)) { lastEmail = email; $('#resend').hidden = false; return err('Confirm your email first. Check your inbox for the link.'); } return err(/invalid/i.test(r.error.message) ? 'Wrong email or password.' : r.error.message + '.'); }
      }
      $('#aPass').value = ''; return;
    }
    if (!(window.crypto && crypto.subtle)) return err('This browser can\'t protect a password here. Open the site over https and try again.');
    const all = users();
    if (mode === 'up') {
      if (all[email]) return err('That email already has an account on this device. Sign in instead.');
      const salt = hex16(crypto.getRandomValues(new Uint8Array(16)));
      all[email] = { email, name, salt, hash: await hashPw(pw, salt) };
      store.set('users', all); adopt({ email, name });
    } else {
      const u = all[email];
      if (!u) return err('No account with that email on this device. Create one first.');
      if (await hashPw(pw, u.salt) !== u.hash) return err('Wrong password. Try again.');
      adopt({ email, name: u.name });
    }
    $('#aPass').value = '';
  } catch (x) { err('Something went wrong. Try again.'); }
  finally { btn.disabled = false; }
});
function mailErr(e) {
  const m = e.message || '';
  if (/not authorized|rate limit|sending/i.test(m)) return 'The sign-up email couldn\'t be sent (' + m + '). The site owner needs to connect an email service in Supabase.';
  return m + '.';
}
$('#resend').addEventListener('click', async () => {
  if (!sb || !lastEmail) return;
  const r = await sb.auth.resend({ type: 'signup', email: lastEmail, options: { emailRedirectTo: here() } });
  msg('authErr', r.error ? mailErr(r.error) : 'Sent again. Check spam too.', !!r.error);
});
$('#newPassForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('#newPass').value;
  if (pw.length < 8) return msg('newPassMsg', 'Use at least 8 characters.', true);
  const r = await sb.auth.updateUser({ password: pw });
  if (r.error) return msg('newPassMsg', r.error.message + '.', true);
  recovering = false; $('#newPass').value = ''; toast('Password updated.'); render();
});

/* ---------- profile ---------- */
function render() {
  const s = DD.session, d = DD.data;
  $('#authBox').hidden = !!s || recovering; $('#profileBox').hidden = !s || recovering; $('#recoverBox').hidden = !recovering;
  $('#authMode').textContent = sb ? '' : 'Cloud sign-in can\'t be reached from this page, so accounts made here stay on this device.';
  $('#forgot').hidden = mode !== 'in' || !sb;
  if (!s) return;
  $('#pHello').textContent = 'Hi, ' + (s.name || '').split(' ')[0] + '!'; $('#pEmail').textContent = s.email + (s.cloud ? '' : ' · saved on this device');
  const st = d.settings; $('#pIcr').value = st.icr || ''; $('#pIsf').value = st.isf ? Math.round(st.isf) : ''; $('#pTarget').value = st.target ? Math.round(st.target) : '';
  $('#pSaved').textContent = st.icr ? (st.icrSource === 'finder' ? 'Carb ratio found by your ratio test.' : 'These prefill the meal dose tool.') : 'Nothing saved yet.';
  const log = d.log;
  $('#logEmpty').hidden = log.length > 0; $('#logClear').hidden = !log.length;
  $('#logList').innerHTML = log.map((l, i) => `<li><span class="u">${fmt(l.dose, 1)}<small> u</small></span><span class="d"><b>${new Date(l.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b><br>${fmt(l.carbs, 0)} g carbs · ${Math.round(l.bg)} mg/dL${l.items && l.items.length ? ' · ' + esc(l.items.join(', ')) : ''}</span><button class="rm" data-i="${i}" aria-label="Delete entry">×</button></li>`).join('');
  const pb = $('#pBates')._bates; if (pb) { pb.kick(); pb.act(2); }
}
$('#pSave').addEventListener('click', () => {
  const icr = num($('#pIcr')), isf = num($('#pIsf')), target = num($('#pTarget')), d = DD.data;
  if (!icr || !isf || !target) return toast('Fill in all three first.');
  if (icr < 1 || icr > 150 || isf < 5 || isf > 400 || target < 70 || target > 200) return toast('One of those numbers looks off. Check it.');
  d.settings = Object.assign({}, d.settings, { icr, isf, target }, icr !== d.settings.icr ? { icrSource: 'manual', icrDate: Date.now() } : {});
  DD.save(); DD.emit('settings'); render(); toast('Settings saved.');
});
$('#logList').addEventListener('click', e => { const b = e.target.closest('.rm'); if (!b) return; DD.data.log.splice(+b.dataset.i, 1); DD.save(); render(); });
function twoStep(btn, label, fn) {
  btn.addEventListener('click', () => {
    if (btn.dataset.arm) { delete btn.dataset.arm; btn.textContent = label; return fn(); }
    btn.dataset.arm = 1; btn.textContent = 'Press again to confirm';
    setTimeout(() => { if (btn.dataset.arm) { delete btn.dataset.arm; btn.textContent = label; } }, 4000);
  });
}
twoStep($('#logClear'), 'Clear log', () => { DD.data.log = []; DD.save(); render(); });
async function signOut() { const cloud = DD.session && DD.session.cloud; drop(); if (cloud && sb) { try { await sb.auth.signOut(); } catch (e) {} } }
$('#signOut').addEventListener('click', async () => { await signOut(); toast('Signed out. See you soon.'); });
twoStep($('#delAcct'), 'Delete my data', async () => {
  const s = DD.session;
  if (s.cloud && sb) await sb.from('user_data').delete().eq('user_id', s.id);
  else { const all = users(); delete all[s.email]; store.set('users', all); }
  store.del(DD.dataKey()); await signOut(); toast('Your data is deleted.');
});
DD.onRoute('account', render);
DD.on('log', () => { if (!$('[data-view=account]').hidden) render(); });
chip(); setMode('in'); init();
})();
