'use strict';

/* ================= Настройки ================= */
const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
// Провайдеры: у каждого свой ключ. kind: 'openai' = OpenAI-совместимый /chat/completions, 'anthropic' = родной Messages API
const PROVIDERS = {
  openai:     { name: 'OpenAI (GPT)',      kind: 'openai',    base: 'https://api.openai.com/v1', def: 'gpt-4o-mini', ph: 'sk-...', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5-mini'] },
  anthropic:  { name: 'Anthropic (Claude)', kind: 'anthropic', base: 'https://api.anthropic.com/v1', def: 'claude-haiku-5-5', ph: 'sk-ant-...', models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] },
  gemini:     { name: 'Google (Gemini)',    kind: 'openai',    base: 'https://generativelanguage.googleapis.com/v1beta/openai', def: 'gemini-2.5-flash', ph: 'AIza...', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'] },
  deepseek:   { name: 'DeepSeek',           kind: 'openai',    base: 'https://api.deepseek.com/v1', def: 'deepseek-chat', ph: 'sk-...', models: ['deepseek-chat', 'deepseek-reasoner'] },
  grok:       { name: 'xAI (Grok)',         kind: 'openai',    base: 'https://api.x.ai/v1', def: 'grok-3-mini', ph: 'xai-...', models: ['grok-3-mini', 'grok-3', 'grok-4'] },
  openrouter: { name: 'OpenRouter (любые модели)', kind: 'openai', base: 'https://openrouter.ai/api/v1', def: 'openai/gpt-4o-mini', ph: 'sk-or-...', models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat', 'x-ai/grok-3-mini', 'meta-llama/llama-3.3-70b-instruct'] },
  custom:     { name: 'Свой (OpenAI-совместимый)', kind: 'openai', base: '', def: '', ph: 'ключ', models: [], custom: true },
};
const PROV_IDS = Object.keys(PROVIDERS);
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
].map((p, i) => ({ provider: '', model: '', voiceB: '', voiceG: GEMINI_VOICES[i % GEMINI_VOICES.length], ...p }));

const DEFAULTS = {
  keys: {}, customBase: '', gTtsModel: 'gemini-2.5-flash-preview-tts', temp: 0.9,
  tts: 'openai', ttsModel: 'gpt-4o-mini-tts', rate: 1,
  lang: 'русский', rounds: 2, showRoles: true, players: DEFAULT_PLAYERS,
};

let S = loadSettings();
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('aimafia') || 'null');
    if (raw) {
      const st = { ...DEFAULTS, ...raw };
      st.keys = { ...(raw.keys || {}) };
      // миграция со старого формата (один общий ключ + отдельный Gemini)
      if (raw.key && !st.keys.openai) st.keys.openai = raw.key;
      if (raw.gKey && !st.keys.gemini) st.keys.gemini = raw.gKey;
      st.players = (raw.players || DEFAULT_PLAYERS).map(p => {
        p = { provider: '', ...p };
        if (/^gemini:/i.test(p.model || '')) { p.provider = 'gemini'; p.model = p.model.replace(/^gemini:/i, ''); }
        return p;
      });
      return st;
    }
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

function keyOf(prov) { return ((S.keys || {})[prov] || '').trim(); }
function hasKey(p) { return !!p.provider && !!keyOf(p.provider); }
function anyKey() { return PROV_IDS.some(k => keyOf(k)); }
function isDemo() { return !anyKey(); }

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
    const md = document.createElement('div'); md.className = 'model'; md.textContent = !p.provider ? '' : (hasKey(p) ? modelLabel(p) : 'демо');
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
function modelOf(p) { return (p.model || '').trim() || PROVIDERS[p.provider]?.def || ''; }
function modelLabel(p) { return modelOf(p) || '?'; }
function baseOf(prov) { return prov === 'custom' ? (S.customBase || '').trim().replace(/\/+$/, '') : PROVIDERS[prov].base; }

// Собирает запрос под конкретного провайдера. Возвращает {url, headers, body, parse}
function buildRequest(p, system, user, maxTokens) {
  const prov = PROVIDERS[p.provider], model = modelOf(p), key = keyOf(p.provider), temp = Number(S.temp);
  const base = baseOf(p.provider);
  if (prov.kind === 'anthropic') {
    return {
      url: base + '/messages',
      headers: {
        'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: { model, max_tokens: maxTokens, temperature: Math.min(1, temp), system, messages: [{ role: 'user', content: user }] },
      parse: j => (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(''),
    };
  }
  const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  if (p.provider === 'openai' && /^(o\d|gpt-5)/i.test(model)) {      // рассуждающие модели OpenAI
    body.max_completion_tokens = maxTokens + 1500; body.reasoning_effort = 'low';
  } else {
    body.temperature = temp;
    body.max_tokens = maxTokens;
    if (p.provider === 'gemini') { body.max_tokens += 1024; body.reasoning_effort = 'low'; }   // «мысли» не должны съесть лимит
    if (p.provider === 'grok' && /mini/i.test(model)) { body.max_tokens += 1024; body.reasoning_effort = 'low'; }
    if (/reasoner/i.test(model)) body.max_tokens += 2000;
  }
  return {
    url: base + '/chat/completions',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body,
    parse: j => j.choices?.[0]?.message?.content || '',
  };
}

async function llm(p, system, user, maxTokens = 220) {
  if (!hasKey(p)) return null;                       // нет ключа у провайдера игрока — он играет в демо-режиме
  const prov = PROVIDERS[p.provider], label = `${prov.name}, ${modelOf(p)}`;
  if (!modelOf(p)) { chat('event', `⚠ У ${p.name} не выбрана модель (${prov.name}).`); return null; }
  if (!baseOf(p.provider)) { chat('event', `⚠ У ${p.name} провайдер «Свой», но не указан Base URL.`); return null; }
  const rq = buildRequest(p, system, user, maxTokens);
  const MAX = 4;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60000);   // не зависаем навечно
    try {
      $('subtitle').textContent = `⏳ ${p.name} думает (${modelOf(p)})${attempt > 1 ? ', попытка ' + attempt : ''}…`;
      const r = await fetch(rq.url, { method: 'POST', signal: ctl.signal, headers: rq.headers, body: JSON.stringify(rq.body) });
      if (!r.ok) {
        const err = new Error(r.status + ' ' + (await r.text()).slice(0, 200));
        err.status = r.status; throw err;
      }
      const out = (rq.parse(await r.json()) || '').trim();
      if (!out) chat('event', `⚠ ${p.name} (${label}) вернул пустой ответ — использую запасной вариант.`);
      return out;
    } catch (e) {
      const isNet = e.name === 'TypeError';               // сеть / CORS
      const msg = e.name === 'AbortError' ? 'таймаут 60 с, нет ответа'
        : isNet ? 'сеть недоступна или провайдер блокирует запросы из браузера (CORS) — попробуй OpenRouter' : e.message;
      console.warn('LLM error', e);
      const retryable = e.name === 'AbortError' || e.status === 429 || e.status >= 500;
      if (!retryable || attempt === MAX) {
        chat('event', `⚠ Ошибка API (${p.name}, ${label}): ${msg}`); return null;
      }
      const wait = e.status === 429 ? attempt * 6000 : 1500;
      if (e.status === 429) chat('event', `⏳ Лимит запросов (429) у ${prov.name}, жду ${wait / 1000} с…`);
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
    if (S.tts === 'openai' && keyOf('openai')) return await fetchOpenAI(p, text);
    if (S.tts === 'gemini' && keyOf('gemini')) return await fetchGemini(p, text);
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
  const key = keyOf('openai');
  const base = PROVIDERS.openai.base;
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
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keyOf('gemini') },
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
async function say(p, text, url, tag) {
  chat(tag ? 'night' : '', text, p.name + (tag || ''), p.color);
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
// «Авто»: игроки без выбранного провайдера делят между собой провайдеров, у которых есть ключ
let autoIdx = 0;
function resolveProvider(c, i) {
  if (c.provider && PROVIDERS[c.provider]) return c.provider;
  const keyed = PROV_IDS.filter(k => keyOf(k));
  return keyed.length ? keyed[autoIdx++ % keyed.length] : '';
}
function setupGame() {
  autoIdx = 0;
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
      id: i, name: c.name || 'Игрок ' + (i + 1), avatar: c.avatar, provider: resolveProvider(c, i), model: c.model, voiceO: c.voiceO, voiceB: c.voiceB, voiceG: c.voiceG,
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

const NIGHT_DEMO = [
  'Думаю, {t} слишком активно ведёт себя за столом, его надо убирать. Мой выбор: {t}.',
  'Мне не нравится, как {t} смотрит на остальных — слишком внимательный. Мой выбор: {t}.',
  '{t} уже много говорил и может нас вычислить. Мой выбор: {t}.',
];
// Ночное действие: игрок вслух говорит, кого выбирает и почему. Возвращает {target, text}
async function nightAct(p, intro, cands) {
  const sys = systemPrompt(p);
  const usr = `Что происходит в игре:\n${publicLog()}\n\n${intro}\nВарианты: ${cands.map(c => c.name).join(', ')}.\n` +
    `Скажи вслух от первого лица 2–3 предложения: кого выбираешь и ПОЧЕМУ (опирайся на то, что реально звучало за столом). Закончи фразой «Мой выбор: Имя».`;
  p.el.classList.add('thinking');
  let text = await llm(p, sys, usr, 220);
  p.el.classList.remove('thinking');
  let target = null;
  if (!text) { target = rnd(cands); text = rnd(NIGHT_DEMO).replace(/\{t\}/g, target.name); }
  if (!target) {
    const i = text.toLowerCase().lastIndexOf('выбор');
    target = pickName(i >= 0 ? text.slice(i) : text, cands) || pickName(text, cands) || rnd(cands);
  }
  const url = await ttsPrepare(p, text);
  await gate();
  await say(p, text, url, ' 🌙');
  $('subtitle').textContent = '';
  return { target, text };
}

async function nightPhase() {
  G.night++;
  setNight(true);
  setPhase(`Ночь ${G.night}`); setCenter('Город засыпает…');
  announce(`Наступает ночь ${G.night}. Город засыпает.`);
  $('subtitle').textContent = '🌙 Идут ночные действия…';
  await sleep(1200);

  // ---- Мафия: вслух, по очереди, с причинами ----
  const mafia = aliveOf('mafia');
  const victimsCand = alive().filter(p => p.role !== 'mafia');
  announce('🔪 Просыпается мафия. Мафия тихо обсуждает, кого убрать этой ночью.');
  await sleep(900);
  const said = [], picks = [];
  for (const m of mafia) {
    await gate();
    const prev = said.length ? `Сообщники уже сказали: ${said.map(x => x.who + ': ' + x.text).join(' | ')}. Можешь согласиться или предложить другого. ` : '';
    const r = await nightAct(m, `Ночь ${G.night}. Ты в мафии и тихо шепчешься с сообщниками. ${prev}Выбери жертву (не сообщника).`, victimsCand);
    said.push({ who: m.name, text: r.text }); picks.push(r.target);
    mafia.forEach(x => x.notes.push(`Ночь ${G.night}, ${m.name} (мафия) сказал: ${r.text}`));
    await sleep(500);
  }
  const cnt = {};
  picks.forEach(t => { cnt[t.id] = (cnt[t.id] || 0) + 1; });
  const best = Math.max(...Object.values(cnt));
  const top = picks.filter(t => cnt[t.id] === best);
  const victim = top[top.length - 1];                   // при ничьей решает последний говоривший
  announce('Мафия сделала выбор и засыпает.', 'event');
  await sleep(700);

  // ---- Доктор ----
  let saved = null;
  const doc = aliveOf('doctor')[0];
  if (doc) {
    await gate();
    announce('💊 Просыпается доктор. Он решает, кого вылечить.');
    await sleep(700);
    const r = await nightAct(doc, `Ночь ${G.night}. Ты доктор. Реши, кого вылечить этой ночью (можно себя).`, alive());
    saved = r.target;
    doc.notes.push(`Ночь ${G.night}: я лечил ${saved.name}.`);
    announce('Доктор засыпает.', 'event');
    await sleep(500);
  }

  // ---- Комиссар ----
  const det = aliveOf('detective')[0];
  if (det) {
    await gate();
    announce('🔎 Просыпается комиссар. Он выбирает, кого проверить.');
    await sleep(700);
    const r = await nightAct(det, `Ночь ${G.night}. Ты комиссар. Реши, кого проверить на принадлежность к мафии.`, alive().filter(p => p !== det));
    const isMafia = r.target.role === 'mafia';
    det.notes.push(`Проверка в ночь ${G.night}: ${r.target.name} — ${isMafia ? 'МАФИЯ' : 'не мафия'}.`);
    chat('event', `🔎 Результат проверки (слышит только комиссар): ${r.target.name} — ${isMafia ? 'МАФИЯ' : 'не мафия'}.`);
    announce('Комиссар засыпает.', 'event');
    await sleep(600);
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
    const t = await choose(p, 'Голосование. За кого ты голосуешь, чтобы казнить его?', others);
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
  const keyless = G.players.filter(p => !hasKey(p));
  if (keyless.length) chat('event', `ℹ Без ключа (демо-фразы): ${keyless.map(p => p.name).join(', ')}. Добавь ключ провайдера в настройках.`);
  G.players.forEach(p => { if (p.el) p.el.querySelector('.model').textContent = hasKey(p) ? modelLabel(p) : 'демо'; });
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
      <select data-k="provider" title="Провайдер (чей ключ используется)"></select>
      <input data-k="model" placeholder="модель">
      <select data-k="voice"></select>
      <button class="mini" title="Проверить голос">🔊</button>
      <button class="mini" title="Удалить">🗑</button>`;
    row.querySelector('[data-k=avatar]').value = p.avatar;
    row.querySelector('[data-k=name]').value = p.name;
    row.querySelector('[data-k=model]').value = p.model || '';
    const sel = row.querySelector('select'); sel.innerHTML = voiceOptionsHTML(p);
    row.querySelector('[data-k=avatar]').oninput = e => p.avatar = e.target.value;
    row.querySelector('[data-k=name]').oninput = e => p.name = e.target.value;
    const provSel = row.querySelector('[data-k=provider]'), modelIn = row.querySelector('[data-k=model]');
    provSel.innerHTML = '<option value="">Авто (по очереди)</option>' +
      PROV_IDS.map(k => `<option value="${k}" ${k === p.provider ? 'selected' : ''}>${PROVIDERS[k].name}${keyOf(k) ? ' ✓' : ''}</option>`).join('');
    const dl = document.createElement('datalist'); dl.id = 'dl_model_' + i; row.appendChild(dl);
    modelIn.setAttribute('list', dl.id);
    const syncModel = () => {
      const pv = PROVIDERS[p.provider];
      dl.innerHTML = (pv ? pv.models : []).map(m => `<option value="${m}">`).join('');
      modelIn.placeholder = pv ? (pv.def ? 'по умолчанию: ' + pv.def : 'название модели') : 'авто: модель по умолчанию';
      modelIn.disabled = !pv;
    };
    syncModel();
    provSel.onchange = e => { p.provider = e.target.value; p.model = ''; modelIn.value = ''; syncModel(); };
    modelIn.oninput = e => p.model = e.target.value;
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
function renderProvKeys() {
  const box = $('provKeys'); box.innerHTML = '';
  PROV_IDS.forEach(k => {
    const pv = PROVIDERS[k];
    const l = document.createElement('label'); l.textContent = pv.name;
    const inp = document.createElement('input');
    inp.type = 'password'; inp.placeholder = pv.ph; inp.dataset.prov = k; inp.autocomplete = 'off';
    inp.value = (S.keys || {})[k] || '';
    l.appendChild(inp);
    if (pv.custom) {
      const b = document.createElement('input');
      b.id = 'sCustomBase'; b.placeholder = 'Base URL, напр. http://localhost:11434/v1'; b.value = S.customBase || '';
      l.appendChild(b);
    }
    box.appendChild(l);
  });
}
function fillSettings() {
  renderProvKeys();
  $('sGTtsModel').value = S.gTtsModel || ''; $('sTemp').value = S.temp;
  $('sTts').value = S.tts; $('sTtsModel').value = S.ttsModel;
  $('sRate').value = S.rate; $('rateVal').textContent = S.rate; $('sLang').value = S.lang;
  $('sRounds').value = S.rounds; $('sShowRoles').checked = S.showRoles;
  draft = structuredClone(S.players); renderPlayersEditor();
}
function readSettings() {
  S.keys = {};
  document.querySelectorAll('#provKeys input[data-prov]').forEach(i => { S.keys[i.dataset.prov] = i.value.trim(); });
  S.customBase = ($('sCustomBase') ? $('sCustomBase').value : S.customBase || '').trim();
  S.gTtsModel = $('sGTtsModel').value.trim() || DEFAULTS.gTtsModel;
  S.temp = $('sTemp').value || 0.9; S.tts = $('sTts').value; S.ttsModel = $('sTtsModel').value.trim();
  S.rate = $('sRate').value;
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
  draft.push({ name: 'Игрок ' + (draft.length + 1), avatar: rnd(['😎', '🦊', '🐱', '🤖', '🧙', '👽']), provider: '', model: '', voiceO: rnd(OPENAI_VOICES), voiceB: '', voiceG: rnd(GEMINI_VOICES), persona: '' });
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
