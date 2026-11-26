// Tiny 16-bit-style pixel sprites drawn from character maps.
const PAL = {
  k: '#1a1020', w: '#f4f4f4', W: '#c9d6e3', y: '#f2b134', Y: '#ffe08a', o: '#d9732b',
  r: '#c8262c', R: '#8c1520', g: '#2f9e4a', G: '#1b5e31', b: '#a0602e', B: '#6b3a1c',
  p: '#f29aa0', s: '#f6c7a0', c: '#9fd8f0', C: '#4a90c0', m: '#7a1f3d', n: '#3a2210',
};

export const SPRITES = {
  beer: [
    '..wwwwww....',
    '.wwWwwwWw...',
    '.kkkkkkkk...',
    '.kyYyyyyk...',
    '.kyYyyyykkk.',
    '.kyYyoyyk.k.',
    '.kyYyyyyk.k.',
    '.kyYyyoyk.k.',
    '.kyYyyyykkk.',
    '.kyYyyyyk...',
    '.kyyyyyyk...',
    '.kkkkkkkk...',
  ],
  snaps: [
    '............',
    '............',
    '...kkkkkk...',
    '...kWwwWk...',
    '...kYyyYk...',
    '...kyyyyk...',
    '....kyyk....',
    '....kyyk....',
    '.....kk.....',
    '.....kk.....',
    '....kkkk....',
    '............',
  ],
  glogg: [
    '...W..W.....',
    '....W..W....',
    '...W..W.....',
    '.kkkkkkkk...',
    '.kwwwwwwkkk.',
    '.kwrRrRwk.k.',
    '.kwrrrrwk.k.',
    '.kwwwwwwkkk.',
    '.kwwrwwwk...',
    '.kwwwwwwk...',
    '..kkkkkk....',
    '............',
  ],
  wine: [
    '............',
    '..kkkkkkk...',
    '..kWwwwWk...',
    '..kmmmmmk...',
    '..kmRmmmk...',
    '...kmmmk....',
    '....kkk.....',
    '.....k......',
    '.....k......',
    '.....k......',
    '...kkkkk....',
    '............',
  ],
  coffee: [
    '....W.W.....',
    '...W.W......',
    '............',
    '.kkkkkkkk...',
    '.kwnnnnwkkk.',
    '.kwwwwwwk.k.',
    '.kwrwrwwkkk.',
    '.kwwwwwwk...',
    '..kwwwwk....',
    'kkkkkkkkkk..',
    '.kkkkkkkk...',
    '............',
  ],
  ham: [
    '............',
    '....kkkkk...',
    '..kkbbbbbkk.',
    '.kbbYbbYbbbk',
    '.kbbbbYbbbbk',
    'kbYbbbbbbYbk',
    'kbbbbbYbbbbk',
    'kppppppppppk',
    '.kpppppppppk',
    '..kkpppppkk.',
    'kwk.kkkkk...',
    'wwk.........',
  ],
  ginger: [
    '....kkkk....',
    '...kbbbbk...',
    '...kbwbwk...',
    '...kbbbbk...',
    '..kkbwwbkk..',
    '.kbbbbbbbbk.',
    '.kbbbrbbbbk.',
    '..kkbbbbkk..',
    '...kbrbbk...',
    '..kbbkkbbk..',
    '..kbk..kbk..',
    '..kk....kk..',
  ],
  must: [
    '.....kk.....',
    '.....kk.....',
    '....kRRk....',
    '....kRRk....',
    '...kRRRRk...',
    '...krrrrk...',
    '...kYYYYk...',
    '...kYrrYk...',
    '...kYYYYk...',
    '...krrrrk...',
    '...krrrrk...',
    '....kkkk....',
  ],
  gift: [
    '...yk..ky...',
    '....yyyy....',
    'kkkkkyykkkkk',
    'krrrryyrrrrk',
    'kRRRRyyRRRRk',
    'kkkkkyykkkkk',
    '.krrryyrrrk.',
    '.krrryyrrrk.',
    '.krrryyrrrk.',
    '.kRRRyyRRRk.',
    '.kkkkkkkkkk.',
    '............',
  ],
  tree: [
    '.....yy.....',
    '.....kk.....',
    '....kggk....',
    '...kgGgrk...',
    '...kggggk...',
    '..kgYgGggk..',
    '..kggggrgk..',
    '.kgGggggGgk.',
    '.kggrggYggk.',
    'kgggggggggGk',
    'kkkkkbbkkkkk',
    '.....bb.....',
  ],
  tomte: [
    '......kkk.......',
    '.....krrrk......',
    '....krrrrrk.....',
    '...krrrrrrrk.kk.',
    '..krrrrrrrrrkwwk',
    '.kwwwwwwwwwwkwwk',
    '.kwwwwwwwwwwk.kk',
    '.kssksssskssk...',
    '.kssssppssssk...',
    '.kwwssssssswk...',
    '.kwwwwwwwwwwk...',
    '..kwwwwwwwwk....',
    '..krrrwwrrrk....',
    '..krrYYYYrrk....',
    '..krrrrrrrrk....',
    '..kkk....kkk....',
  ],
  coin: [
    '...kkkkkk...',
    '..kYYYYYYk..',
    '.kYyyyyyyYk.',
    'kYyyykkyyyYk',
    'kYyykyyyyyYk',
    'kYyykyyyyyYk',
    'kYyykyyyyyYk',
    'kYyyykkyyyYk',
    '.kYyyyyyyYk.',
    '..kyyyyyyk..',
    '...kkkkkk...',
    '............',
  ],
};

export function sprite(name, cls = '') {
  const map = SPRITES[name] || SPRITES.gift;
  const w = Math.max(...map.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = map.length;
  c.className = 'sprite ' + cls;
  const ctx = c.getContext('2d');
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  return c;
}

export function iconFor(name) {
  const n = String(name).toLowerCase();
  if (/glögg/.test(n)) return 'glogg';
  if (/snaps|akvavit|aquavit|brännvin|shot|o\.?\s?p\.?|ålborg|skåne|nubbe|sup/.test(n)) return 'snaps';
  if (/julmust|must|läsk|vatten|cola|juice|alkoholfri|sodavatten|loka|ramlösa/.test(n)) return 'must';
  if (/öl|lager|ipa|pils|bira|stout|(^|\s)ale|porter|bärs|starköl/.test(n)) return 'beer';
  if (/vin|bubbel|cava|prosecco|champagne|cider|cremant|crémant/.test(n)) return 'wine';
  if (/kaffe|(^|\s)te(\s|$)|espresso|latte|cappuccino|avec|cognac|likör/.test(n)) return 'coffee';
  if (/dessert|ris à la|ris a la|tårta|glass|kaka|pepparkak|godis|kola|knäck|fudge|ostkaka/.test(n)) return 'ginger';
  if (/julbord|buffé|buffe|skinka|bord|middag|meny|mat|sill|lax|köttbull|prinskorv|revben|janssons|kuvert|vuxen|barn/.test(n)) return 'ham';
  return 'gift';
}
