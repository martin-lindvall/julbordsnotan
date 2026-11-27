// Pure bill math. All amounts in öre (integers) to avoid float rounding.

export function kr(ore, { decimals } = {}) {
  const d = decimals ?? (ore % 100 ? 2 : 0);
  return (ore / 100).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' kr';
}

// 1.5 -> "1½", 0.5 -> "½", 2 -> "2"
export function qty(n) {
  const whole = Math.floor(n + 1e-9);
  const half = n - whole > 0.25;
  return half ? (whole ? whole + '½' : '½') : String(whole);
}

export function claimedOf(bill, itemId) {
  return Object.values(bill.people || {}).reduce((s, p) => s + ((p.claims || {})[itemId] || 0), 0);
}

export function compute(bill) {
  const items = (bill.items || []).map((it) => {
    const claimed = claimedOf(bill, it.id);
    return { ...it, claimed, left: Math.max(0, it.qty - claimed) };
  });
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const people = Object.entries(bill.people || {})
    .map(([id, p]) => {
      // claims may be halves (0.5, 1.5 …); round to whole öre
      const itemsOre = Math.round(Object.entries(p.claims || {}).reduce((s, [iid, n]) => s + (byId[iid] ? byId[iid].unitOre * n : 0), 0));
      const count = Object.values(p.claims || {}).reduce((s, n) => s + n, 0);
      return { id, ...p, itemsOre, count, tipOre: 0 };
    })
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id));

  // Tip split evenly among everyone who has claimed something; spare öre go to the earliest joiners.
  const tip = bill.tipOre || 0;
  const eaters = people.filter((p) => p.itemsOre > 0);
  if (eaters.length && tip) {
    const base = Math.floor(tip / eaters.length);
    let rest = tip - base * eaters.length;
    for (const p of eaters) { p.tipOre = base + (rest > 0 ? 1 : 0); rest--; }
  }
  for (const p of people) {
    p.owedOre = p.itemsOre + p.tipOre;
    const paid = p.host ? p.owedOre : p.paidOre || 0;
    p.unpaidOre = Math.max(0, p.owedOre - paid);
    p.overpaidOre = p.host ? 0 : Math.max(0, paid - p.owedOre);
  }
  const itemsTotalOre = items.reduce((s, i) => s + i.qty * i.unitOre, 0);
  const totalOre = itemsTotalOre + tip;
  const unclaimedOre = Math.round(items.reduce((s, i) => s + i.left * i.unitOre, 0)) + (eaters.length ? 0 : tip);
  const unswishedOre = people.reduce((s, p) => s + p.unpaidOre, 0);
  const leftOre = unclaimedOre + unswishedOre;
  return { items, people, itemsTotalOre, totalOre, unclaimedOre, unswishedOre, leftOre };
}
