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
