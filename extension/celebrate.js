// The goal-reached moment on linkedin.com. A full-page overlay counts up to
// the goal, bursts into confetti made of heatmap squares, then fills in
// today's square. It stays until you close it (button, Esc or click outside).
//
// The background worker sends { type: "celebrate", data }, where data comes
// from celebration() in lib.js. Content scripts can't be ES modules, so this
// file stands alone. It draws inside a closed shadow root, so LinkedIn's CSS
// can't change it and LinkedIn's scripts can't see it.
(() => {
  const RING = 2 * Math.PI * 52; // circumference of the progress ring (r = 52)
  const CONFETTI = ["#39d353", "#26a641", "#40c463", "#9be9a8", "#ffffff", "#f2cc60"];
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
  const SUFFIX = { one: "st", two: "nd", few: "rd", other: "th" };
  const ordinals = new Intl.PluralRules("en", { type: "ordinal" });
  const ordinal = (n) => `${n.toLocaleString()}${SUFFIX[ordinals.select(n)]}`;

  let closeOpen = null;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "celebrate") return;
    show(msg.data || {});
    sendResponse(true);
  });

  function show(d) {
    closeOpen?.(true);

    const goal = Math.max(1, Number(d.goal) || 1);
    const streak = Number(d.streak) || 0;
    const goalDays = Number(d.goalDays) || 0;
    const record = Boolean(d.record);
    const week = Array.isArray(d.week) ? d.week.slice(-7) : [];
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="wrap">
        <div class="backdrop"></div>
        <canvas></canvas>
        <div class="card" role="dialog" aria-modal="true" aria-labelledby="h" aria-describedby="p" tabindex="-1">
          <div class="ring" aria-hidden="true">
            <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="fill" cx="60" cy="60" r="52"/></svg>
            <div class="num"><b>0</b><small>comments today</small></div>
          </div>
          <div class="more"><div class="more-in">
            <div class="reveal" style="--i:0"><div class="eyebrow"></div><h1 id="h"></h1></div>
            <p id="p" class="reveal" style="--i:1"></p>
            <div class="week reveal" style="--i:2" aria-hidden="true"></div>
            <div class="chips reveal" style="--i:3"></div>
            <button class="reveal" style="--i:4">Back to the feed</button>
          </div></div>
        </div>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const wrap = $(".wrap"), card = $(".card"), num = $(".num b"), fill = $(".fill"), btn = $("button");

    $(".eyebrow").textContent = goalDays <= 1 ? "Your first goal day" : record ? "New longest streak" : "Daily goal reached";
    $("h1").textContent = goal === 1 ? "You showed up today." : `You showed up ${goal.toLocaleString()} times today.`;
    $("p").textContent =
      (goal === 1 ? "You stopped, read, and found something worth saying. " : "Each time, you stopped, read, and found something worth saying. That’s hard to do once. ") +
      "Take a moment and let this one land.";

    const chips = [
      [streak > 1 ? `${streak}-day streak` : "Streak started", record],
      goalDays > 1 && [`${ordinal(goalDays)} goal day`],
      [`Done at ${timeFmt.format(new Date())}`],
    ].filter(Boolean);
    $(".chips").append(...chips.map(([text, hi]) => el("span", `chip${hi ? " hi" : ""}`, text)));

    const cells = week.map((w, i) => el("i", i === week.length - 1 ? `l${Number(d.prevLevel) || 0} today` : `l${w.level}`));
    const labels = week.map((w) => el("span", "", dayFmt.format(new Date(2024, 0, 7 + w.day)))); // 7 Jan 2024 was a Sunday
    $(".week").append(...cells, ...labels);
    if (!week.length) $(".week").remove();

    // --- Open, count up, release, close --------------------------------------

    const fx = still ? null : confetti($("canvas"));
    const timers = [];
    let raf = 0;
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const prevFocus = document.activeElement;

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    function close(instant = false) {
      if (closeOpen !== close) return;
      closeOpen = null;
      removeEventListener("keydown", onKey, true);
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      const remove = () => {
        fx?.stop();
        host.remove();
      };
      if (instant) remove();
      else {
        wrap.classList.add("out");
        setTimeout(remove, 320);
      }
      if (prevFocus instanceof HTMLElement && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
    }
    closeOpen = close;

    addEventListener("keydown", onKey, true);
    btn.addEventListener("click", () => close());
    wrap.addEventListener("click", (e) => !card.contains(e.target) && close());
    // Don't scroll LinkedIn underneath while the moment is up.
    wrap.addEventListener("wheel", (e) => !card.contains(e.target) && e.preventDefault(), { passive: false });

    document.documentElement.append(host);
    void wrap.offsetWidth; // start the fade-in transition from the hidden state
    wrap.classList.add("in");
    card.focus({ preventScroll: true });

    function release() {
      card.classList.add("done");
      btn.focus({ preventScroll: true });
      if (fx) {
        const r = card.getBoundingClientRect();
        const W = innerWidth, H = innerHeight, v = Math.sqrt(H) * 0.78;
        fx.burst(r.left + r.width / 2, r.top + 106, 150, 0, Math.PI * 2, 15); // from behind the ring
        fx.burst(0, H, 80, -Math.PI / 3, 0.7, v);
        fx.burst(W, H, 80, (-2 * Math.PI) / 3, 0.7, v);
        later(380, () => {
          fx.burst(0, H, 40, -Math.PI / 2.6, 0.6, v * 0.9);
          fx.burst(W, H, 40, -Math.PI + Math.PI / 2.6, 0.6, v * 0.9);
        });
      }
      // Last beat: once the week strip is in view, today's square fills in.
      const today = cells[cells.length - 1];
      if (today) later(still ? 0 : 750, () => (today.className = `l${week[week.length - 1].level} today pop`));
    }

    if (still) {
      num.textContent = goal.toLocaleString();
      fill.style.strokeDashoffset = "0";
      release();
      return;
    }

    // Fast at first, then slow over the last few, so the final number lands.
    const ms = goal >= 10 ? 1800 : 1100;
    later(450, () => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = 1 - (1 - k) ** 3;
        num.textContent = Math.round(goal * e).toLocaleString();
        fill.style.strokeDashoffset = String(RING * (1 - e));
        if (k < 1) raf = requestAnimationFrame(step);
        else release();
      };
      raf = requestAnimationFrame(step);
    });
  }

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  // Small canvas confetti: rounded squares (heatmap cells) and a few strips,
  // with drag, gravity and a paper-like flutter. Stops itself when all land.
  function confetti(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1);
    const parts = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    resize();
    addEventListener("resize", resize);

    function frame(t) {
      const dt = last ? Math.min(3, (t - last) / 16.67) : 1;
      last = t;
      const drag = 0.985 ** dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        p.vx *= drag;
        p.vy = Math.min(p.vy * drag + 0.24 * dt, 5);
        p.flip += p.vf * dt;
        p.x += (p.vx + Math.sin(p.flip) * 0.7) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.life > p.ttl || p.y > innerHeight + 30) {
          parts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, (p.ttl - p.life) / 45);
        ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.color;
        if (p.strip) ctx.fillRect(-p.size * 0.7, -1.5, p.size * 1.4, 3);
        else {
          ctx.beginPath();
          ctx.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, 2);
          ctx.fill();
        }
      }
      raf = parts.length ? requestAnimationFrame(frame) : 0;
      if (!raf) last = 0;
    }

    return {
      burst(x, y, n, angle, spread, speed) {
        for (let i = 0; i < n; i++) {
          const a = angle + (Math.random() - 0.5) * spread;
          const v = speed * (0.45 + Math.random() * 0.75);
          parts.push({
            x, y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            size: 6 + Math.random() * 6,
            strip: Math.random() < 0.25,
            color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.3,
            flip: Math.random() * Math.PI * 2,
            vf: 0.08 + Math.random() * 0.12,
            life: 0,
            ttl: 240 + Math.random() * 120, // frames at 60 fps
          });
        }
        if (!raf) raf = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(raf);
        removeEventListener("resize", resize);
        parts.length = 0;
      },
    };
  }

  // Always dark: it reads as a stage over the page, in either LinkedIn theme.
  // Colours are the popup's dark palette (GitHub's contribution greens).
  const CSS = `
    * { box-sizing: border-box; }
    .wrap {
      position: fixed; inset: 0; display: grid; place-items: center; padding: 16px;
      font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #e6edf3; -webkit-font-smoothing: antialiased;
    }
    .backdrop {
      position: absolute; inset: 0;
      background: rgb(1 4 9 / 72%);
      backdrop-filter: blur(10px) saturate(70%);
      opacity: 0; transition: opacity .45s ease;
    }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; transition: opacity .3s; }
    .card {
      position: relative; width: min(420px, 100%); max-height: 100%; overflow: auto; overscroll-behavior: contain;
      padding: 30px 28px 24px; text-align: center; outline: none;
      background: radial-gradient(120% 55% at 50% 0%, rgb(57 211 83 / 15%), transparent 70%), #0d1117;
      border: 1px solid #30363d; border-radius: 18px;
      box-shadow: 0 32px 80px rgb(0 0 0 / 55%);
      opacity: 0; transform: translateY(14px) scale(.96);
      transition: opacity .5s ease .1s, transform .6s cubic-bezier(.2,.9,.25,1.15) .1s;
    }
    .in .backdrop, .in .card { opacity: 1; }
    .in .card { transform: none; }
    .out .backdrop, .out .card, .out canvas { opacity: 0; transition: opacity .3s ease; }

    .ring { position: relative; width: 148px; height: 148px; margin: 0 auto; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
    .ring circle { fill: none; stroke-width: 9; }
    .track { stroke: #1c2128; }
    .fill { stroke: #39d353; stroke-linecap: round; stroke-dasharray: ${RING}; stroke-dashoffset: ${RING}; }
    .done .fill { filter: drop-shadow(0 0 6px rgb(57 211 83 / 55%)); animation: glow 1.6s ease-out; }
    @keyframes glow {
      0% { filter: drop-shadow(0 0 0 rgb(57 211 83 / 0%)); }
      25% { filter: drop-shadow(0 0 16px rgb(57 211 83 / 90%)); }
    }
    .num { position: absolute; inset: 0; display: grid; place-content: center; }
    .num b { font-size: 46px; font-weight: 700; line-height: 1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
    .num small { margin-top: 6px; font-size: 12px; color: #8d96a0; }
    .done .num b { animation: pop .5s cubic-bezier(.3,1.6,.5,1); }
    @keyframes pop { 40% { transform: scale(1.14); } }

    /* The card starts as just the ring, then opens up when the count lands. */
    .more { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .7s cubic-bezier(.2,.8,.2,1); }
    .done .more { grid-template-rows: 1fr; }
    .more-in { min-height: 0; overflow: hidden; padding: 0 6px; margin: 0 -6px; }
    .more-in > :first-child { margin-top: 18px; }
    .more-in > :last-child { margin-bottom: 6px; }
    .reveal { opacity: 0; transform: translateY(8px); transition: opacity .5s ease, transform .5s ease; transition-delay: calc(150ms + var(--i) * 90ms); }
    .done .reveal { opacity: 1; transform: none; }

    .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #39d353; }
    h1 { margin: 6px 0 8px; font-size: 24px; font-weight: 650; line-height: 1.25; letter-spacing: -.01em; color: #e6edf3; }
    p { margin: 0 auto; max-width: 330px; font-size: 14px; color: #8d96a0; }

    .week { display: inline-grid; grid-template-columns: repeat(7, 18px); gap: 4px 6px; margin: 20px 0 0; }
    .week i { width: 18px; height: 18px; border-radius: 4px; transition: background-color .3s; }
    .week i.today { outline: 1.5px solid #4493f8; outline-offset: 2px; }
    .week i.pop { animation: pop .6s cubic-bezier(.3,1.6,.5,1); }
    .week span { font-size: 10px; line-height: 1; color: #8d96a0; }
    .l0 { background: #1c2128; } .l1 { background: #0e4429; } .l2 { background: #006d32; }
    .l3 { background: #26a641; } .l4 { background: #39d353; }

    .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 16px 0 22px; }
    .chip { padding: 4px 11px; font-size: 12px; border: 1px solid #30363d; border-radius: 999px; background: #161b22; color: #e6edf3; }
    .chip.hi { color: #39d353; border-color: rgb(57 211 83 / 50%); background: rgb(57 211 83 / 8%); }

    button {
      font: inherit; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer;
      background: #238636; border: 1px solid rgb(240 246 252 / 10%); border-radius: 999px; padding: 9px 22px;
    }
    button:hover { background: #2ea043; }
    button:focus-visible { outline: 2px solid #4493f8; outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .card, .reveal { transform: none !important; transition: opacity .2s ease !important; }
      .more { transition: none; }
      .done .fill, .done .num b, .week i.pop { animation: none; }
    }
  `;
})();
