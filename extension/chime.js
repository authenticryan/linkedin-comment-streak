// A short, soft bell synthesised with Web Audio (no sound files).
// Normal comment: two-note "ding-ding". Goal reached: rising four-note chime.
export function playChime(goalHit = false) {
  const ctx = new AudioContext();
  const notes = goalHit ? [1046.5, 1318.5, 1568, 2093] : [1318.5, 1760];
  const step = goalHit ? 0.09 : 0.08;
  const start = ctx.currentTime + 0.02;

  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);

  notes.forEach((freq, i) => {
    const t = start + i * step;
    // Fundamental plus a quiet overtone gives a bell-like tone.
    for (const [mult, amp, decay] of [[1, 1, 0.9], [2.01, 0.25, 0.4]]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(amp, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  });

  const totalMs = (notes.length * step + 1.1) * 1000;
  setTimeout(() => ctx.close(), totalMs);
}
