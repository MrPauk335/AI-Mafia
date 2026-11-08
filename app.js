'use strict';

/* ================= Настройки ================= */
const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
const COLORS = ['#e0584a', '#e0a04a', '#7bc96f', '#4ab3e0', '#9a6be0', '#e06bb6', '#4ae0c0', '#c0c04a', '#e08a6b', '#6b8ae0'];

const DEFAULT_PLAYERS = [
  { name: 'Алиса', avatar: '👩‍🦰', voiceO: 'nova',    persona: 'эмоциональная, общительная' },
  { name: 'Борис', avatar: '🧔',    voiceO: 'onyx',    persona: 'спокойный, рассудительный' },
  { name: 'Вера',  avatar: '👵',    voiceO: 'shimmer', persona: 'подозрительная, наблюдательная' },
  { name: 'Глеб',  avatar: '🕵️',   voiceO: 'echo',    persona: 'саркастичный, любит давить на людей' },
  { name: 'Дана',  avatar: '👩‍🎤', voiceO: 'coral',   persona: 'импульсивная, шумная' },
  { name: 'Егор',  avatar: '🤓',    voiceO: 'ash',     persona: 'логик, строит версии по фактам' },
  { name: 'Жанна', avatar: '💃',    voiceO: 'sage',    persona: 'хитрая, дружелюбная' },
].map((p, i) => ({ model: '', voiceB: '', voiceG: GEMINI_VOICES[i % GEMINI_VOICES.length], ...p }));

const DEFAULTS = {
  base: 'https://api.openai.com/v1', key: '', gKey: '', gTtsModel: 'gemini-2.5-flash-preview-tts', model: 'gpt-4o-mini', temp: 0.9,
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

function isDemo() { return !S.key.trim() && !(S.gKey || '').trim(); }

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

// Куда слать запрос: модели "gemini:..." / "gemini-..." (при заданном Gemini-ключе) идут на Gemini,
// остальные — на основной Base URL. Если задан только Gemini-ключ, всё идёт на Gemini.
function resolveTarget(p) {
  let model = playerModel(p);
  const gKey = (S.gKey || '').trim(), key = (S.key || '').trim();
  const wantsG = /^gemini:/i.test(model) || (/^gemini-/i.test(model) && gKey) || (!key && gKey);
  if (wantsG) {
    model = model.replace(/^gemini:/i, '');
    if (!/^gemini-/i.test(model)) model = 'gemini-2.5-flash';
    return { gemini: true, url: GEMINI_BASE + '/chat/completions', key: gKey || key, model };
  }
  return { gemini: false, url: S.base.replace(/\/+$/, '') + '/chat/completions', key, model };
}

async function llm(p, system, user, maxTokens = 220) {
  if (isDemo()) return null;
  const t = resolveTarget(p);
  const url = t.url;
  const body = {
    model: t.model, temperature: Number(S.temp), max_tokens: t.gemini ? maxTokens + 1024 : maxTokens,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  if (t.gemini) body.reasoning_effort = 'low';   // чтобы «мысли» не съели лимит токенов
  const MAX = 4;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);   // не зависаем навечно
    try {
      $('subtitle').textContent = `⏳ ${p.name} думает (${t.model})${attempt > 1 ? ', попытка ' + attempt : ''}…`;
      const r = await fetch(url, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.key },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = new Error(r.status + ' ' + (await r.text()).slice(0, 200));
        err.status = r.status; throw err;
      }
      const j = await r.json();
      const out = (j.choices?.[0]?.message?.content || '').trim();
      if (!out) chat('event', `⚠ ${p.name} (${t.model}) вернул пустой ответ — использую запасной вариант.`);
      return out;
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'таймаут 45 с, нет ответа' : e.message;
      console.warn('LLM error', e);
      const retryable = e.name === 'AbortError' || e.status === 429 || e.status >= 500 || e.status === undefined;
      if (!retryable || attempt === MAX) {
        chat('event', `⚠ Ошибка API (${p.name}, ${t.model}): ${msg}`); return null;
      }
      const wait = e.status === 429 ? attempt * 6000 : 1500;
      if (e.status === 429) chat('event', `⏳ Лимит запросов (429) у ${t.gemini ? 'Gemini' : 'API'}, жду ${wait / 1000} с…`);
      await sleep(wait);
    } finally { clearTimeout(timer); }
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
const DEMO_INTROS = ['Всем привет, я {n}! Надеюсь, сегодня мы все друг друга поймём.', 'Здравствуйте, меня зовут {n}. Давайте играть честно.', 'Привет, народ! {n} на связи, рада видеть всех за столом.', 'Я {n}. Посмотрим, кто тут чем дышит.'];
function demoSpeech(p) {
  const t = rnd(alive().filter(x => x !== p));
  return rnd(DEMO_LINES).replace('{t}', t ? t.name : 'кто-то');
}

async function speechTurn(p, round) {
  const sys = systemPrompt(p);
  const usr = round === 0
    ? `Что происходит в игре:\n${publicLog()}\n\nИгра только началась, ночи ещё НЕ было, никто не погиб, улик нет. Идёт знакомство за столом. Твоя очередь: коротко поприветствуй всех и представься в своём характере (1–2 предложения, до 200 символов). Никого пока не обвиняй и не упоминай ночь.`
    : `Что происходит в игре:\n${publicLog()}\n\nСейчас день, круг обсуждения ${round}. Твоя очередь говорить. Скажи 1–3 коротких предложения: выскажи подозрение, защиту или версию. Не больше 250 символов.`;
  p.el.classList.add('thinking');
  let text = await llm(p, sys, usr, 160);
  p.el.classList.remove('thinking');
  if (!text) text = round === 0 ? rnd(DEMO_INTROS).replace('{n}', p.name) : demoSpeech(p);
  text = text.replace(/^\s*["«]|["»]\s*$/g, '').replace(new RegExp('^' + p.name + '\\s*[:—-]\\s*', 'i'), '');
  return text;
}

/* ================= TTS ================= */
let currentAudio = null;
function stopSpeaking() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// Подготовка аудио заранее: возвращает blob-URL или null (тогда играем браузерным голосом / тишиной)
async function ttsPrepare(p, text) {
  try {
    if (S.tts === 'openai' && (S.ttsKey || S.key).trim()) return await fetchOpenAI(p, text);
    if (S.tts === 'gemini' && (S.gKey || '').trim()) return await fetchGemini(p, text);
  } catch (e) {
    console.warn('TTS error', e);
    chat('event', `⚠ Ошибка озвучки (${S.tts}), перехожу на браузерный голос: ${e.message}`);
    S.tts = 'browser';
  }
  return null;
}

function playUrl(url) {
  return new Promise(resolve => {
    const a = new Audio(url); currentAudio = a;
    a.playbackRate = S.tts === 'gemini' ? Math.min(2, Math.max(0.5, Number(S.rate) || 1)) : 1;
    a.onended = a.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
    a.play().catch(() => resolve());
  });
}

async function speak(p, text, url) {
  if (url) return playUrl(url);
  if (S.tts === 'openai' || S.tts === 'gemini' || S.tts === 'browser') {
    // нет предзагруженного аудио (демо / ошибка) — пробуем подготовить на месте, иначе браузерный голос
    const u = (S.tts !== 'browser') ? await ttsPrepare(p, text) : null;
    if (u) return playUrl(u);
    return speakBrowser(p, text);
  }
  await sleep(Math.min(6000, 700 + text.length * 45));
}

async function fetchOpenAI(p, text) {
  const key = (S.ttsKey || S.key).trim();
  const base = (S.ttsBase || S.base).replace(/\/+$/, '');
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
  return URL.createObjectURL(await r.blob());
}

// Gemini TTS: generateContent -> base64 PCM (24 кГц, 16 бит, моно) -> WAV
function pcmToWav(pcm, rate = 24000) {
  const h = new ArrayBuffer(44), v = new DataView(h);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length, true);
  return new Blob([h, pcm], { type: 'audio/wav' });
}
async function fetchGemini(p, text) {
  const model = (S.gTtsModel || 'gemini-2.5-flash-preview-tts').trim();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.gKey.trim() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Скажи как живой человек за игровым столом (${p.persona || 'обычный характер'}): ${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voiceG || GEMINI_VOICES[p.id % GEMINI_VOICES.length] } } },
      },
    }),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  const b64 = j.candidates?.[0]?.content?.parts?.find(x => x.inlineData)?.inlineData?.data;
  if (!b64) throw new Error('нет аудио в ответе');
  const bin = atob(b64), pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  return URL.createObjectURL(pcmToWav(pcm));
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

// Показывает реплику и сразу играет уже загруженное аудио (текст и голос появляются вместе)
async function say(p, text, url) {
  chat('', text, p.name, p.color);
  $('subtitle').textContent = `${p.name}: ${text}`;
  p.bubble.textContent = text;
  p.el.classList.add('speaking');
  await speak(p, text, url);
  p.el.classList.remove('speaking');
}

// Готовит реплику: текст от модели -> сразу в лог (чтобы следующий игрок её видел),
// аудио грузится дальше в фоне. Возвращает {text, audio: Promise<url|null>}
async function prepTurn(p, round) {
  const text = await speechTurn(p, round);
  G.log.push(`${p.name}: ${text}`);
  return { p, text, audio: ttsPrepare(p, text) };
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
      id: i, name: c.name || 'Игрок ' + (i + 1), avatar: c.avatar, model: c.model, voiceO: c.voiceO, voiceB: c.voiceB, voiceG: c.voiceG,
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

// Знакомство перед первой ночью: каждый представляется (круг 0)
async function introPhase() {
  setPhase('Знакомство'); setCenter('Знакомство');
  await runTurns(alive().map(p => ({ p, r: 0 })));
  await sleep(600);
}

async function dayPhase() {
  setCenter('Обсуждение');
  const order = alive(), turns = [];
  for (let r = 1; r <= S.rounds; r++) order.forEach(p => turns.push({ p, r }));
  await runTurns(turns);
  await voting();
}

// Конвейер: пока текущий игрок говорит, следующий уже думает и озвучивается
async function runTurns(turns) {
  let pending = prepTurn(turns[0].p, turns[0].r);
  for (let i = 0; i < turns.length; i++) {
    const { p, r } = turns[i];
    if (i === 0 || turns[i - 1].r !== r) announce(r === 0 ? 'Игроки знакомятся за столом.' : `Круг обсуждения ${r}.`);
    await gate();
    const cur = await pending;                       // текст готов
    pending = i + 1 < turns.length ? prepTurn(turns[i + 1].p, turns[i + 1].r) : null;
    pending && pending.catch(() => {});              // ошибки разберём, когда дойдёт очередь
    const url = await cur.audio;                     // аудио готово — теперь показываем текст и играем
    await gate();
    await say(p, cur.text, url);
    $('subtitle').textContent = '';
  }
}

async function voting() {
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
    await introPhase(); if (token !== runToken) return;
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
  if (S.tts === 'gemini') return GEMINI_VOICES.map(x => `<option ${x === p.voiceG ? 'selected' : ''}>${x}</option>`).join('');
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
    sel.onchange = e => { if (S.tts === 'browser') p.voiceB = e.target.value; else if (S.tts === 'gemini') p.voiceG = e.target.value; else p.voiceO = e.target.value; };
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
  $('sGKey').value = S.gKey || ''; $('sGTtsModel').value = S.gTtsModel || '';
  $('sBase').value = S.base; $('sKey').value = S.key; $('sModel').value = S.model; $('sTemp').value = S.temp;
  $('sTts').value = S.tts; $('sTtsModel').value = S.ttsModel; $('sTtsBase').value = S.ttsBase; $('sTtsKey').value = S.ttsKey;
  $('sRate').value = S.rate; $('rateVal').textContent = S.rate; $('sLang').value = S.lang;
  $('sRounds').value = S.rounds; $('sShowRoles').checked = S.showRoles;
  draft = structuredClone(S.players); renderPlayersEditor();
}
function readSettings() {
  S.gKey = $('sGKey').value; S.gTtsModel = $('sGTtsModel').value.trim() || DEFAULTS.gTtsModel;
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
  draft.push({ name: 'Игрок ' + (draft.length + 1), avatar: rnd(['😎', '🦊', '🐱', '🤖', '🧙', '👽']), model: '', voiceO: rnd(OPENAI_VOICES), voiceB: '', voiceG: rnd(GEMINI_VOICES), persona: '' });
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
