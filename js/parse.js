// Heuristic parser for pasted Swedish receipt text.
// Handles lines like:
//   "8 st Julbord 595,00 4 760,00"   "Julöl 6 x 79,00 474,00"
//   "3x Snaps O.P. 69"               "Glögg 2 st à 45 90,00"
//   "Julmust 39,00"                  "Kaffe   2   35,00   70,00"
// The result is meant to be reviewed/edited by the host afterwards.

const SKIP = /(?<!\p{L})(summa|delsumma|totalt?|att betala|moms|netto|brutto|kort|kontant|växel|betalt|betalning|kvitto|org\.?\s*nr|tel|telefon|datum|kassa|kassör|tack|välkommen|dricks|rabatt|visa|mastercard|amex|swish|avrundning|öresavrundning|bordsnr|bord nr|kvittonr|serveringsavgift|ref)(?!\p{L})/iu;
const NUM = /^\d+(?:[.,]\d{1,2})?$/;
const MARKERS = new Set(['x', '*', 'st', 'st.', 'stk', 'á', 'à', 'a', '@', 'kr', 'sek', ':-', '=']);

export function parseKr(str) {
  if (str == null) return NaN;
  let s = String(str).trim().toLowerCase().replace(/(kr|sek|:-)$/, '').replace(/\s+/g, '');
  if (!s) return NaN;
  // "1.234,50" -> "1234.50", "1,234.50" -> "1234.50"
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const v = Number(s);
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
}

const toNum = (t) => Number(t.replace(',', '.'));
const isInt = (t) => /^\d+$/.test(t);

// All ways to read the numeric tokens, optionally merging "4 760,00" -> "4760,00".
function segmentations(tokens) {
  if (!tokens.length) return [[]];
  const out = [];
  for (const rest of segmentations(tokens.slice(1))) out.push([{ t: tokens[0], merged: false }, ...rest]);
  if (tokens.length > 1 && /^\d{1,3}$/.test(tokens[0]) && /^\d{3}(?:[.,]\d{1,2})?$/.test(tokens[1])) {
    for (const rest of segmentations(tokens.slice(2))) out.push([{ t: tokens[0] + tokens[1], merged: true }, ...rest]);
  }
  return out;
}

const near = (a, b) => Math.abs(a - b) < 0.011;
const cents = (v) => near(v * 100, Math.round(v * 100));

function interpret(seg, prefixQty, xBetween) {
  const vals = seg.map((s) => toNum(s.t));
  const ints = seg.map((s) => isInt(s.t));
  const penalty = seg.filter((s) => s.merged).length * 0.5;
  const r = (score, qty, unit) => ({ score: score - penalty, qty, unit });
  const n = vals.length;
  if (n >= 3) {
    const [q, u, t] = vals.slice(-3);
    const qi = ints[n - 3];
    if (qi && q > 0 && near(q * u, t)) return r(10, q, u);
    if (prefixQty && near(prefixQty * vals[n - 2], vals[n - 1])) return r(6, prefixQty, vals[n - 2]);
    return r(1, prefixQty || 1, vals[n - 1] / (prefixQty || 1));
  }
  if (n === 2) {
    const [a, b] = vals;
    if (prefixQty && near(prefixQty * a, b)) return r(9, prefixQty, a);
    if (xBetween && ints[0] && a > 0) return r(8, a, b);
    if (!prefixQty && a > 0 && near(b / a, Math.round(b / a)) && Math.round(b / a) >= 1) return r(7, Math.round(b / a), a);
    if (!prefixQty && ints[0] && a > 0 && a <= 50 && cents(b / a)) return r(5, a, b / a);
    return r(2, prefixQty || 1, b / (prefixQty || 1));
  }
  if (n === 1) {
    const q = prefixQty || 1;
    return r(3, q, cents(vals[0] / q) ? vals[0] / q : vals[0]);
  }
  return null;
}

export function parseLine(raw) {
  let l = raw.replace(/\t/g, ' ').replace(/×/g, 'x').trim();
  if (!l || SKIP.test(l)) return null;
  l = l
    .replace(/(\d)\s*[x*]\s*(?=\d)/gi, '$1 x ') // 6x79 -> 6 x 79
    .replace(/^(\d{1,3})\s*[x*]\s*/i, '$1 x ') // 3x Snaps -> 3 x Snaps
    .replace(/(\d)\s*(kr|sek|:-)(?=\s|$)/gi, '$1 $2')
    .replace(/\s+/g, ' ');
  let tokens = l.split(' ');

  let prefixQty = null;
  if (tokens.length > 1 && isInt(tokens[0]) && +tokens[0] > 0 && +tokens[0] < 1000) {
    const nxt = tokens[1].toLowerCase();
    if (['x', '*', 'st', 'st.', 'stk'].includes(nxt)) { prefixQty = +tokens[0]; tokens = tokens.slice(2); }
    else if (/\p{L}/u.test(nxt)) { prefixQty = +tokens[0]; tokens = tokens.slice(1); }
  }

  let i = tokens.length;
  while (i > 0 && (NUM.test(tokens[i - 1]) || MARKERS.has(tokens[i - 1].toLowerCase()))) i--;
  const nameTokens = tokens.slice(0, i);
  // a marker word glued to the end of the name ("à") should not be in the name
  while (nameTokens.length && MARKERS.has(nameTokens[nameTokens.length - 1].toLowerCase())) nameTokens.pop();
  const name = nameTokens.join(' ').replace(/[\s.:-]+$/, '').trim();
  if (!/\p{L}/u.test(name)) return null;

  const tail = tokens.slice(i);
  const nums = tail.filter((t) => NUM.test(t));
  if (!nums.length) return null;
  const firstNumIdx = tail.findIndex((t) => NUM.test(t));
  const xBetween = tail.slice(firstNumIdx + 1).some((t) => ['x', '*', 'st', 'st.', 'á', 'à', 'a', '@'].includes(t.toLowerCase()));

  let best = null;
  for (const seg of segmentations(nums)) {
    const res = interpret(seg, prefixQty, xBetween);
    if (res && (!best || res.score > best.score)) best = res;
  }
  if (!best || !(best.unit > 0) || !(best.qty > 0)) return null;
  return { name, qty: Math.round(best.qty), unitOre: Math.round(best.unit * 100) };
}

export function parseReceipt(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(parseLine)
    .filter(Boolean);
}
