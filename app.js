'use strict';

/* ================= Настройки ================= */
const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const COLORS = ['#e0584a', '#e0a04a', '#7bc96f', '#4ab3e0', '#9a6be0', '#e06bb6', '#4ae0c0', '#c0c04a', '#e08a6b', '#6b8ae0'];

const DEFAULT_PLAYERS = [
  { name: 'Алиса', avatar: '👩‍🦰', voiceO: 'nova',    persona: 'эмоциональная, общительная' },
  { name: 'Борис', avatar: '🧔',    voiceO: 'onyx',    persona: 'спокойный, рассудительный' },
  { name: 'Вера',  avatar: '👵',    voiceO: 'shimmer', persona: 'подозрительная, наблюдательная' },
  { name: 'Глеб',  avatar: '🕵️',   voiceO: 'echo',    persona: 'саркастичный, любит давить на людей' },
  { name: 'Дана',  avatar: '👩‍🎤', voiceO: 'coral',   persona: 'импульсивная, шумная' },
  { name: 'Егор',  avatar: '🤓',    voiceO: 'ash',     persona: 'логик, строит версии по фактам' },
  { name: 'Жанна', avatar: '💃',    voiceO: 'sage',    persona: 'хитрая, дружелюбная' },
].map(p => ({ model: '', voiceB: '', ...p }));

const DEFAULTS = {
  base: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini', temp: 0.9,
  tts: 'openai', ttsModel: 'gpt-4o-mini-tts', ttsBase: '', ttsKey: '', rate: 1,
  lang: 'русский', rounds: 2, showRoles: true, players: DEFAULT_PLAYERS,
};

let S = loadSettings();
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('aimafia') || 'null');
    if (raw) return { ...DEFAULTS, ...raw };
  } catch (e) {}
  return structuredClone(DEFAULTS);
}
function saveSettings() { try { localStorage.setItem('aimafia', JSON.stringify(S)); } catch (e) {} }

/* ================= Утилиты ================= */
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ROLE_NAME = { mafia: 'Мафия', detective: 'Комиссар', doctor: 'Доктор', civilian: 'Мирный житель' };

/* ================= Состояние игры ================= */
let G = null;            // текущая игра
let runToken = 0;        // для остановки
let paused = false;

function isDemo() { return !S.key.trim(); }

async function gate() {              // пауза / стоп
  while (paused) await sleep(150);
  if (G.token !== runToken) throw 'stop';
}
function alive() { return G.players.filter(p => p.alive); }
function aliveOf(role) { return G.players.filter(p => p.alive && p.role === role); }

/* ================= Рендер стола ================= */
function renderTable() {
  const seats = $('seats');
  seats.innerHTML = '';
  const n = G.players.length;
  G.players.forEach((p, i) => {
    const ang = Math.PI / 2 + (i * 2 * Math.PI) / n;       // старт снизу
    const x = 50 + 46 * Math.cos(ang) * 1.0;
    const y = 50 + 44 * Math.sin(ang);
    const el = document.createElement('div');
    el.className = 'seat' + (y < 45 ? ' below' : '');
    el.style.left = x + '%'; el.style.top = y + '%';
    el.dataset.id = p.id;

    const bubble = document.createElement('div'); bubble.className = 'bubble';
    const av = document.createElement('div'); av.className = 'avatar';
    av.style.background = `radial-gradient(circle at 30% 25%, ${p.color}, #1a1b26 130%)`;
    if (/^(https?:|data:)/.test(p.avatar)) { av.style.backgroundImage = `url("${p.avatar}")`; }
    else av.textContent = p.avatar || '🙂';
    const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = p.name;
    const md = document.createElement('div'); md.className = 'model'; md.textContent = isDemo() ? 'демо' : (p.model || S.model);
    const rl = document.createElement('div'); rl.className = 'role ' + p.role; rl.textContent = ROLE_NAME[p.role];
    el.append(bubble, av, nm, md, rl);
    seats.appendChild(el);
    p.el = el; p.bubble = bubble;
  });
  document.body.classList.toggle('show-roles', !!S.showRoles);
}
function refreshSeats() {
  G.players.forEach(p => p.el.classList.toggle('dead', !p.alive));
}
function setNight(on) {
  document.body.classList.toggle('night', on);
}
function setPhase(t) { $('phase').textContent = t; }
function setCenter(t) { $('tableCenter').textContent = t; }

function chat(cls, html, who, color) {
  const log = $('chatLog');
  const d = document.createElement('div'); d.className = 'msg ' + cls;
  if (who) { const w = document.createElement('span'); w.className = 'who'; w.style.color = color; w.textContent = who + ':'; d.appendChild(w); }
  d.appendChild(document.createTextNode(html));
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}
function announce(text, cls = 'sys') {
  chat(cls, text);
  G.log.push('[Ведущий] ' + text);
}

/* ================= LLM ================= */
function playerModel(p) { return (p.model || S.model || 'gpt-4o-mini').trim(); }

async function llm(p, system, user, maxTokens = 220) {
  if (isDemo()) return null;
  const url = S.base.replace(/\/+$/, '') + '/chat/completions';
  const body = {
    model: playerModel(p), temperature: Number(S.temp), max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.key.trim() },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return (j.choices?.[0]?.message?.content || '').trim();
    } catch (e) {
      console.warn('LLM error', e);
      if (attempt === 2) { chat('event', `⚠ Ошибка API (${p.name}, ${playerModel(p)}): ${e.message}`); return null; }
      await sleep(800);
    }
  }
  return null;
}

function systemPrompt(p) {
  const others = G.players.filter(x => x !== p).map(x => x.name).join(', ');
  let s = `Ты играешь в «Мафию». Твоё имя: ${p.name}. Характер: ${p.persona || 'обычный'}. Говори на языке: ${S.lang}.\n` +
    `Игроки за столом: ${G.players.map(x => x.name + (x.alive ? '' : ' (мёртв)')).join(', ')}.\n` +
    `Твоя роль: ${ROLE_NAME[p.role]}.\n`;
  if (p.role === 'mafia') {
    const mates = G.players.filter(x => x.role === 'mafia' && x !== p).map(x => x.name);
    s += `Ты мафия. ${mates.length ? 'Твои сообщники: ' + mates.join(', ') + '.' : 'Ты один в мафии.'} Твоя цель — не выдать себя и убрать мирных. Можешь врать и обвинять других, но не слишком явно подставляй сообщников.\n`;
  } else if (p.role === 'detective') {
    s += `Ты комиссар: каждую ночь проверяешь одного игрока. Решай сам, когда раскрыться — это рискованно, но может помочь городу.\n`;
  } else if (p.role === 'doctor') {
    s += `Ты доктор: каждую ночь лечишь одного игрока (можно себя), спасая от убийства. Не раскрывайся без необходимости.\n`;
  } else {
    s += `Ты мирный житель. Найди мафию по поведению и голосуй разумно.\n`;
  }
  if (p.notes.length) s += `Твои личные знания:\n- ${p.notes.join('\n- ')}\n`;
  s += `Правила ответа: говори от первого лица, как живой человек за столом, без markdown, без кавычек, без своего имени в начале. Не упоминай, что ты ИИ.`;
  return s;
}
function publicLog() {
  return G.log.slice(-40).join('\n') || '(игра только началась)';
}

function pickName(text, candidates) {
  if (!text) return null;
  const low = text.toLowerCase();
  let best = null, bi = 1e9;
  for (const c of candidates) {
    const i = low.indexOf(c.name.toLowerCase());
    if (i >= 0 && i < bi) { bi = i; best = c; }
  }
  return best;
}
async function choose(p, question, candidates) {
  const sys = systemPrompt(p);
  const usr = `Что происходит в игре:\n${publicLog()}\n\n${question}\nВарианты: ${candidates.map(c => c.name).join(', ')}.\nОтветь ТОЛЬКО одним именем из списка.`;
  const out = await llm(p, sys, usr, 20);
  return pickName(out, candidates) || rnd(candidates);
}

/* ===== демо-реплики ===== */
const DEMO_LINES = [
  'Мне кажется, {t} ведёт себя слишком тихо. Это подозрительно.', 'Я бы пока присмотрелась к {t}. Слишком уж гладко он говорит.',
  'Давайте не будем спешить. Но {t} мне не нравится.', 'Я мирный, честное слово! А вот {t} уходит от ответа.',
  'Помните, как {t} вчера молчал? Для меня это красный флаг.', 'У меня нет улик, просто чутьё: {t}.',
  'Хватит болтовни, предлагаю проверить {t}.', 'Если {t} невиновен, пусть объяснит своё поведение.',
];
function demoSpeech(p) {
  const t = rnd(alive().filter(x => x !== p));
  return rnd(DEMO_LINES).replace('{t}', t ? t.name : 'кто-то');
}

async function speechTurn(p, round) {
  const sys = systemPrompt(p);
  const usr = `Что происходит в игре:\n${publicLog()}\n\nСейчас день, круг обсуждения ${round}. Твоя очередь говорить. Скажи 1–3 коротких предложения: выскажи подозрение, защиту или версию. Не больше 250 символов.`;
  p.el.classList.add('thinking');
  let text = await llm(p, sys, usr, 160);
  p.el.classList.remove('thinking');
  if (!text) text = demoSpeech(p);
  text = text.replace(/^\s*["«]|["»]\s*$/g, '').replace(new RegExp('^' + p.name + '\\s*[:—-]\\s*', 'i'), '');
  return text;
}

/* ================= TTS ================= */
let currentAudio = null;
function stopSpeaking() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

async function speak(p, text) {
  if (S.tts === 'openai' && (S.ttsKey || S.key).trim()) {
    const ok = await speakOpenAI(p, text);
    if (ok) return;
  }
  if (S.tts === 'browser' || S.tts === 'openai') return speakBrowser(p, text);
  await sleep(Math.min(6000, 700 + text.length * 45));
}

async function speakOpenAI(p, text) {
  const key = (S.ttsKey || S.key).trim();
  const base = (S.ttsBase || S.base).replace(/\/+$/, '');
  if (!key) return false;
  try {
    const r = await fetch(base + '/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: S.ttsModel || 'gpt-4o-mini-tts', voice: p.voiceO || 'alloy', input: text,
        speed: Number(S.rate) || 1, response_format: 'mp3',
        instructions: `Говори как живой человек за игровым столом. Характер: ${p.persona || 'обычный'}.`,
      }),
    });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    await new Promise((resolve) => {
      const a = new Audio(url); currentAudio = a;
      a.onended = a.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
      a.play().catch(() => resolve());
    });
    return true;
  } catch (e) {
    console.warn('TTS error', e);
    chat('event', '⚠ Ошибка OpenAI TTS, перехожу на браузерный голос: ' + e.message);
    S.tts = 'browser';
    return false;
  }
}

function browserVoices() { return ('speechSynthesis' in window) ? speechSynthesis.getVoices() : []; }
function speakBrowser(p, text) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const voices = browserVoices();
    const v = voices.find(x => x.name === p.voiceB) ||
      voices.filter(x => x.lang.toLowerCase().startsWith(S.lang.toLowerCase().startsWith('рус') ? 'ru' : 'en'))[p.id % 3] || null;
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = Number(S.rate) || 1;
    u.pitch = 0.8 + ((p.id * 37) % 9) / 10;   // разная высота для разных игроков
    const t = setTimeout(resolve, 20000);
    u.onend = u.onerror = () => { clearTimeout(t); resolve(); };
    speechSynthesis.speak(u);
  });
}

async function say(p, text) {
  chat('', text, p.name, p.color);
  G.log.push(`${p.name}: ${text}`);
  $('subtitle').textContent = `${p.name}: ${text}`;
  p.bubble.textContent = text;
  p.el.classList.add('speaking');
  await speak(p, text);
  p.el.classList.remove('speaking');
}

/* ================= Ход игры ================= */
function setupGame() {
  const list = S.players.slice();
  const n = list.length;
  const mafiaCount = Math.max(1, Math.floor(n / 3));
  const roles = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
  roles.push('detective'); if (n >= 6) roles.push('doctor');
  while (roles.length < n) roles.push('civilian');
  const sh = shuffle(roles);
  G = {
    players: list.map((c, i) => ({
      id: i, name: c.name || 'Игрок ' + (i + 1), avatar: c.avatar, model: c.model, voiceO: c.voiceO, voiceB: c.voiceB,
      persona: c.persona, color: COLORS[i % COLORS.length], role: sh[i], alive: true, notes: [],
    })),
    log: [], night: 0, token: runToken,
  };
  G.players.forEach(p => { if (p.role === 'mafia') { const m = G.players.filter(x => x.role === 'mafia').map(x => x.name); } });
}

function winner() {
  const m = aliveOf('mafia').length, c = alive().length - m;
  if (m === 0) return 'town';
  if (m >= c) return 'mafia';
  return null;
}

async function nightPhase() {
  G.night++;
  setNight(true);
  setPhase(`Ночь ${G.night}`); setCenter('Город засыпает…');
  announce(`Наступает ночь ${G.night}. Город засыпает.`);
  $('subtitle').textContent = '🌙 Идут ночные действия…';
  await sleep(1200);

  // Мафия
  const mafia = aliveOf('mafia');
  const victimsCand = alive().filter(p => p.role !== 'mafia');
  const votes = {};
  for (const m of mafia) {
    m.el.classList.add('thinking');
    const t = isDemo() ? rnd(victimsCand) : await choose(m, 'Ночь. Выбери, кого убить (не своего сообщника).', victimsCand);
    m.el.classList.remove('thinking');
    votes[t.id] = (votes[t.id] || 0) + 1;
  }
  const victimId = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
  const victim = G.players[victimId];
  await gate();

  // Доктор
  let saved = null;
  const doc = aliveOf('doctor')[0];
  if (doc) {
    doc.el.classList.add('thinking');
    saved = isDemo() ? rnd(alive()) : await choose(doc, 'Ночь. Кого ты вылечишь этой ночью?', alive());
    doc.el.classList.remove('thinking');
  }
  await gate();

  // Комиссар
  const det = aliveOf('detective')[0];
  if (det) {
    det.el.classList.add('thinking');
    const cand = alive().filter(p => p !== det);
    const t = isDemo() ? rnd(cand) : await choose(det, 'Ночь. Кого ты проверишь на принадлежность к мафии?', cand);
    det.el.classList.remove('thinking');
    det.notes.push(`Проверка в ночь ${G.night}: ${t.name} — ${t.role === 'mafia' ? 'МАФИЯ' : 'не мафия'}.`);
  }
  await gate();

  setNight(false);
  setPhase(`День ${G.night}`); setCenter('Город просыпается');
  await sleep(800);
  if (saved && saved === victim) {
    announce('Город просыпается. Этой ночью никто не погиб — доктор спас жертву!');
  } else {
    victim.alive = false; refreshSeats();
    announce(`Город просыпается. Этой ночью был убит ${victim.name}. Его роль: ${ROLE_NAME[victim.role]}.`);
  }
}

async function dayPhase() {
  setCenter('Обсуждение');
  for (let r = 1; r <= S.rounds; r++) {
    announce(`Круг обсуждения ${r}.`);
    const order = alive();
    for (const p of order) {
      if (!p.alive) continue;
      await gate();
      const t = await speechTurn(p, r);
      await gate();
      await say(p, t);
      $('subtitle').textContent = '';
    }
  }
  // голосование
  setPhase(`Голосование (день ${G.night})`); setCenter('Голосование');
  announce('Голосование! Каждый называет, кого казнить.');
  const tally = {}, cand = alive();
  for (const p of alive()) {
    await gate();
    p.el.classList.add('thinking');
    const others = cand.filter(x => x !== p);
    const t = isDemo() ? rnd(others) : await choose(p, 'Голосование. За кого ты голосуешь, чтобы казнить его?', others);
    p.el.classList.remove('thinking');
    tally[t.id] = (tally[t.id] || 0) + 1;
    announce(`${p.name} голосует против ${t.name}.`, 'event');
    t.el.classList.add('target'); await sleep(450); t.el.classList.remove('target');
  }
  const max = Math.max(...Object.values(tally));
  const top = Object.keys(tally).filter(id => tally[id] === max);
  if (top.length > 1) {
    announce(`Голоса разделились (${top.map(i => G.players[i].name).join(', ')}). Никто не казнён.`);
  } else {
    const v = G.players[top[0]];
    v.alive = false; refreshSeats();
    announce(`Казнён ${v.name} (${max} гол.). Его роль: ${ROLE_NAME[v.role]}.`);
  }
}

async function runGame() {
  const token = ++runToken;
  setupGame(); renderTable(); $('chatLog').innerHTML = '';
  $('btnStart').disabled = true; $('btnPause').disabled = false; $('btnStop').disabled = false;
  if (isDemo()) chat('event', 'ℹ API ключ не задан — демо-режим (заготовленные реплики). Добавь ключ в настройках.');
  announce(`Игра началась! Игроков: ${G.players.length}. Мафии: ${G.players.filter(p => p.role === 'mafia').length}.`);
  G.players.forEach(p => {
    if (p.role === 'mafia') p.notes.push('Мафия: ' + G.players.filter(x => x.role === 'mafia').map(x => x.name).join(', '));
  });
  try {
    while (!winner()) {
      await nightPhase(); if (token !== runToken) return;
      if (winner()) break;
      await dayPhase(); if (token !== runToken) return;
    }
    const w = winner();
    setNight(false); setPhase('Игра окончена'); setCenter(w === 'town' ? 'Победил город' : 'Победила мафия');
    chat('win', w === 'town' ? '🏆 Победа мирных жителей!' : '🏆 Победа мафии!');
    document.body.classList.add('show-roles');
  } catch (e) {
    if (e !== 'stop') { console.error(e); chat('event', '⚠ Ошибка: ' + e.message); }
  } finally {
    if (token === runToken) { $('btnStart').disabled = false; $('btnPause').disabled = true; $('btnStop').disabled = true; paused = false; $('btnPause').textContent = '⏸ Пауза'; }
  }
}

/* ================= UI ================= */
$('btnStart').onclick = runGame;
$('btnPause').onclick = () => {
  paused = !paused;
  $('btnPause').textContent = paused ? '▶ Продолжить' : '⏸ Пауза';
  if ('speechSynthesis' in window) paused ? speechSynthesis.pause() : speechSynthesis.resume();
  if (currentAudio) paused ? currentAudio.pause() : currentAudio.play();
};
$('btnStop').onclick = () => {
  runToken++; paused = false; stopSpeaking(); setNight(false);
  $('btnStart').disabled = false; $('btnPause').disabled = true; $('btnStop').disabled = true;
  setPhase('Остановлено'); chat('event', 'Игра остановлена.');
  G && G.players.forEach(p => p.el.classList.remove('speaking', 'thinking'));
};

/* ===== Окно настроек ===== */
function voiceOptionsHTML(p) {
  if (S.tts === 'browser') {
    const v = browserVoices();
    return '<option value="">авто</option>' + v.map(x => `<option value="${x.name}" ${x.name === p.voiceB ? 'selected' : ''}>${x.name} (${x.lang})</option>`).join('');
  }
  return OPENAI_VOICES.map(x => `<option ${x === p.voiceO ? 'selected' : ''}>${x}</option>`).join('');
}

let draft = [];
function renderPlayersEditor() {
  const box = $('playersEditor'); box.innerHTML = '';
  draft.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'prow';
    row.innerHTML = `
      <input data-k="avatar" value="" title="Эмодзи или URL картинки" style="text-align:center;font-size:22px">
      <input data-k="name" placeholder="Имя">
      <input data-k="model" placeholder="модель (пусто = по умолчанию)" list="modelList">
      <select data-k="voice"></select>
      <button class="mini" title="Проверить голос">🔊</button>
      <button class="mini" title="Удалить">🗑</button>`;
    row.querySelector('[data-k=avatar]').value = p.avatar;
    row.querySelector('[data-k=name]').value = p.name;
    row.querySelector('[data-k=model]').value = p.model || '';
    const sel = row.querySelector('select'); sel.innerHTML = voiceOptionsHTML(p);
    row.querySelector('[data-k=avatar]').oninput = e => p.avatar = e.target.value;
    row.querySelector('[data-k=name]').oninput = e => p.name = e.target.value;
    row.querySelector('[data-k=model]').oninput = e => p.model = e.target.value;
    sel.onchange = e => { if (S.tts === 'browser') p.voiceB = e.target.value; else p.voiceO = e.target.value; };
    const [test, del] = row.querySelectorAll('button');
    test.onclick = async () => {
      readSettings();
      stopSpeaking();
      const fake = { ...p, id: i };
      await speak(fake, `Привет, меня зовут ${p.name}. Я здесь, чтобы найти мафию.`);
    };
    del.onclick = () => { if (draft.length > 5) { draft.splice(i, 1); renderPlayersEditor(); } else alert('Минимум 5 игроков'); };
    box.appendChild(row);
  });
}
function fillSettings() {
  $('sBase').value = S.base; $('sKey').value = S.key; $('sModel').value = S.model; $('sTemp').value = S.temp;
  $('sTts').value = S.tts; $('sTtsModel').value = S.ttsModel; $('sTtsBase').value = S.ttsBase; $('sTtsKey').value = S.ttsKey;
  $('sRate').value = S.rate; $('rateVal').textContent = S.rate; $('sLang').value = S.lang;
  $('sRounds').value = S.rounds; $('sShowRoles').checked = S.showRoles;
  draft = structuredClone(S.players); renderPlayersEditor();
}
function readSettings() {
  S.base = $('sBase').value.trim() || DEFAULTS.base; S.key = $('sKey').value; S.model = $('sModel').value.trim() || DEFAULTS.model;
  S.temp = $('sTemp').value || 0.9; S.tts = $('sTts').value; S.ttsModel = $('sTtsModel').value.trim();
  S.ttsBase = $('sTtsBase').value.trim(); S.ttsKey = $('sTtsKey').value; S.rate = $('sRate').value;
  S.lang = $('sLang').value.trim() || 'русский'; S.rounds = Math.max(1, Math.min(4, +$('sRounds').value || 2));
  S.showRoles = $('sShowRoles').checked; S.players = structuredClone(draft);
}
$('btnSettings').onclick = () => { fillSettings(); $('settingsModal').hidden = false; };
$('btnCloseSettings').onclick = () => { $('settingsModal').hidden = true; };
$('btnSave').onclick = () => {
  readSettings(); saveSettings(); $('settingsModal').hidden = true;
  document.body.classList.toggle('show-roles', !!S.showRoles);
  if (!G || $('btnStart').disabled === false) { G = null; previewTable(); }
};
$('sRate').oninput = e => $('rateVal').textContent = e.target.value;
$('sTts').onchange = () => { S.tts = $('sTts').value; renderPlayersEditor(); };
$('btnAddPlayer').onclick = () => {
  if (draft.length >= 10) return alert('Максимум 10 игроков');
  draft.push({ name: 'Игрок ' + (draft.length + 1), avatar: rnd(['😎', '🦊', '🐱', '🤖', '🧙', '👽']), model: '', voiceO: rnd(OPENAI_VOICES), voiceB: '', persona: '' });
  renderPlayersEditor();
};
$('btnReset').onclick = () => { draft = structuredClone(DEFAULT_PLAYERS); renderPlayersEditor(); };
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

/* предпросмотр стола до начала игры */
function previewTable() {
  G = {
    players: S.players.map((c, i) => ({ id: i, name: c.name, avatar: c.avatar, model: c.model, color: COLORS[i % COLORS.length], role: 'civilian', alive: true, notes: [] })),
    log: [],
  };
  renderTable(); document.body.classList.remove('show-roles');
  setCenter('Мафия'); setPhase('Ожидание начала');
}
previewTable();
