import { getBackend } from './store.js';
import { parseReceipt, parseKr } from './parse.js';
import { sprite, iconFor } from './sprites.js';
import { compute, kr, claimedOf } from './calc.js';
import * as audio from './audio.js';
import { startSnow, floatText, shake, confetti } from './fx.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};

let backend;
let unsub = null;

// ---------------------------------------------------------------- shell
function soundButtons() {
  const bar = $('#sound');
  const paint = () => {
    bar.innerHTML = `
      <button class="chip px ${audio.isSfxOn() ? 'on' : ''}" data-s="sfx" aria-pressed="${audio.isSfxOn()}" title="Ljudeffekter">${audio.isSfxOn() ? '🔊' : '🔇'} LJUD</button>
      <button class="chip px ${audio.isMusicOn() ? 'on' : ''}" data-s="music" aria-pressed="${audio.isMusicOn()}" title="Musik">♪ MUSIK</button>`;
  };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.dataset.s === 'sfx' ? audio.toggleSfx() : audio.toggleMusic();
    paint();
  });
  paint();
}

function demoBanner() {
  return backend.kind === 'local'
    ? `<div class="banner px">DEMOLÄGE – allt sparas bara i den här webbläsaren. Lägg in Firebase i <code>js/config.js</code> för att dela på riktigt.</div>`
    : '';
}

function route() {
  if (unsub) { unsub(); unsub = null; }
  const m = location.hash.match(/^#\/b\/([a-z0-9]+)/i);
  window.scrollTo(0, 0);
  if (m) renderBill(m[1]);
  else renderCreate();
}

// ---------------------------------------------------------------- create view
function renderCreate() {
  document.title = 'Julbordsnotan';
  const mine = ls.get('jn:mine', []);
  app.innerHTML = `
    ${demoBanner()}
    <section class="panel hero center">
      <div class="hero-sprites" id="hero-sprites"></div>
      <h1 class="px title">JULBORDS<br>NOTAN</h1>
      <p class="tag">Dela notan. Plocka dina grejer. Swisha värden. God jul!</p>
    </section>

    <section class="panel">
      <h2 class="px h">1. VÄRDEN</h2>
      <label>Vad heter kalaset?<input id="c-title" value="Julbordet ${new Date().getFullYear()}" maxlength="60"></label>
      <label>Ditt namn<input id="c-host" placeholder="t.ex. Martin" maxlength="24" autocomplete="given-name"></label>
      <label>Ditt Swish-nummer<input id="c-swish" placeholder="070-123 45 67" inputmode="tel" maxlength="20" autocomplete="tel"></label>
    </section>

    <section class="panel">
      <h2 class="px h">2. KVITTOT</h2>
      <label>Klistra in kvittot som text
        <textarea id="c-receipt" rows="7" placeholder="8 st Julbord 595,00 4 760,00&#10;Julöl 6 x 79,00 474,00&#10;Snaps O.P. 3 69,00 207,00&#10;Julmust 39,00"></textarea>
      </label>
      <p class="hint">Tips: på mobilen kan du markera texten i en bild av kvittot (Live Text / Google Lens) och klistra in här.</p>
      <button class="btn green" id="c-parse">TOLKA KVITTOT ▸</button>

      <div class="rows-head"><span>Antal</span><span>Vara</span><span>á-pris</span><span></span></div>
      <div id="c-rows" class="rows"></div>
      <button class="btn small ghost" id="c-add">+ LÄGG TILL RAD</button>

      <label>Dricks i kronor (delas lika mellan alla som ätit)<input id="c-tip" inputmode="decimal" placeholder="0"></label>
      <label>Kvittots totalsumma (valfritt, för kontroll)<input id="c-check" inputmode="decimal" placeholder="t.ex. 6143"></label>
      <div id="c-sum" class="sum"></div>
    </section>

    <button class="btn big" id="c-create">SKAPA NOTAN ▸</button>
    <p class="err" id="c-err" role="alert"></p>

    ${mine.length ? `<section class="panel"><h2 class="px h">DINA NOTOR</h2><ul class="mine-list">${mine
      .slice().reverse().map((b) => `<li><a href="#/b/${esc(b.id)}">${esc(b.title)}</a> <span class="muted">${new Date(b.createdAt).toLocaleDateString('sv-SE')}</span></li>`).join('')}</ul></section>` : ''}
  `;
  const hs = $('#hero-sprites');
  ['tree', 'tomte', 'gift'].forEach((n) => hs.appendChild(sprite(n, n === 'tomte' ? 'xl bob' : 'lg')));

  const last = ls.get('jn:host', {});
  if (last.name) $('#c-host').value = last.name;
  if (last.swish) $('#c-swish').value = last.swish;

  const rows = $('#c-rows');
  const addRow = (r = { qty: 1, name: '', unitOre: '' }) => {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `
      <input class="q" inputmode="numeric" value="${esc(r.qty)}" aria-label="Antal">
      <input class="n" value="${esc(r.name)}" placeholder="Vara" aria-label="Vara" maxlength="40">
      <input class="p" inputmode="decimal" value="${r.unitOre === '' ? '' : esc((r.unitOre / 100).toFixed(2).replace('.', ','))}" placeholder="0,00" aria-label="Pris per styck">
      <button class="x" aria-label="Ta bort rad">✕</button>`;
    rows.appendChild(div);
    updateSum();
  };
  const readRows = () => [...rows.querySelectorAll('.row')].map((r) => ({
    qty: parseInt($('.q', r).value, 10),
    name: $('.n', r).value.trim(),
    unitOre: parseKr($('.p', r).value),
  }));
  function updateSum() {
    const valid = readRows().filter((r) => r.qty > 0 && r.name && r.unitOre > 0);
    const items = valid.reduce((s, r) => s + r.qty * r.unitOre, 0);
    const tip = parseKr($('#c-tip').value) || 0;
    const check = parseKr($('#c-check').value);
    let html = `Varor: <b>${kr(items)}</b>${tip ? ` + dricks <b>${kr(tip)}</b>` : ''} = <b class="gold">${kr(items + tip)}</b>`;
    if (check > 0) {
      html += Math.abs(check - items) < 100 || Math.abs(check - items - tip) < 100
        ? `<br><span class="ok">✓ Stämmer med kvittot!</span>`
        : `<br><span class="bad">⚠ Kvittot säger ${kr(check)} – skillnad ${kr(check - items)}. Kolla raderna!</span>`;
    }
    $('#c-sum').innerHTML = html;
  }
  rows.addEventListener('input', updateSum);
  rows.addEventListener('click', (e) => {
    if (e.target.closest('.x')) { e.target.closest('.row').remove(); audio.play('down'); updateSum(); }
  });
  $('#c-tip').addEventListener('input', updateSum);
  $('#c-check').addEventListener('input', updateSum);
  $('#c-add').addEventListener('click', () => { addRow(); audio.play('click'); rows.lastElementChild.querySelector('.n').focus(); });
  $('#c-parse').addEventListener('click', (e) => {
    const parsed = parseReceipt($('#c-receipt').value);
    if (!parsed.length) { audio.play('nope'); shake(e.target); $('#c-err').textContent = 'Hittade inga rader. Lägg till dem för hand nedan.'; return; }
    $('#c-err').textContent = '';
    // drop empty rows before adding parsed ones
    [...rows.querySelectorAll('.row')].forEach((r) => { if (!$('.n', r).value.trim()) r.remove(); });
    parsed.forEach(addRow);
    audio.play('join');
    floatText(e.target, `${parsed.length} RADER!`);
  });
  addRow();

  $('#c-create').addEventListener('click', async (e) => {
    const err = $('#c-err');
    const title = $('#c-title').value.trim() || 'Julbordet';
    const host = $('#c-host').value.trim();
    const swish = $('#c-swish').value.trim();
    const tipOre = parseKr($('#c-tip').value) || 0;
    const all = readRows();
    const bad = all.filter((r) => (r.name || r.unitOre) && !(r.qty > 0 && r.name && r.unitOre > 0));
    const items = all.filter((r) => r.qty > 0 && r.name && r.unitOre > 0).map((r, i) => ({ id: 'i' + i, name: r.name, qty: r.qty, unitOre: r.unitOre }));
    const fail = (m) => { err.textContent = m; audio.play('nope'); shake(e.target); };
    if (!host) return fail('Skriv ditt namn.');
    if (!/^[\d\s+()-]{6,}$/.test(swish)) return fail('Skriv ett giltigt Swish-nummer.');
    if (bad.length) return fail(`${bad.length} rad(er) saknar antal, namn eller pris.`);
    if (!items.length) return fail('Lägg till minst en vara.');
    if (tipOre < 0) return fail('Dricksen kan inte vara negativ.');
    e.target.disabled = true;
    err.textContent = '';
    try {
      const now = Date.now();
      const hostId = 'p' + now.toString(36);
      const bill = {
        v: 1, title, createdAt: now, tipOre,
        swish: { number: swish, name: host },
        items,
        people: { [hostId]: { name: host, joinedAt: now, claims: {}, paidOre: 0, host: true } },
      };
      const id = await backend.createBill(bill);
      ls.set('jn:me:' + id, hostId);
      ls.set('jn:host', { name: host, swish });
      ls.set('jn:mine', [...ls.get('jn:mine', []), { id, title, createdAt: now }]);
      ls.set('jn:fresh', id);
      audio.play('win');
      location.hash = '#/b/' + id;
    } catch (ex) {
      console.error(ex);
      e.target.disabled = false;
      fail('Kunde inte spara notan: ' + ex.message);
    }
  });
}

// ---------------------------------------------------------------- bill view
function renderBill(billId) {
  const shareUrl = location.href.split('#')[0] + '#/b/' + billId;
  const fresh = ls.get('jn:fresh') === billId;
  if (fresh) ls.set('jn:fresh', null);
  app.innerHTML = `
    ${demoBanner()}
    <div id="loading" class="panel center px">LADDAR NOTAN…</div>
    <div id="bill" hidden>
      <section class="panel share ${fresh ? 'glow' : ''}" id="share">
        <h2 class="px h">${fresh ? 'NOTAN ÄR SKAPAD! DELA LÄNKEN:' : 'BJUD IN FLER:'}</h2>
        <div class="share-row">
          <input readonly id="share-url" value="${esc(shareUrl)}" aria-label="Länk till notan">
          <button class="btn small green" id="share-btn">${navigator.share ? 'DELA' : 'KOPIERA'}</button>
        </div>
      </section>

      <section class="panel hero">
        <h1 class="px title sm" id="b-title"></h1>
        <div class="px label">KVAR PÅ NOTAN</div>
        <div class="px big" id="left"></div>
        <div class="track" id="track"><div class="fill" id="fill"></div><div class="runner" id="runner"></div></div>
        <div class="sub" id="sub"></div>
      </section>

      <section class="panel" id="join" hidden></section>

      <section class="panel" id="items-panel">
        <h2 class="px h">MENYN <span class="muted small" id="hello"></span></h2>
        <p class="hint" id="items-hint">Tryck <b>+</b> på det du åt och drack.</p>
        <ul class="items" id="items"></ul>
      </section>

      <section class="panel mine" id="mine" hidden></section>

      <section class="panel" id="list-panel">
        <h2 class="px h">TOMTENS LISTA</h2>
        <ol class="list" id="list"></ol>
      </section>
    </div>
    <button class="dock px" id="dock" hidden></button>
  `;

  $('#share-btn').addEventListener('click', async (e) => {
    const url = $('#share-url').value;
    audio.play('click');
    if (navigator.share) {
      try { await navigator.share({ title: $('#b-title').textContent, text: 'Plocka dina grejer från julbordsnotan 🎅', url }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); floatText(e.target, 'KOPIERAD!'); } catch { $('#share-url').select(); }
  });

  let me = ls.get('jn:me:' + billId);
  let bill = null;
  let prevLeft = null;
  let joinShown = false;
  let busy = false;

  unsub = backend.subscribe(billId, (data, error) => {
    if (error || !data) {
      $('#loading').innerHTML = error
        ? `KUNDE INTE LADDA NOTAN<br><span class="small">${esc(error.message)}</span>`
        : `NOTAN HITTADES INTE 🎄<br><a href="#/">Skapa en ny</a>`;
      return;
    }
    bill = data;
    $('#loading').hidden = true;
    $('#bill').hidden = false;
    paint();
  });

  async function mutate(fn) {
    if (busy) return false;
    busy = true;
    try { await backend.mutate(billId, fn); return true; }
    catch (ex) { console.warn(ex); return ex; }
    finally { busy = false; }
  }

  function paint() {
    const c = compute(bill);
    document.title = bill.title + ' – Julbordsnotan';
    const joined = me && bill.people[me];
    const meP = joined ? c.people.find((p) => p.id === me) : null;

    // hero / progress
    $('#b-title').textContent = bill.title;
    $('#left').textContent = kr(c.leftOre);
    $('#left').classList.toggle('zero', c.leftOre === 0);
    const pct = c.totalOre ? Math.round((1 - c.leftOre / c.totalOre) * 100) : 0;
    $('#fill').style.width = pct + '%';
    const runner = $('#runner');
    if (!runner.firstChild) runner.appendChild(sprite('tomte', 'md'));
    runner.style.left = `calc(${pct}% - ${pct / 100 * 32}px)`;
    $('#sub').innerHTML = c.leftOre === 0
      ? `<span class="ok px small">NOTAN ÄR NOLL! GOD JUL! 🎄</span>`
      : `<span>🎁 Oplockat: <b>${kr(c.unclaimedOre)}</b></span><span>📱 Ej swishat: <b>${kr(c.unswishedOre)}</b></span><span class="muted">Totalt ${kr(c.totalOre)}${bill.tipOre ? ` (varav dricks ${kr(bill.tipOre)})` : ''}</span>`;
    if (prevLeft !== null && prevLeft > 0 && c.leftOre === 0) celebrate();
    prevLeft = c.leftOre;

    // join
    const join = $('#join');
    if (!joined) {
      if (!joinShown) renderJoin(c);
      else paintJoinList(c);
    } else {
      join.hidden = true;
      joinShown = false;
    }
    $('#hello').textContent = joined ? `– du är ${bill.people[me].name}` : '';
    $('#items-hint').innerHTML = joined ? 'Tryck <b>+</b> på det du åt och drack.' : 'Skriv in ditt namn ovanför för att börja plocka.';

    paintItems(c, joined);
    paintMine(c, meP);
    paintList(c);
  }

  function renderJoin(c) {
    joinShown = true;
    const join = $('#join');
    join.hidden = false;
    join.innerHTML = `
      <h2 class="px h">NY SPELARE</h2>
      <form id="join-form" class="join-form">
        <label>Vad heter du?<input id="j-name" maxlength="24" placeholder="Ditt namn" autocomplete="given-name" required></label>
        <button class="btn" type="submit">START ▸</button>
      </form>
      <div id="j-existing"></div>`;
    paintJoinList(c);
    $('#join-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#j-name').value.trim();
      if (!name) return;
      const btn = e.target.querySelector('button');
      const taken = Object.values(bill.people).some((p) => p.name.toLowerCase() === name.toLowerCase());
      if (taken) { audio.play('nope'); shake(btn); floatText(btn, 'NAMNET ÄR TAGET', 'bad'); return; }
      const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      btn.disabled = true;
      const res = await mutate((b) => {
        b.people[id] = { name, joinedAt: Date.now(), claims: {}, paidOre: 0, host: false };
        return b;
      });
      btn.disabled = false;
      if (res === true) {
        me = id;
        ls.set('jn:me:' + billId, id);
        audio.play('join');
        paint();
        $('#items-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else { audio.play('nope'); shake(btn); }
    });
  }

  function paintJoinList(c) {
    const box = $('#j-existing');
    if (!box) return;
    const others = c.people;
    box.innerHTML = others.length ? `
      <p class="hint">…eller är du redan med? (byter du telefon)</p>
      <div class="chips">${others.map((p) => `<button class="chip" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>` : '';
    box.onclick = (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      me = b.dataset.id;
      ls.set('jn:me:' + billId, me);
      audio.play('join');
      paint();
    };
  }

  function paintItems(c, joined) {
    const ul = $('#items');
    const myClaims = joined ? bill.people[me].claims || {} : {};
    ul.innerHTML = '';
    for (const it of c.items) {
      const mine = myClaims[it.id] || 0;
      const others = it.claimed - mine;
      const li = document.createElement('li');
      li.className = 'item' + (it.left === 0 ? ' soldout' : '') + (mine ? ' has' : '');
      const pips = it.qty <= 24
        ? `<div class="pips" aria-hidden="true">${'<i class="me"></i>'.repeat(mine)}${'<i class="other"></i>'.repeat(others)}${'<i></i>'.repeat(it.left)}</div>`
        : '';
      li.innerHTML = `
        <div class="icon"></div>
        <div class="info">
          <div class="name">${esc(it.name)}</div>
          <div class="meta"><span class="gold">${kr(it.unitOre)}</span> · <span class="${it.left ? '' : 'bad'}">${it.left ? `${it.left} av ${it.qty} kvar` : 'SLUT!'}</span></div>
          ${pips}
        </div>
        <div class="ctrl">
          <button class="pm minus px" data-id="${it.id}" data-d="-1" ${!joined || !mine ? 'disabled' : ''} aria-label="En mindre ${esc(it.name)}">−</button>
          <span class="count px" aria-label="Du har ${mine}">${mine}</span>
          <button class="pm plus px" data-id="${it.id}" data-d="1" ${!joined || !it.left ? 'disabled' : ''} aria-label="En till ${esc(it.name)}">+</button>
        </div>`;
      $('.icon', li).appendChild(sprite(iconFor(it.name), 'md'));
      ul.appendChild(li);
    }
    ul.onclick = async (e) => {
      const b = e.target.closest('.pm');
      if (!b || b.disabled) return;
      const itemId = b.dataset.id;
      const d = +b.dataset.d;
      const item = bill.items.find((i) => i.id === itemId);
      let reason = '';
      const res = await mutate((fresh) => {
        const p = fresh.people[me];
        if (!p) throw new Error('Du finns inte på notan');
        const it = fresh.items.find((i) => i.id === itemId);
        const cur = (p.claims || {})[itemId] || 0;
        if (d > 0 && claimedOf(fresh, itemId) + d > it.qty) { reason = 'SLUT!'; throw new Error('slut'); }
        if (cur + d < 0) throw new Error('negativt');
        p.claims = p.claims || {};
        if (cur + d) p.claims[itemId] = cur + d; else delete p.claims[itemId];
        return fresh;
      });
      if (res === true) {
        audio.play(d > 0 ? 'up' : 'down');
        const btn = document.querySelector(`.pm[data-id="${itemId}"][data-d="${d}"]`) || b;
        floatText(btn, `${d > 0 ? '+' : '−'}${kr(item.unitOre)}`, d > 0 ? '' : 'bad');
      } else if (res !== false) {
        audio.play('nope');
        shake(b.closest('.item') || b);
        if (reason) floatText(b, reason, 'bad');
      }
    };
  }

  function paintMine(c, meP) {
    const box = $('#mine');
    const dock = $('#dock');
    if (!meP) { box.hidden = true; dock.hidden = true; return; }
    box.hidden = false;
    const swish = bill.swish || {};
    if (meP.host) {
      box.innerHTML = `
        <h2 class="px h">DIN NOTA <span class="badge host">VÄRD</span></h2>
        <p>Du är värden – vännerna swishar till dig (<b>${esc(swish.number)}</b>).</p>
        <p>Dina egna grejer: <b class="gold">${kr(meP.owedOre)}</b>${meP.tipOre ? ` <span class="muted">(inkl. ${kr(meP.tipOre)} dricks)</span>` : ''} – de räknas som betalda.</p>
        <p class="hint">Kom ihåg att plocka dina egna saker också, annars ser det ut som att något är oplockat!</p>`;
      dock.hidden = true;
      return;
    }
    const paid = meP.paidOre || 0;
    const allPaid = meP.owedOre > 0 && meP.unpaidOre === 0;
    box.innerHTML = `
      <h2 class="px h">DIN NOTA</h2>
      <div class="receipt">
        ${c.items.filter((i) => (meP.claims || {})[i.id]).map((i) => `<div class="rl"><span>${meP.claims[i.id]} × ${esc(i.name)}</span><span>${kr(meP.claims[i.id] * i.unitOre)}</span></div>`).join('') || '<div class="muted">Inget plockat ännu.</div>'}
        ${meP.tipOre ? `<div class="rl muted"><span>Din del av dricksen</span><span>${kr(meP.tipOre)}</span></div>` : ''}
        <div class="rl total"><span>SUMMA</span><span>${kr(meP.owedOre)}</span></div>
        ${paid ? `<div class="rl ok"><span>Redan swishat</span><span>−${kr(paid)}</span></div>` : ''}
      </div>
      ${meP.unpaidOre > 0 ? `
        <div class="swish">
          <div class="px label">SWISHA TILL ${esc((swish.name || '').toUpperCase())}</div>
          <div class="swish-row"><span class="px swish-num">${esc(swish.number)}</span><button class="btn small ghost" data-copy="${esc((swish.number || '').replace(/[^\d+]/g, ''))}">KOPIERA</button></div>
          <div class="swish-row"><span class="px swish-amt">${kr(meP.unpaidOre)}</span><button class="btn small ghost" data-copy="${(meP.unpaidOre / 100).toFixed(2).replace('.', ',').replace(',00', '')}">KOPIERA</button></div>
          <button class="btn big green" id="paid-btn">JAG HAR SWISHAT ${kr(meP.unpaidOre)} ✓</button>
        </div>` : ''}
      ${allPaid ? `<div class="done px">✓ BETALT! DU ÄR SNÄLL I ÅR 🎅</div>` : ''}
      ${meP.overpaidOre > 0 ? `<p class="hint">Du har swishat ${kr(meP.overpaidOre)} för mycket (t.ex. för att fler delar på dricksen nu). Snacka med ${esc(swish.name)}!</p>` : ''}
      ${paid ? `<button class="linkish" id="unpay">Ångra "jag har swishat"</button>` : ''}`;

    box.onclick = async (e) => {
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        try { await navigator.clipboard.writeText(cp.dataset.copy); floatText(cp, 'KOPIERAT!'); audio.play('click'); } catch { /* ignore */ }
        return;
      }
      if (e.target.id === 'paid-btn') {
        const amount = meP.unpaidOre;
        const res = await mutate((b) => { const p = b.people[me]; p.paidOre = (p.paidOre || 0) + amount; p.paidAt = Date.now(); return b; });
        if (res === true) { audio.play('coin'); floatText(e.target, `+${kr(amount)} TILL ${(swish.name || 'VÄRDEN').toUpperCase()}`); coinRain(e.target); }
      }
      if (e.target.id === 'unpay') {
        if (!confirm('Ångra din betalning?')) return;
        const res = await mutate((b) => { b.people[me].paidOre = 0; return b; });
        if (res === true) audio.play('down');
      }
    };

    // sticky mini-bar on phones
    dock.hidden = meP.owedOre === 0;
    dock.className = 'dock px' + (allPaid ? ' paid' : '');
    dock.innerHTML = allPaid ? `✓ BETALT ${kr(meP.owedOre)}` : `DIN NOTA: ${kr(meP.unpaidOre)} <span>SWISHA ▸</span>`;
    dock.onclick = () => box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function paintList(c) {
    const ol = $('#list');
    const ranked = c.people.slice().sort((a, b) => b.owedOre - a.owedOre);
    const top = ranked.find((p) => p.owedOre > 0);
    // most drinks of one kind -> fun title
    const drinkTitles = { beer: 'ÖLKUNG', snaps: 'SNAPSMÄSTARE', glogg: 'GLÖGGNISSE', wine: 'VINTOMTE', must: 'MUSTMONSTER', ginger: 'SÖTSUGEN', coffee: 'KAFFETÖRSTIG' };
    const titles = {};
    for (const [kind, label] of Object.entries(drinkTitles)) {
      let best = null, bestN = 1;
      for (const p of c.people) {
        const n = Object.entries(p.claims || {}).reduce((s, [iid, k]) => {
          const it = c.items.find((i) => i.id === iid);
          return s + (it && iconFor(it.name) === kind ? k : 0);
        }, 0);
        if (n > bestN) { best = p.id; bestN = n; }
      }
      if (best) (titles[best] = titles[best] || []).push(label);
    }
    ol.innerHTML = ranked.length ? ranked.map((p) => {
      let status;
      if (p.host) status = '<span class="badge host">VÄRD</span>';
      else if (p.owedOre === 0) status = '<span class="badge idle">HUNGRIG?</span>';
      else if (p.unpaidOre === 0) status = '<span class="badge nice">SNÄLL ✓</span>';
      else status = `<span class="badge naughty">STYGG · ${kr(p.unpaidOre)}</span>`;
      const t = [...(top && top.id === p.id ? ['TOMTEBOSS'] : []), ...(titles[p.id] || [])];
      return `<li class="${p.id === me ? 'me' : ''}">
        <span class="who">${esc(p.name)}${p.id === me ? ' (du)' : ''}${t.length ? `<span class="titles">${t.map((x) => `<i>${x}</i>`).join('')}</span>` : ''}</span>
        <span class="amt">${kr(p.owedOre)}</span>${status}</li>`;
    }).join('') : '<li class="muted">Ingen har gått med än.</li>';
  }

  function coinRain(anchor) {
    const r = anchor.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const s = sprite('coin', 'coin-fly');
      s.style.left = r.left + Math.random() * r.width + 'px';
      s.style.top = r.top + 'px';
      s.style.animationDelay = i * 60 + 'ms';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  function celebrate() {
    audio.play('win');
    confetti();
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="panel center pop"><div class="hero-sprites"></div><h2 class="px title">NOTAN ÄR NOLL!</h2><p class="px">GOD JUL! 🎄</p><button class="btn">TACK TOMTEN ▸</button></div>`;
    ['tree', 'tomte', 'gift'].forEach((n) => $('.hero-sprites', o).appendChild(sprite(n, n === 'tomte' ? 'xl bob' : 'lg')));
    o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('button')) o.remove(); });
    document.body.appendChild(o);
  }
}

// ---------------------------------------------------------------- boot
(async function boot() {
  startSnow();
  soundButtons();
  audio.unlockOnGesture();
  try {
    backend = await getBackend();
  } catch (e) {
    app.innerHTML = `<div class="panel center px">Kunde inte ansluta till databasen.<br><span class="small">${esc(e.message)}</span></div>`;
    return;
  }
  addEventListener('hashchange', route);
  route();
})();
