const PATTERNS = [
  { name: 'email', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { name: 'url', re: /\b(?:https?:\/\/|www\.)[^\s]+/gi },
  { name: 'phone', re: /(?:\+?\d[\s-]?){8,15}\d/g },
  { name: 'digits', re: /\b\d{5,}\b/g },
  { name: 'handle', re: /(?:^|[\s])@[a-z0-9._]{3,}/gi },
  { name: 'social', re: /\b(?:whatsapp|telegram|instagram|facebook|snapchat|discord)\b/gi },
  {
    name: 'spoken',
    re: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){4,}\b/gi,
  },
];

function maskText(input) {
  let text = String(input || '');
  let flagged = false;
  const hits = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) {
      flagged = true;
      hits.push(p.name);
      p.re.lastIndex = 0;
      text = text.replace(p.re, '[hidden]');
    }
    p.re.lastIndex = 0;
  }
  return { text: text.trim(), flagged, hits };
}

function maskFileName(name) {
  return maskText(name).text;
}

module.exports = { maskText, maskFileName };
