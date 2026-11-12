// Where the optional sync server runs (the server/ folder, deployed on Vercel).
// For local development, override it from the service worker console:
//   chrome.storage.local.set({ apiBase: "http://127.0.0.1:8787" })
export const API_BASE = "https://comment-streak-sync.vercel.app";
