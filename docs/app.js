'use strict';
/* meteocat: the same days, every year since 1985, for any place. Client-only. */

// ---------- endpoints & constants ----------
const API = {
  geo: 'https://geocoding-api.open-meteo.com/v1/search',
  photon: 'https://photon.komoot.io/api/',
  archive: 'https://archive-api.open-meteo.com/v1/archive',
};
const FIRST_YEAR = 1985;
const DAY = 864e5;
const CACHE_PREFIX = 'mc3:';
// One consistent model for every year: ERA5-Land (temperature) + ERA5 (wind, rain, snow).
// The default "best match" switches to ECMWF IFS from 2017, which shifts wind and rain and fakes trends.
const MODEL = 'era5_seamless';

// ---------- small utilities ----------
const $ = s => document.querySelector(s);
const enc = encodeURIComponent;
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const safeD = (y, m, d) => D(y, m, m === 2 && d === 29 && !isLeap(y) ? 28 : d);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const iso = d => d.toISOString().slice(0, 10);
const parseISO = s => D(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMD = ([m, d]) => `${d} ${MONTHS[m - 1]}`;
const fmtD = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const ok = v => v != null && !Number.isNaN(v);
const r1 = v => (ok(v) ? (Math.round(v * 10) / 10).toFixed(1) : '–');
const r0 = v => (ok(v) ? String(Math.round(v)) : '–');
const sum = a => a.reduce((s, v) => s + (ok(v) ? v : 0), 0);
const mean = a => { const f = a.filter(ok); return f.length ? sum(f) / f.length : null; };
const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Flag images (Windows has no flag emoji), served from this site; a missing one simply hides itself.
const flag = cc => (/^[A-Za-z]{2}$/.test(cc || '') ? `<img class="flag" src="vendor/flags/${cc.toLowerCase()}.png" alt="${cc.toUpperCase()}" onerror="this.remove()">` : '');
const TODAY = (() => { const t = new Date(); return D(t.getFullYear(), t.getMonth() + 1, t.getDate()); })();
// ERA5 reaches the archive with a ~5 day delay.
const LATEST = addDays(TODAY, -6);
const store = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

// ---------- periods ----------
const SEASONS = {
  spring: { name: 'Spring', from: [3, 1], to: [5, 31] },
  summer: { name: 'Summer', from: [6, 1], to: [8, 31] },
  autumn: { name: 'Autumn', from: [9, 1], to: [11, 30] },
  winter: { name: 'Winter', from: [12, 1], to: [2, 29] },
};
const DEFAULT = {
  place: { name: 'Bratislava', lat: 48.14816, lon: 17.10674, cc: 'SK', admin: 'Bratislava Region', country: 'Slovakia' },
  from: [6, 1], to: [8, 31], one: false,
};
let state = structuredClone(DEFAULT);

const crosses = () => !state.one && state.to[0] * 100 + state.to[1] < state.from[0] * 100 + state.from[1];
const seasonKey = () => (state.one ? null : Object.keys(SEASONS).find(k => {
  const s = SEASONS[k]; return s.from.join() === state.from.join() && s.to.join() === state.to.join();
}) || null);
// Year Y is the year the period ends in, so winter 2026 = Dec 2025 to Feb 2026.
function periodFor(Y) {
  const s = safeD(crosses() ? Y - 1 : Y, state.from[0], state.from[1]);
  const e = state.one ? s : safeD(Y, state.to[0], state.to[1]);
  return { Y, s, e, days: Math.round((e - s) / DAY) + 1 };
}
const yearLabel = Y => (crosses() ? `${Y - 1}/${String(Y).slice(2)}` : String(Y));
const periodName = () => {
  const k = seasonKey();
  if (k) return SEASONS[k].name;
  return state.one ? fmtMD(state.from) : `${fmtMD(state.from)} – ${fmtMD(state.to)}`;
};
const periodWord = () => { const k = seasonKey(); return k ? SEASONS[k].name.toLowerCase() : state.one ? 'day' : 'period'; };
function yearsRange() {
  let last = TODAY.getUTCFullYear() + 1;
  while (periodFor(last).e > LATEST) last--;
  const ys = [];
  for (let y = FIRST_YEAR; y <= last; y++) ys.push(y);
  return ys;
}

// ---------- URL ----------
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const s = structuredClone(DEFAULT);
  if (h.has('lat') && h.has('lon')) s.place = { name: h.get('n') || 'Selected place', lat: +h.get('lat'), lon: +h.get('lon'), cc: h.get('cc') || '', admin: h.get('a') || '', country: h.get('c') || '' };
  const md = v => { const m = /^(\d{1,2})-(\d{1,2})$/.exec(v || ''); return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? [+m[1], +m[2]] : null; };
  if (SEASONS[h.get('s')]) { s.from = [...SEASONS[h.get('s')].from]; s.to = [...SEASONS[h.get('s')].to]; }
  s.from = md(h.get('f')) || s.from; s.to = md(h.get('t')) || s.to;
  s.one = h.get('one') === '1';
  if (s.one) s.to = [...s.from];
  return s;
}
function writeHash() {
  const p = state.place, k = seasonKey();
  const h = new URLSearchParams({ n: p.name, lat: p.lat.toFixed(4), lon: p.lon.toFixed(4), cc: p.cc, a: p.admin, c: p.country });
  if (k) h.set('s', k); else { h.set('f', state.from.join('-')); if (state.one) h.set('one', '1'); else h.set('t', state.to.join('-')); }
  history.replaceState(null, '', '#' + h.toString());
}

// ---------- fetching ----------
// Open-Meteo's free tier counts each 2 weeks of data as one call (600 a minute).
// Finished periods never change, so each year's summary is kept in localStorage.
const sleep = ms => new Promise(r => setTimeout(r, ms));
let onWait = () => {};
async function fetchJSON(url) {
  for (let i = 0; ; i++) {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 && i < 5) { onWait(true); await sleep(15000 * (i + 1)); onWait(false); continue; }
    if (!r.ok || j.error) throw new Error(j.reason || `Request failed (HTTP ${r.status})`);
    return j;
  }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const ll = p => `latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}`;

// One year: day/night means from hourly data (day 07–20 h, night 21–06 h), extremes, rain, snow, wind.
async function loadYear(place, Y) {
  const p = periodFor(Y);
  const key = `${CACHE_PREFIX}${ll(place)}:${iso(p.s)}_${iso(p.e)}`;
  const hit = store.get(key, null);
  if (hit) return hit;
  const j = await fetchJSON(`${API.archive}?${ll(place)}&start_date=${iso(addDays(p.s, -1))}&end_date=${iso(p.e)}&timezone=auto&models=${MODEL}`
    + '&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum,wind_gusts_10m_max&hourly=temperature_2m,wind_speed_10m');
  const inP = d => d >= p.s && d <= p.e;
  const dayT = [], nightT = [], wind = [];
  j.hourly.time.forEach((t, i) => {
    const d = parseISO(t), hr = +t.slice(11, 13), T = j.hourly.temperature_2m[i];
    if (inP(d)) {
      wind.push(j.hourly.wind_speed_10m[i]);
      if (hr >= 7 && hr <= 20) dayT.push(T); else if (hr <= 6) nightT.push(T);
    }
    if (hr >= 21 && inP(addDays(d, 1))) nightT.push(T);
  });
  const dd = j.daily, days = [];
  for (let i = 1; i < dd.time.length; i++) {
    const row = { date: dd.time[i], tmax: dd.temperature_2m_max[i], tmin: dd.temperature_2m_min[i], rain: dd.rain_sum[i], snow: dd.snowfall_sum[i], gust: dd.wind_gusts_10m_max[i] };
    if (![row.tmax, row.tmin, row.rain, row.snow].every(ok)) return null; // incomplete year
    days.push(row);
  }
  const ext = (k, f) => days.reduce((a, b) => (f(b[k], a[k]) ? b : a));
  const hi = ext('tmax', (a, b) => a > b), lo = ext('tmin', (a, b) => a < b), gu = ext('gust', (a, b) => a > b);
  const out = {
    Y, day: mean(dayT), night: mean(nightT),
    hi: hi.tmax, hiDate: hi.date, lo: lo.tmin, loDate: lo.date,
    rain: sum(days.map(d => d.rain)), rainDays: days.filter(d => d.rain >= 1).length,
    snow: sum(days.map(d => d.snow)), snowDays: days.filter(d => d.snow >= 0.5).length,
    wind: mean(wind), gust: gu.gust, gustDate: gu.date,
  };
  // The newest ~3 months are preliminary (ERA5T) and can still be revised, so don't keep them.
  if (p.e > addDays(TODAY, -90)) return out;
  if (!store.set(key, out)) { // storage full: drop our oldest half and retry once
    try { const ks = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)); ks.slice(0, ks.length >> 1).forEach(k => localStorage.removeItem(k)); store.set(key, out); } catch { /* ignore */ }
  }
  return out;
}

// ---------- place search ----------
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function lev(a, b) {
  const m = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = m[0]; m[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return m[b.length];
}
function haversine(a, b, c, d) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const searchCache = new Map();
async function getCached(url) {
  if (!searchCache.has(url)) searchCache.set(url, fetchJSON(url).catch(e => { searchCache.delete(url); throw e; }));
  return searchCache.get(url);
}
async function searchPlaces(q) {
  const om = getCached(`${API.geo}?name=${enc(q)}&count=8&language=en&format=json`)
    .then(j => (j.results || []).map(r => ({ name: r.name, lat: r.latitude, lon: r.longitude, cc: r.country_code || '', admin: r.admin1 || '', country: r.country || '', pop: r.population || 0 })))
    .catch(() => []);
  // Photon (OpenStreetMap) tolerates typos and knows parks and lakes; limited to Europe here.
  const ph = q.length < 3 ? Promise.resolve([]) : getCached(`${API.photon}?q=${enc(q)}&limit=8&lang=en&bbox=-25,34,45,72`)
    .then(j => (j.features || []).filter(f => f.properties.name).map(f => ({
      name: f.properties.name, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
      cc: (f.properties.countrycode || '').toUpperCase(), admin: f.properties.state || f.properties.county || '', country: f.properties.country || '', pop: 0 })))
    .catch(() => []);
  const [a, b] = await Promise.all([om, ph]);
  const out = [];
  for (const x of [...a, ...b]) {
    if (!out.some(y => haversine(x.lat, x.lon, y.lat, y.lon) < (norm(x.name) === norm(y.name) ? 20 : 4))) out.push(x);
  }
  const nq = norm(q);
  const score = x => -2 * lev(norm(x.name).slice(0, nq.length + 2), nq) + 0.4 * Math.log10(x.pop + 1)
    + (x.lat > 34 && x.lat < 72 && x.lon > -25 && x.lon < 45 ? 1 : 0);
  return out.sort((x, y) => score(y) - score(x)).slice(0, 8);
}
function setupSearch() {
  const input = $('#q'), list = $('#sugg');
  let items = [], sel = -1, timer, seq = 0;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; };
  const render = title => {
    list.innerHTML = (title ? `<li class="sec" role="presentation">${esc(title)}</li>` : '') + (items.map((it, i) => `
      <li role="option" id="opt${i}" data-i="${i}" aria-selected="${i === sel}">${flag(it.cc)}
        <span><span class="nm">${esc(it.name)}</span><br><span class="meta">${esc([it.admin, it.country].filter(Boolean).join(', '))}</span></span>
      </li>`).join('') || '<li class="sec">No match. Try another spelling or a nearby town.</li>');
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', sel >= 0 ? `opt${sel}` : '');
  };
  const showRecent = () => { items = store.get('mc-recent', []); if (items.length) { sel = -1; render('Recent'); } else close(); };
  const choose = it => {
    if (!it) return;
    state.place = { name: it.name, lat: it.lat, lon: it.lon, cc: it.cc, admin: it.admin, country: it.country };
    store.set('mc-recent', [state.place, ...store.get('mc-recent', []).filter(r => r.name !== it.name || r.cc !== it.cc)].slice(0, 6));
    input.value = ''; close(); input.blur(); update();
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { showRecent(); return; }
    timer = setTimeout(async () => {
      const my = ++seq, res = await searchPlaces(q);
      if (my !== seq) return;
      items = res; sel = items.length ? 0 : -1; render();
    }, 220);
  });
  input.addEventListener('focus', () => { if (!input.value.trim()) showRecent(); });
  input.addEventListener('keydown', e => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { choose(items[Math.max(0, sel)]); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); choose(items[+li.dataset.i]); } });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) close(); });
  $('#geo').addEventListener('click', () => {
    if (!navigator.geolocation) return setStatus('Your browser cannot share its location.', true);
    navigator.geolocation.getCurrentPosition(
      pos => choose({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude, cc: '', admin: `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`, country: '' }),
      () => setStatus('Location not available. Type a place instead.', true), { timeout: 10000 });
  });
}

// ---------- date & season controls ----------
function renderControls() {
  const p = state.place;
  $('#placeInfo').innerHTML = `${flag(p.cc)}<b>${esc(p.name)}</b>${esc([p.admin, p.country].filter(Boolean).join(', '))}`;
  $('#dateLabel').textContent = state.one ? fmtMD(state.from) : `${fmtMD(state.from)} – ${fmtMD(state.to)}`;
  const k = seasonKey();
  $('#seasons').innerHTML = Object.entries(SEASONS).map(([key, s]) =>
    `<button type="button" role="radio" aria-checked="${k === key}" data-s="${key}">${s.name}</button>`).join('');
  document.querySelectorAll('#mode button').forEach(b => b.setAttribute('aria-checked', String((b.dataset.mode === 'one') === state.one)));
  $('#toRow').hidden = state.one;
  $('#fromLbl').textContent = state.one ? 'Day' : 'From';
}
function fillDateSelects() {
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  const months = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  $('#fd').innerHTML = $('#td').innerHTML = days;
  $('#fm').innerHTML = $('#tm').innerHTML = months;
  $('#fd').value = state.from[1]; $('#fm').value = state.from[0];
  $('#td').value = state.to[1]; $('#tm').value = state.to[0];
}
function setupControls() {
  const panel = $('#datePanel'), btn = $('#dateBtn');
  let draftOne = state.one;
  const openPanel = open => {
    panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) { draftOne = state.one; fillDateSelects(); }
  };
  btn.addEventListener('click', () => openPanel(panel.hidden));
  $('#mode').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    draftOne = b.dataset.mode === 'one';
    document.querySelectorAll('#mode button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    $('#toRow').hidden = draftOne; $('#fromLbl').textContent = draftOne ? 'Day' : 'From';
  });
  $('#dateDone').addEventListener('click', () => {
    const clamp = (m, d) => [m, Math.min(d, new Date(Date.UTC(2000, m, 0)).getUTCDate())];
    state.one = draftOne;
    state.from = clamp(+$('#fm').value, +$('#fd').value);
    state.to = state.one ? [...state.from] : clamp(+$('#tm').value, +$('#td').value);
    openPanel(false); update();
  });
  $('#seasons').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const s = SEASONS[b.dataset.s];
    state.one = false; state.from = [...s.from]; state.to = [...s.to];
    openPanel(false); update();
  });
  $('#share').addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'meteocat', url: location.href });
      else { await navigator.clipboard.writeText(location.href); setStatus('Link copied'); setTimeout(() => setStatus(''), 2000); }
    } catch { /* share sheet dismissed */ }
  });
}
function setStatus(html, err = false) { const el = $('#status'); el.innerHTML = html; el.classList.toggle('err', err); }

// ---------- main flow ----------
let rows = [], token = 0;
async function update() {
  writeHash(); renderControls();
  const my = ++token, place = state.place, years = yearsRange();
  const meta = `${periodName()} · ${yearLabel(years[0])}–${yearLabel(years[years.length - 1])}`;
  document.querySelectorAll('[data-meta]').forEach(el => { el.textContent = meta; });
  ['c-temp', 'c-rain', 'c-wind'].forEach(id => { const el = document.getElementById(id); el.innerHTML = ''; el.classList.add('loading'); });
  $('#c-snow').innerHTML = '';
  ['hl-temp', 'hl-rain', 'hl-wind'].forEach(id => { document.getElementById(id).textContent = ''; });

  let done = 0, waiting = false;
  const progress = () => {
    if (my !== token) return;
    const pct = Math.round(done / years.length * 100);
    setStatus(`<span>${waiting ? 'The free weather service needs a short breather. Continuing in a moment…' : `Loading ${years.length} years of ${periodWord() === 'day' ? fmtMD(state.from) : periodWord() + 's'}…`}</span>
      <div class="progress"><i style="width:${pct}%"></i></div>`);
  };
  onWait = w => { waiting = w; progress(); };
  progress();
  const out = new Array(years.length);
  try {
    await pool(years, 4, async (Y, i) => {
      if (my !== token) return;
      out[i] = await loadYear(place, Y);
      done++; progress();
    });
  } catch (e) {
    if (my === token) { setStatus(`Couldn't load the weather data: ${esc(e.message)}. Try again in a minute.`, true); clearLoading(); }
    return;
  }
  if (my !== token) return;
  rows = out.filter(Boolean);
  setStatus(rows.length ? '' : 'No data for this place and period.', !rows.length);
  draw();
}
function clearLoading() { document.querySelectorAll('.chart.loading').forEach(el => el.classList.remove('loading')); }
function draw() {
  clearLoading();
  if (!rows.length) return;
  drawTemp(); drawRain(); drawWind();
}

// ---------- headlines ----------
const best = (key, f) => rows.reduce((a, b) => (f(b[key], a[key]) ? b : a));
const warmer = d => (Math.abs(d) < 0.15 ? 'about the same' : `<b>${r1(Math.abs(d))} °C ${d > 0 ? 'warmer' : 'cooler'}</b>`);
const span = a => `${yearLabel(a[0].Y)}–${yearLabel(a[a.length - 1].Y)}`;
// Two explicit statements: the latest year against the first ten years, then ten-year average against ten-year average.
function tempHeadline() {
  const early = rows.slice(0, 10), late = rows.slice(-10), last = rows[rows.length - 1];
  const base = { day: mean(early.map(r => r.day)), night: mean(early.map(r => r.night)) };
  const what = periodWord() === 'day' ? `${fmtMD(state.from)} ${yearLabel(last.Y)}` : `${periodName()} ${yearLabel(last.Y)}`;
  const d = last.day - base.day;
  const latest = `${what} averaged <b>${r1(last.day)} °C</b> by day, `
    + (Math.abs(d) < 0.15 ? `the same as the ${span(early)} average.` : `${r1(Math.abs(d))} °C ${d > 0 ? 'above' : 'below'} the ${span(early)} average (${r1(base.day)} °C).`);
  const dd = mean(late.map(r => r.day)) - base.day, nn = mean(late.map(r => r.night)) - base.night;
  const trend = ` Across the last ten years (${span(late)}), days were ${warmer(dd)} and nights ${warmer(nn)} on average.`;
  return latest + trend + (periodWord() === 'day' ? ' A single day swings a lot from year to year.' : '');
}
function headlines() {
  $('#hl-temp').innerHTML = tempHeadline();
  const wet = best('rain', (a, b) => a > b), dry = best('rain', (a, b) => a < b), snowy = best('snow', (a, b) => a > b);
  $('#hl-rain').innerHTML = `Wettest: <b>${yearLabel(wet.Y)}</b> (${r0(wet.rain)} mm). Driest: <b>${yearLabel(dry.Y)}</b> (${r0(dry.rain)} mm).`
    + (snowy.snow >= 1 ? ` Snowiest: <b>${yearLabel(snowy.Y)}</b> (${r0(snowy.snow)} cm).` : '');
  const windy = best('wind', (a, b) => a > b), calm = best('wind', (a, b) => a < b), gusty = best('gust', (a, b) => a > b);
  $('#hl-wind').innerHTML = `Windiest: <b>${yearLabel(windy.Y)}</b>. Calmest: <b>${yearLabel(calm.Y)}</b>. Strongest gust: <b>${r0(gusty.gust)} km/h</b> on ${fmtD(parseISO(gusty.gustDate))} ${gusty.gustDate.slice(0, 4)}.`;
}

// ---------- charts ----------
function base(el, height, extra = {}) {
  const w = el.clientWidth || 340;
  const x0 = rows[0].Y, x1 = rows[rows.length - 1].Y;
  const step = w < 480 || (crosses() && w < 640) ? 10 : 5; // fewer year labels on phones
  return {
    width: w, height, marginTop: 24, marginRight: 8, marginLeft: 36, marginBottom: 24,
    style: { background: 'transparent', color: cv('--ink-2'), fontFamily: 'inherit', fontSize: '11px' },
    color: { type: 'identity' },
    x: { domain: [x0 - 0.6, x1 + 0.6], label: null, tickSize: 0, ticks: d3.range(Math.ceil(x0 / step) * step, x1 + 1, step), tickFormat: y => yearLabel(y) },
    ...extra,
  };
}
const barWidth = el => Math.max(2, Math.min(9, (el.clientWidth - 44) / rows.length * 0.55));
const tip = () => ({ fill: cv('--card'), stroke: cv('--hair'), fontSize: 12, textPadding: 8 });
const mount = (id, node) => { const el = document.getElementById(id); el.classList.remove('loading'); el.replaceChildren(node); };
const yGrid = extra => ({ grid: true, label: null, tickSize: 0, nice: true, ...extra });

function drawTemp() {
  const el = $('#c-temp'), bw = barWidth(el);
  const title = r => `${periodWord() === 'day' ? fmtMD(state.from) + ' ' : ''}${yearLabel(r.Y)}\nDay average  ${r1(r.day)} °C\nNight average  ${r1(r.night)} °C\nWarmest  ${r1(r.hi)} °C · ${fmtD(parseISO(r.hiDate))}\nColdest  ${r1(r.lo)} °C · ${fmtD(parseISO(r.loDate))}`;
  mount('c-temp', Plot.plot({
    ...base(el, 240), y: yGrid({ tickFormat: v => `${v}°` }),
    marks: [
      // range bars first, so the lines sit on top of them
      Plot.ruleX(rows, { x: 'Y', y1: 'lo', y2: 'hi', stroke: cv('--range'), strokeWidth: bw, strokeLinecap: 'round' }),
      Plot.lineY(rows, { x: 'Y', y: 'day', stroke: cv('--day'), strokeWidth: 1.5, curve: 'monotone-x' }),
      Plot.lineY(rows, { x: 'Y', y: 'night', stroke: cv('--night'), strokeWidth: 1.5, curve: 'monotone-x' }),
      Plot.dot(rows, { x: 'Y', y: 'day', fill: cv('--day'), r: 2.6 }),
      Plot.dot(rows, { x: 'Y', y: 'night', fill: cv('--night'), r: 2.6 }),
      Plot.ruleX(rows, Plot.pointerX({ x: 'Y', stroke: cv('--ink-3'), strokeDasharray: '2,3' })),
      Plot.dot(rows, Plot.pointerX({ x: 'Y', y: 'day', r: 5, fill: cv('--day'), stroke: cv('--card'), strokeWidth: 2 })),
      Plot.dot(rows, Plot.pointerX({ x: 'Y', y: 'night', r: 5, fill: cv('--night'), stroke: cv('--card'), strokeWidth: 2 })),
      Plot.tip(rows, Plot.pointerX({ x: 'Y', y: 'hi', title, ...tip() })),
    ],
  }));
  headlines();
}
function drawRain() {
  const el = $('#c-rain'), bw = barWidth(el);
  const title = r => `${yearLabel(r.Y)}\nRain  ${r0(r.rain)} mm · ${r.rainDays} rainy days\nFresh snow  ${r0(r.snow)} cm · ${r.snowDays} snowy days`;
  mount('c-rain', Plot.plot({
    ...base(el, 170), y: yGrid({ tickFormat: v => `${v}` }),
    marks: [
      Plot.ruleY([0], { stroke: cv('--hair') }),
      Plot.ruleX(rows, { x: 'Y', y1: 0, y2: 'rain', stroke: cv('--rain'), strokeWidth: bw }),
      Plot.ruleX(rows, Plot.pointerX({ x: 'Y', y1: 0, y2: 'rain', stroke: cv('--ink'), strokeOpacity: 0.25, strokeWidth: bw + 4 })),
      Plot.tip(rows, Plot.pointerX({ x: 'Y', y: 'rain', title, ...tip() })),
      Plot.text(['mm'], { frameAnchor: 'top-left', dx: -32, dy: -20, fill: cv('--ink-3') }),
    ],
  }));
  // Snow sits in its own strip under the rain, hanging down from the shared year axis, in cm.
  const snowEl = $('#c-snow');
  if (!rows.some(r => r.snow >= 0.5)) { snowEl.innerHTML = `<p class="empty">No fresh snow in any of these ${periodWord() === 'day' ? 'days' : periodWord() + 's'}.</p>`; return; }
  mount('c-snow', Plot.plot({
    ...base(snowEl, 110, { marginTop: 4, marginBottom: 10 }),
    x: { ...base(snowEl, 0).x, axis: null },
    y: yGrid({ reverse: true, ticks: 3 }),
    marks: [
      Plot.ruleY([0], { stroke: cv('--hair') }),
      Plot.ruleX(rows, { x: 'Y', y1: 0, y2: 'snow', stroke: cv('--snow'), strokeWidth: bw }),
      Plot.tip(rows, Plot.pointerX({ x: 'Y', y: 'snow', title, ...tip() })),
      Plot.text(['cm'], { frameAnchor: 'bottom-left', dx: -32, dy: 6, fill: cv('--ink-3') }),
    ],
  }));
}
function drawWind() {
  const el = $('#c-wind');
  const title = r => `${yearLabel(r.Y)}\nAverage  ${r1(r.wind)} km/h\nStrongest gust  ${r0(r.gust)} km/h · ${fmtD(parseISO(r.gustDate))}`;
  mount('c-wind', Plot.plot({
    ...base(el, 190), y: yGrid({ zero: true }),
    marks: [
      Plot.lineY(rows, { x: 'Y', y: 'gust', stroke: cv('--gust'), strokeWidth: 1.5, curve: 'monotone-x' }),
      Plot.dot(rows, { x: 'Y', y: 'gust', fill: cv('--gust'), r: 2.4 }),
      Plot.lineY(rows, { x: 'Y', y: 'wind', stroke: cv('--wind'), strokeWidth: 1.5, curve: 'monotone-x' }),
      Plot.dot(rows, { x: 'Y', y: 'wind', fill: cv('--wind'), r: 2.6 }),
      Plot.ruleX(rows, Plot.pointerX({ x: 'Y', stroke: cv('--ink-3'), strokeDasharray: '2,3' })),
      Plot.tip(rows, Plot.pointerX({ x: 'Y', y: 'gust', title, ...tip() })),
      Plot.text(['km/h'], { frameAnchor: 'top-left', dx: -32, dy: -20, fill: cv('--ink-3') }),
    ],
  }));
}

// ---------- about, contact, visitor stats ----------
const setting = name => (document.querySelector(`meta[name="mc:${name}"]`)?.content || '').trim();
function setupAbout() {
  const dlg = $('#about');
  $('#aboutBtn').addEventListener('click', () => {
    // The address is put on the page only when the sheet opens, which keeps simple spam scrapers away from it.
    const mail = setting('contact');
    if (mail.includes('@')) {
      const a = document.createElement('a');
      a.href = `mailto:${mail}`; a.textContent = mail;
      $('#contact').replaceChildren(a);
    }
    dlg.showModal();
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // tap outside closes
}
// GoatCounter: cookieless, stores no IP addresses. Only loads once a code is set in index.html.
function setupStats() {
  const code = setting('goatcounter');
  if (!/^[a-z0-9-]+$/i.test(code)) return;
  const s = document.createElement('script');
  s.async = true; s.src = 'vendor/count.js';
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`; // counts the page only, not the chosen place
  document.head.appendChild(s);
}

// ---------- boot ----------
function boot() {
  state = readHash();
  setupSearch(); setupControls(); setupAbout(); setupStats();
  let rt, lastW = 0;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width); if (w === lastW) return; lastW = w;
    clearTimeout(rt); rt = setTimeout(() => { if (rows.length) draw(); }, 150);
  }).observe($('.wrap'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (rows.length) draw(); });
  window.addEventListener('hashchange', () => { const s = readHash(); if (JSON.stringify(s) !== JSON.stringify(state)) { state = s; update(); } });
  update();
}
document.addEventListener('DOMContentLoaded', boot);
