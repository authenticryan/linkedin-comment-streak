// ⌘+Enter (Ctrl+Enter on Windows) posts the comment you're typing.
// It presses LinkedIn's own Comment/Reply button, so nothing else changes.

const SUBMIT_LABEL = /^(comment|reply|post)$/i;

function isCommentEditor(el) {
  const label = el.getAttribute("aria-label") || "";
  return (
    /comment|reply/i.test(label) ||
    // Older LinkedIn layout
    Boolean(el.closest(".comments-comment-box, .comments-comment-texteditor, form.comments-comment-box__form"))
  );
}

function isUsable(btn) {
  if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return false;
  const r = btn.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

// Walk up from the editor to the nearest Comment/Reply button. Stop if we
// reach a container that holds a second editor, so we never press the
// button belonging to a different comment box.
function findSubmit(editor) {
  let el = editor.parentElement;
  for (let depth = 0; el && depth < 10; depth++, el = el.parentElement) {
    if (el.querySelectorAll('[contenteditable="true"]').length > 1) return null;
    const btn = [...el.querySelectorAll("button")].find((b) => {
      const text = (b.textContent || "").trim() || b.getAttribute("aria-label") || "";
      return SUBMIT_LABEL.test(text) && isUsable(b);
    });
    if (btn) return btn;
  }
  return null;
}

window.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.isComposing || e.repeat) return;
    const editor = e.target instanceof Element && e.target.closest('[contenteditable="true"]');
    if (!editor || !isCommentEditor(editor)) return;
    if (!editor.textContent.trim() && !editor.querySelector("img")) return;

    const btn = findSubmit(editor);
    if (!btn) return;

    // Capture phase on window runs before the editor's own shortcut
    // (which would otherwise insert a line break).
    e.preventDefault();
    e.stopImmediatePropagation();
    btn.click();
  },
  true
);
