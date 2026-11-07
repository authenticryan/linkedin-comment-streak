// Fake chrome.* APIs + a believable year of data, for rendering store screenshots.
(() => {
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const rand = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const counts = {};
  const now = new Date();
  for (let i = 1; i < 365; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const progress = 1 - i / 365; // more consistent in recent months
    if (i <= 23) {
      counts[key(d)] = 5 + Math.floor(rand(i + 7) * 5); // a 23-day streak
    } else if (rand(i) < 0.2 + 0.72 * progress) {
      counts[key(d)] = 1 + Math.floor(rand(i + 3) * (2 + 7 * progress));
    }
  }
  counts[key(now)] = 4;

  window.chrome = {
    storage: {
      local: { get: async () => ({ counts, goal: 5, sound: true }), set: async () => {} },
      onChanged: { addListener() {} },
    },
    runtime: { sendMessage() {} },
  };

  const style = document.createElement("style");
  style.textContent = "*{transition:none!important}";
  document.head.append(style);
})();
