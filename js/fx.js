// Visual effects: low-res pixel snowfall, floating "+79 kr" texts, confetti/fireworks.

export function startSnow() {
  const c = document.createElement('canvas');
  c.id = 'snow';
  document.body.prepend(c);
  const ctx = c.getContext('2d');
  const SCALE = 4; // render at quarter resolution for chunky pixels
  let flakes = [];
  const resize = () => {
    c.width = Math.ceil(innerWidth / SCALE);
    c.height = Math.ceil(innerHeight / SCALE);
    const n = Math.round((c.width * c.height) / 260);
    flakes = Array.from({ length: n }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      v: 0.08 + Math.random() * 0.22, d: Math.random() * Math.PI * 2, s: Math.random() < 0.15 ? 2 : 1,
    }));
  };
  resize();
  addEventListener('resize', resize);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const f of flakes) {
      if (!reduce) {
        f.y += f.v;
        f.d += 0.01;
        f.x += Math.sin(f.d) * 0.08;
        if (f.y > c.height) { f.y = -2; f.x = Math.random() * c.width; }
      }
      ctx.fillStyle = f.s === 2 ? 'rgba(255,255,255,0.9)' : 'rgba(220,230,255,0.6)';
      ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
    }
    // snowy ground
    ctx.fillStyle = '#e8eef8';
    for (let x = 0; x < c.width; x++) {
      const h = 3 + Math.round(Math.sin(x * 0.15) * 1.2 + Math.sin(x * 0.05) * 1.5);
      ctx.fillRect(x, c.height - h, 1, h);
    }
    if (!reduce) requestAnimationFrame(tick);
  };
  tick();
}

export function floatText(anchor, text, cls = '') {
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'floater px ' + cls;
  el.textContent = text;
  el.style.left = r.left + r.width / 2 + 'px';
  el.style.top = r.top + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

export function confetti(duration = 3500) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const S = 4;
  c.width = Math.ceil(innerWidth / S);
  c.height = Math.ceil(innerHeight / S);
  const ctx = c.getContext('2d');
  const colors = ['#c8262c', '#2f9e4a', '#f2c14e', '#f4f4f4', '#9fd8f0'];
  const parts = [];
  const burst = (x, y) => {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.6;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, c: colors[i % colors.length], life: 80 + Math.random() * 60 });
    }
  };
  let t = 0;
  const start = performance.now();
  const tick = (now) => {
    if (t++ % 25 === 0 && now - start < duration - 1200) burst(Math.random() * c.width, c.height * (0.15 + Math.random() * 0.4));
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.025; p.life--;
      if (p.life > 0) { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    }
    if (now - start < duration) requestAnimationFrame(tick);
    else c.remove();
  };
  requestAnimationFrame(tick);
}
