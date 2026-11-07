import { playChime } from "./chime.js";

// The background worker can't play audio itself, so it asks this hidden page.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target === "offscreen" && msg.type === "chime") playChime(Boolean(msg.goalHit));
});
