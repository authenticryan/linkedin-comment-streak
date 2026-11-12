// tryrelink.live: the live inbox demo and the waitlist forms.
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- Inbox demo ----------
  // J/K move, E done, H opens "Remind me" (H, 1, 2, 3 pick), Z undo.
  function inboxDemo() {
    const root = $("[data-inbox]");
    if (!root) return;
    // A founder's inbox: customers, investors, hires and intros.
    const PEOPLE = [
      { name: "Priya Raman", ini: "PR", h: 205, role: "Head of Ops, Tidewell", label: "Customers", time: "10:42",
        msg: "Loved your comment on onboarding. Free for a demo next Tuesday?",
        value: "Get Tidewell live before their Q1 rollout", next: "Send two times for a demo", due: "Late" },
      { name: "Daniel Okafor", ini: "DO", h: 25, role: "Partner, Fieldnote Ventures", label: "Investors", time: "09:15",
        msg: "Thanks for the update. Send the deck when the round opens?",
        value: "A warm lead for the seed round", next: "Send the deck and the metrics", due: "Today" },
      { name: "Mei Tanaka", ini: "MT", h: 150, role: "Senior Engineer", label: "Hiring", time: "08:03",
        msg: "Saw your post about the founding engineer role. Is it still open?",
        value: "Your first engineering hire", next: "Book a first call", due: "Today" },
      { name: "Jonas Weber", ini: "JW", h: 280, role: "Founder, Northfold", label: null, time: "Wed",
        msg: "Happy to intro you to our head of sales. Want me to?",
        value: "An intro to a possible design partner", next: "Say yes and send a short blurb", due: "Today" },
      { name: "Aisha Khan", ini: "AK", h: 340, role: "COO, Amberly", label: "Customers", time: "Wed",
        msg: "Following up on the pilot. Can we start on the 1st?",
        value: "A smooth pilot kickoff", next: "Confirm the start date", due: "Fri" },
      { name: "Tom Becker", ini: "TB", h: 95, role: "Angel investor", label: "Investors", time: "Tue",
        msg: "Your comment on the outbound thread was spot on. Coffee next week?",
        value: "A first angel check", next: "Pick a day for coffee", due: "Mon" },
    ];
    const LABEL_COLOR = { Customers: "var(--blue)", Investors: "var(--violet)", Hiring: "var(--teal)" };
    const PICK_KEYS = { h: "tomorrow", 1: "in a week", 2: "in two weeks", 3: "in a month" };

    const rowsEl = $("[data-rows]", root);
    const personEl = $("[data-person]", root);
    const picker = $("[data-picker]", root);
    const toastEl = $("[data-toast]", root);
    const kbState = $("[data-kb-state]", root);

    let rows = [...PEOPLE];
    let sel = 0;
    let reminders = 3;
    let done = 0;
    let busy = false;
    const history = [];
    const shown = {};

    const firstName = (p) => p.name.split(" ")[0];

    function setCount(key, n) {
      const b = $(`[data-n="${key}"]`, root);
      if (!b) return;
      b.textContent = n || "";
      if (shown[key] !== undefined && shown[key] !== n && !reduceMotion) {
        b.classList.remove("tick");
        void b.offsetWidth;
        b.classList.add("tick");
      }
      shown[key] = n;
    }

    function keyButton(key, label, fn) {
      const b = el("button");
      b.type = "button";
      b.append(el("kbd", null, key), document.createTextNode(label));
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        root.focus({ preventScroll: true });
        fn();
      });
      return b;
    }

    function reset() {
      rows = [...PEOPLE];
      sel = 0;
      reminders = 3;
      done = 0;
      history.length = 0;
      render();
      root.focus({ preventScroll: true });
    }

    function render() {
      rowsEl.replaceChildren();
      if (!rows.length) {
        const empty = el("div", "empty");
        const msg = el("div");
        msg.append(el("b", null, "Inbox zero."), document.createTextNode("Everyone has a next step and a date."));
        const again = el("button", "link-btn", "Reset the demo");
        again.type = "button";
        again.addEventListener("click", reset);
        empty.append(msg, again);
        rowsEl.append(empty);
      }
      rows.forEach((p, i) => {
        const row = el("div", `row${i === sel ? " sel" : ""}`);
        const av = el("span", "pav", p.ini);
        av.style.setProperty("--h", p.h);
        const main = el("div", "row-main");
        const top = el("div", "row-top");
        top.append(el("b", null, p.name));
        if (p.label) {
          const tag = el("span", "tag", p.label);
          tag.style.setProperty("--lc", LABEL_COLOR[p.label]);
          top.append(tag);
        }
        top.append(el("time", null, p.time));
        main.append(top, el("p", null, p.msg));
        row.append(av, main);
        row.addEventListener("click", () => {
          closePicker();
          sel = i;
          render();
        });
        rowsEl.append(row);
      });

      personEl.replaceChildren();
      const p = rows[sel];
      if (p) {
        const top = el("div", "person-top");
        const av = el("span", "pav", p.ini);
        av.style.setProperty("--h", p.h);
        const who = el("div");
        who.append(el("b", null, p.name), el("span", null, p.role));
        top.append(av, who);
        const value = el("div", "field");
        value.append(el("span", null, "The value you're creating"), el("p", null, p.value));
        const nextStep = el("div", "field");
        const np = el("p", null, p.next);
        np.append(el("em", "due", p.due));
        nextStep.append(el("span", null, "Next step"), np);
        personEl.append(top, value, nextStep);
      }
      const bar = el("div", "keys-bar");
      bar.append(
        keyButton("E", "Done", () => leave("done")),
        keyButton("H", "Remind me", openPicker),
        keyButton("Z", "Undo", undo)
      );
      personEl.append(bar);

      setCount("focused", rows.length);
      for (const l of Object.keys(LABEL_COLOR)) setCount(l, rows.filter((r) => r.label === l).length);
      setCount("reminders", reminders);
      setCount("done", done);
    }

    let toastTimer;
    function toast(text) {
      toastEl.textContent = text;
      toastEl.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
    }

    function openPicker() {
      if (!rows[sel] || busy) return;
      const rowEl = rowsEl.children[sel];
      const top = rowEl.offsetTop + rowEl.offsetHeight + 4;
      picker.style.top = `${Math.min(top, root.clientHeight - 190)}px`;
      picker.hidden = false;
    }

    function closePicker() {
      picker.hidden = true;
    }

    // E (done) or a reminder: the row leaves the inbox.
    function leave(kind, when) {
      if (busy || !rows[sel]) return;
      closePicker();
      busy = true;
      const p = rows[sel];
      rowsEl.children[sel]?.classList.add("leaving");
      setTimeout(
        () => {
          rows.splice(sel, 1);
          history.push({ p, i: sel, kind });
          if (kind === "done") done += 1;
          else reminders += 1;
          sel = Math.min(sel, rows.length - 1);
          busy = false;
          render();
          toast(kind === "done" ? `Done. ${firstName(p)} comes back when they reply.` : `${firstName(p)} comes back ${when}.`);
        },
        reduceMotion ? 0 : 220
      );
    }

    function undo() {
      closePicker();
      const last = history.pop();
      if (!last) return toast("Nothing to undo.");
      rows.splice(last.i, 0, last.p);
      if (last.kind === "done") done -= 1;
      else reminders -= 1;
      sel = last.i;
      render();
      toast(`${firstName(last.p)} is back in your inbox.`);
    }

    function move(d) {
      if (!rows.length) return;
      closePicker();
      sel = Math.max(0, Math.min(rows.length - 1, sel + d));
      render();
    }

    $$("button[data-when]", picker).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        root.focus({ preventScroll: true });
        leave("remind", b.dataset.when);
      })
    );

    root.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (!picker.hidden) {
        if (PICK_KEYS[k]) leave("remind", PICK_KEYS[k]);
        else if (k === "escape") closePicker();
        else return;
        e.preventDefault();
        return;
      }
      const map = {
        j: () => move(1),
        arrowdown: () => move(1),
        k: () => move(-1),
        arrowup: () => move(-1),
        e: () => leave("done"),
        h: openPicker,
        z: undo,
      };
      if (map[k]) {
        e.preventDefault();
        map[k]();
      }
    });
    root.addEventListener("pointerdown", (e) => {
      if (!e.target.closest("button")) root.focus({ preventScroll: true });
    });
    root.addEventListener("focus", () => {
      root.classList.add("active");
      kbState.textContent = "Keyboard on. Try J, K, E, H";
    });
    root.addEventListener("focusout", (e) => {
      if (root.contains(e.relatedTarget)) return;
      root.classList.remove("active");
      closePicker();
      kbState.textContent = "Click here, then use your keyboard";
    });

    render();
  }

  // ---------- Waitlist ----------
  const STORE_KEY = "relink-waitlist";
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ---------- Live waitlist count ----------
  // The real number from the database, refreshed while the page is open.
  const POLL_MS = 15000;
  let liveCount = null;

  function showCount(n, bump) {
    if (typeof n !== "number" || n < 0) return;
    const changed = liveCount !== null && n !== liveCount;
    liveCount = n;
    $$("[data-count]").forEach((box) => {
      const text = $("[data-count-text]", box);
      text.replaceChildren();
      if (n === 0) {
        text.textContent = "Be the first on the waitlist";
      } else {
        const num = el("b", null, n.toLocaleString("en-US"));
        if ((changed || bump) && !reduceMotion) num.classList.add("bump");
        text.append(num, document.createTextNode(n === 1 ? " person on the waitlist" : " people on the waitlist"));
      }
      box.hidden = false;
    });
  }

  async function fetchCount() {
    try {
      const res = await fetch("/api/waitlist", { cache: "no-store" });
      if (!res.ok) return;
      const { count } = await res.json();
      // Never count down: a cached response can be a few seconds behind a signup.
      showCount(Math.max(count, liveCount ?? 0));
    } catch {}
  }

  function liveWaitlist() {
    if (!$("[data-count]")) return;
    fetchCount();
    let timer = setInterval(fetchCount, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        fetchCount();
        timer = setInterval(fetchCount, POLL_MS);
      }
    });
  }

  function attribution() {
    const q = new URLSearchParams(location.search);
    let referrer = null;
    try {
      if (document.referrer && new URL(document.referrer).host !== location.host) referrer = document.referrer;
    } catch {}
    return {
      utm_source: q.get("utm_source") || q.get("ref"),
      utm_medium: q.get("utm_medium"),
      utm_campaign: q.get("utm_campaign"),
      referrer,
    };
  }

  const msgFor = (form) => form.nextElementSibling;

  function showError(form, text) {
    form.classList.add("invalid");
    msgFor(form).className = "join-msg error";
    msgFor(form).textContent = text;
  }

  function clearError(form) {
    form.classList.remove("invalid");
    const msg = msgFor(form);
    if (msg.classList.contains("error")) {
      msg.className = "join-msg";
      msg.textContent = "";
    }
  }

  function markJoined(position) {
    $$("[data-join]").forEach((form) => {
      form.hidden = true;
      const msg = msgFor(form);
      msg.className = "join-msg done";
      msg.textContent = position
        ? `You're #${position} on the list. Your invite comes by email.`
        : "You're on the list. Your invite comes by email.";
    });
    $$("[data-focus-join]").forEach((a) => (a.textContent = "You're on the list"));
  }

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = $('input[type="email"]', form);
    const button = $('button[type="submit"]', form);
    const email = input.value.trim();
    if (!EMAIL.test(email)) {
      showError(form, "Enter a full email address, like you@company.com.");
      input.focus();
      return;
    }
    button.disabled = true;
    const label = button.textContent;
    button.textContent = "Joining…";
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: form.dataset.source, company: $('[name="company"]', form).value, ...attribution() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({ position: data.position || null }));
        } catch {}
        markJoined(data.position);
        if (data.position) showCount(Math.max(data.position, liveCount ?? 0), true);
        return;
      }
      showError(
        form,
        data.error === "invalid_email"
          ? "Enter a full email address, like you@company.com."
          : "The waitlist didn't save your email. Try again in a moment."
      );
    } catch {
      showError(form, "Can't reach the waitlist. Check your connection and try again.");
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  function forms() {
    $$("[data-join]").forEach((form) => {
      form.addEventListener("submit", submit);
      $('input[type="email"]', form).addEventListener("input", () => clearError(form));
    });
    $$("[data-focus-join]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        const input = $("#email-hero");
        if (input && !input.closest("form").hidden) input.focus({ preventScroll: true });
      })
    );
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved) markJoined(saved.position);
    } catch {}
  }

  function nav() {
    const bar = $("[data-nav]");
    if (!bar) return;
    const update = () => bar.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", update, { passive: true });
    update();
  }

  inboxDemo();
  forms();
  liveWaitlist();
  nav();
})();
