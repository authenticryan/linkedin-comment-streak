// Sends the sign-in code with Resend's HTTP API (no SDK needed).
// The code is first in the subject, so it shows in a phone notification.
export function resendMailer({ apiKey, from }) {
  return async ({ to, code, minutes }) => {
    const text = [
      `Your Comment Streak sign-in code is ${code}.`,
      "",
      `Type it in the extension popup. It works for ${minutes} minutes.`,
      "If you did not ask for this code, ignore this email.",
    ].join("\n");
    const html = `<div style="font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2328">
  <p>Your Comment Streak sign-in code is</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0 16px">${code}</p>
  <p>Type it in the extension popup. It works for ${minutes} minutes.</p>
  <p style="color:#656d76">If you did not ask for this code, ignore this email.</p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: `${code} is your Comment Streak code`, text, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  };
}

// Local development: print the code instead of sending it.
export const consoleMailer = async ({ to, code }) => console.log(`[email] code for ${to}: ${code}`);
