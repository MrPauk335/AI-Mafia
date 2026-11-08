'use strict';
/* Аватарки по модели.
   assets/avatars.webp — лист 10×4: у каждого бренда 4 арт-варианта мафиози + логотип (5-я ячейка группы).
   Бренды, которых нет на листе, рисуются SVG-шаблоном «мафиози с эмблемой». */

// Координаты ячеек на листе (px, размер ячейки 166×166, лист 1759×707)
const SHEET = { w: 1759, h: 707, cell: 166 };
const COLX = [5, 181, 356, 532, 707, 883, 1058, 1234, 1409, 1585];
const ROWY = [3, 179, 354, 530];
// r — строка листа, g — левая (0) или правая (1) группа из 5 ячеек
const SPRITE = {
  qwen:     { r: 0, g: 0 }, mistral:  { r: 0, g: 1 },
  grok:     { r: 1, g: 0 }, meta:     { r: 1, g: 1 },
  deepseek: { r: 2, g: 0 }, claude:   { r: 2, g: 1 },
  gemini:   { r: 3, g: 0 }, openai:   { r: 3, g: 1 },
};

// Бренды вне листа: цвет эмблемы и знак на «лице»
const EXTRA = {
  kimi:       { color: '#3b82f6', glyph: 'K' },
  glm:        { color: '#22d3ee', glyph: 'Z' },
  perplexity: { color: '#2dd4bf', glyph: 'P' },
  cohere:     { color: '#f472b6', glyph: 'C' },
  microsoft:  { color: '#38bdf8', glyph: 'M' },
  nvidia:     { color: '#76b900', glyph: 'N' },
  amazon:     { color: '#ff9900', glyph: 'A' },
  minimax:    { color: '#f43f5e', glyph: 'X' },
};

// Определяем бренд по названию модели (работает и для OpenRouter вида "meta-llama/..."), иначе по провайдеру
const BRAND_RULES = [
  [/claude|anthropic/, 'claude'],
  [/gemini|gemma|google/, 'gemini'],
  [/deepseek/, 'deepseek'],
  [/grok|x-ai|xai/, 'grok'],
  [/llama|meta-/, 'meta'],
  [/mistral|mixtral|codestral|ministral|pixtral/, 'mistral'],
  [/qwen|qwq|alibaba/, 'qwen'],
  [/kimi|moonshot/, 'kimi'],
  [/glm|zhipu|z-ai/, 'glm'],
  [/sonar|perplexity|pplx/, 'perplexity'],
  [/command|cohere/, 'cohere'],
  [/(^|[\/\-])phi-|microsoft|wizardlm/, 'microsoft'],
  [/nemotron|nvidia/, 'nvidia'],
  [/nova-|amazon/, 'amazon'],
  [/minimax|abab/, 'minimax'],
  [/gpt|chatgpt|openai|(^|[\/\-:])o\d/, 'openai'],
];
const PROVIDER_BRAND = { openai: 'openai', anthropic: 'claude', gemini: 'gemini', deepseek: 'deepseek', grok: 'grok' };
function brandOf(provider, model) {
  const m = (model || '').toLowerCase();
  for (const [re, b] of BRAND_RULES) if (re.test(m)) return b;
  return PROVIDER_BRAND[provider] || null;
}

// Имя игрока = название его нейросети, голос подобран под «характер» бренда.
// o — голос OpenAI TTS, g — голос Gemini TTS, e — голос ElevenLabs (имя из стандартных)
const BRAND_INFO = {
  openai:     { name: 'ChatGPT',    o: 'alloy',   g: 'Kore',       e: 'Rachel' },   // ровный, универсальный
  claude:     { name: 'Claude',     o: 'sage',    g: 'Charon',     e: 'Adam' },     // спокойный, вдумчивый
  gemini:     { name: 'Gemini',     o: 'nova',    g: 'Puck',       e: 'Bella' },    // живой, бодрый
  deepseek:   { name: 'DeepSeek',   o: 'onyx',    g: 'Fenrir',     e: 'Antoni' },   // низкий, основательный
  grok:       { name: 'Grok',       o: 'ash',     g: 'Orus',       e: 'Josh' },     // дерзкий, с хрипотцой
  meta:       { name: 'Llama',      o: 'echo',    g: 'Iapetus',    e: 'Sam' },      // дружелюбный, простой
  mistral:    { name: 'Mistral',    o: 'coral',   g: 'Aoede',      e: 'Domi' },     // лёгкий, элегантный
  qwen:       { name: 'Qwen',       o: 'shimmer', g: 'Zephyr',     e: 'Elli' },     // мягкий, чёткий
  kimi:       { name: 'Kimi',       o: 'fable',   g: 'Umbriel',    e: 'Arnold' },
  glm:        { name: 'GLM',        o: 'verse',   g: 'Algieba',    e: 'Rachel' },
  perplexity: { name: 'Perplexity', o: 'ballad',  g: 'Callirrhoe', e: 'Bella' },
  cohere:     { name: 'Cohere',     o: 'coral',   g: 'Despina',    e: 'Domi' },
  microsoft:  { name: 'Phi',        o: 'alloy',   g: 'Achird',     e: 'Josh' },
  nvidia:     { name: 'Nemotron',   o: 'onyx',    g: 'Alnilam',    e: 'Arnold' },
  amazon:     { name: 'Nova',       o: 'nova',    g: 'Sulafat',    e: 'Elli' },
  minimax:    { name: 'MiniMax',    o: 'echo',    g: 'Gacrux',     e: 'Antoni' },
};

// Рисует аватарку-мафиози с эмблемой бренда. v: 0..3 — вариант оформления рамки и пера
function svgAvatar(brand, v = 0) {
  const { color: c, glyph } = EXTRA[brand];
  const ring = [
    `<circle cx="100" cy="100" r="95" fill="none" stroke="${c}" stroke-width="3"/><circle cx="100" cy="100" r="88" fill="none" stroke="#fff" stroke-opacity=".18"/>`,
    `<circle cx="100" cy="100" r="95" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="10 6"/>`,
    `<circle cx="100" cy="100" r="96" fill="none" stroke="${c}" stroke-width="2"/><circle cx="100" cy="100" r="89" fill="none" stroke="${c}" stroke-width="2" stroke-opacity=".6"/>`,
    `<circle cx="100" cy="100" r="95" fill="none" stroke="#d9b46a" stroke-width="4"/><circle cx="100" cy="100" r="88" fill="none" stroke="${c}" stroke-opacity=".5"/>`,
  ][v % 4];
  const flip = v % 2 ? 'translate(200 0) scale(-1 1)' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
<radialGradient id="bg" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${c}" stop-opacity=".5"/><stop offset="1" stop-color="#06070c"/></radialGradient>
<radialGradient id="gl"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
<clipPath id="cp"><circle cx="100" cy="100" r="96"/></clipPath>
</defs>
<rect width="200" height="200" fill="url(#bg)"/>
<g clip-path="url(#cp)"><g transform="${flip}">
<path d="M22 205 Q30 150 80 140 L120 140 Q170 150 178 205Z" fill="#14151d" stroke="#2b2d3d" stroke-width="2"/>
<path d="M80 140 L100 178 L120 140 L112 138 L100 160 L88 138Z" fill="#0c0d14"/>
<path d="M86 140 L100 172 L114 140Z" fill="#e8e9f2"/>
<path d="M96 152 L104 152 L108 192 L100 200 L92 192Z" fill="${c}"/>
<ellipse cx="100" cy="106" rx="31" ry="35" fill="#0c0d14" stroke="${c}" stroke-opacity=".7" stroke-width="2"/>
<circle cx="100" cy="106" r="32" fill="url(#gl)" opacity=".5"/>
<text x="100" y="121" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="800" fill="#fff" stroke="${c}" stroke-width="1.2">${glyph}</text>
<ellipse cx="100" cy="72" rx="54" ry="11" fill="#08080e" stroke="#2b2d3d" stroke-width="2"/>
<path d="M66 72 Q64 32 100 30 Q136 32 134 72Z" fill="#101118" stroke="#2b2d3d" stroke-width="2"/>
<path d="M66 64 Q100 74 134 64 L134 72 Q100 82 66 72Z" fill="${c}"/>
<path d="M128 56 Q152 34 164 44 Q152 54 132 64Z" fill="${c}" opacity=".9"/>
</g></g>${ring}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* ===== Шарики в шляпах (стиль стрима): круглый персонаж с фетровой шляпой, злыми глазами и ртом, который открывается при речи ===== */
const BALL_COLORS = {
  openai:     ['#2de0b0', '#1f7ae0', '#243b9c'],
  claude:     ['#f3a06a', '#d9622b', '#8a3a14'],
  gemini:     ['#3f8cff', '#ea4a4a', '#f8c630', '#37b05a'],
  deepseek:   ['#7db6f2', '#3a74c4', '#1d3f7a'],
  grok:       ['#5a5a5e', '#26262a', '#0a0a0c'],
  meta:       ['#5bb0ff', '#1470e6', '#0b3a8a'],
  mistral:    ['#ffd84a', '#ff8a1a', '#e03a0a'],
  qwen:       ['#b48cff', '#7a3fe0', '#3b1a86'],
  kimi:       ['#6aa6ff', '#3b82f6', '#1b3f99'],
  glm:        ['#6ee7f5', '#22b8d6', '#0e6b80'],
  perplexity: ['#5eead4', '#14a89a', '#0a5a55'],
  cohere:     ['#f9a8d4', '#ec4899', '#9d174d'],
  microsoft:  ['#7dd3fc', '#2b9be0', '#1a4f8a'],
  nvidia:     ['#a3e635', '#76b900', '#3d6600'],
  amazon:     ['#ffc14d', '#ff9900', '#b35a00'],
  minimax:    ['#fb7185', '#e11d48', '#7f1030'],
};
let _ballId = 0;
// brand — бренд (или null), color — запасной цвет, v — вариант настроения (0 злой, 1 встревоженный, 2 хмурый), look — куда смотрят зрачки (-1..1)
function ballSvg(brand, color, v = 0, look = 0) {
  const id = 'b' + (++_ballId);
  let cols = BALL_COLORS[brand];
  if (!cols) { const c = color || '#8a8fb0'; cols = [c, c, '#14151f']; }
  const stops = cols.map((c, i) => `<stop offset="${(i / (cols.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const dx = Math.round(look * 7);
  // брови: (x1,y1 внешний край) -> (x2,y2 внутренний край)
  const brows = [
    ['M38 98 L88 122', 'M162 98 L112 122'],     // злой
    ['M40 122 L88 100', 'M160 122 L112 100'],   // встревоженный
    ['M40 108 L88 112', 'M160 108 L112 112'],   // хмурый
  ][v % 3];
  return `<svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
<linearGradient id="${id}g" x1="0.1" y1="0" x2="0.9" y2="1">${stops}</linearGradient>
<radialGradient id="${id}h" cx="0.32" cy="0.25" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="100" cy="222" rx="62" ry="6" fill="#000" opacity=".28"/>
<circle cx="100" cy="135" r="82" fill="url(#${id}g)" stroke="#000" stroke-opacity=".4" stroke-width="3"/>
<circle cx="100" cy="135" r="82" fill="url(#${id}h)"/>
<g>
<ellipse cx="68" cy="132" rx="23" ry="27" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width="2.5"/>
<ellipse cx="132" cy="132" rx="23" ry="27" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width="2.5"/>
<circle cx="${68 + dx}" cy="136" r="10.5" fill="#101018"/><circle cx="${132 + dx}" cy="136" r="10.5" fill="#101018"/>
<circle cx="${64 + dx}" cy="131" r="3.4" fill="#fff"/><circle cx="${128 + dx}" cy="131" r="3.4" fill="#fff"/>
</g>
<g stroke="#0d0d14" stroke-width="11" stroke-linecap="round" fill="none"><path d="${brows[0]}"/><path d="${brows[1]}"/></g>
<path class="m-closed" d="M76 188 Q100 174 124 188" stroke="#0d0d14" stroke-width="7" stroke-linecap="round" fill="none"/>
<g class="m-open">
<path d="M72 178 Q100 166 128 178 Q122 210 100 210 Q78 210 72 178Z" fill="#2a0c10" stroke="#0d0d14" stroke-width="4" stroke-linejoin="round"/>
<path d="M77 178 Q100 168 123 178 L121 187 Q100 180 79 187Z" fill="#fff"/>
<ellipse cx="100" cy="203" rx="13" ry="6" fill="#d8434f"/>
</g>
<g transform="rotate(-5 100 70)">
<ellipse cx="100" cy="72" rx="76" ry="15" fill="#15151b" stroke="#3a3a46" stroke-width="2"/>
<path d="M58 70 Q54 20 100 18 Q146 20 142 70Z" fill="#23232b" stroke="#3a3a46" stroke-width="2"/>
<path d="M100 18 Q92 30 100 38 Q108 30 100 18Z" fill="#15151b"/>
<path d="M58 60 Q100 74 142 60 L142 70 Q100 84 58 70Z" fill="#4a4a58"/>
</g>
</svg>`;
}
