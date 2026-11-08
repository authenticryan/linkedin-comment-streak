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
      counts[key(d)] = 100 + Math.floor(rand(i + 7) * 100); // a 23-day streak at the default goal of 100
    } else if (rand(i) < 0.2 + 0.72 * progress) {
      counts[key(d)] = 20 * (1 + Math.floor(rand(i + 3) * (2 + 7 * progress))) - Math.floor(rand(i + 11) * 15);
    }
  }
  counts[key(now)] = 80;

  window.chrome = {
    storage: {
      local: { get: async () => ({ counts, goal: 100, sound: true }), set: async () => {} },
      onChanged: { addListener() {} },
    },
    runtime: { sendMessage() {} },
  };

  const style = document.createElement("style");
  style.textContent = "*{transition:none!important}";
  document.head.append(style);
})();
