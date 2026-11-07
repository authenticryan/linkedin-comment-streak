import { test } from "node:test";
import assert from "node:assert/strict";
import { isCommentCreate, computeStats, level, dayKey, addDays } from "../extension/lib.js";

const post = (url, statusCode = 200) => isCommentCreate({ method: "POST", statusCode, url });

test("new LinkedIn app: counts createComment only", () => {
  const rsc = (path, id) => post(`https://www.linkedin.com/flagship-web/rsc-action/actions/${path}?sduiid=${id}&parentSpanId=abc`);

  // Real request names seen on linkedin.com (Nov 2026).
  assert.equal(rsc("server-request", "com.linkedin.sdui.comments.createComment"), true);
  // Fires ~80ms before every createComment; counting it would double count.
  assert.equal(rsc("component", "com.linkedin.sdui.generated.comments.dsl.impl.submitCommentButton"), false);
  for (const id of [
    "com.linkedin.sdui.comments.fetchFeedUpdateActionPrompt",
    "com.linkedin.sdui.update.comments.fetchComment",
    "com.linkedin.sdui.requests.comments.deferredCommentBox",
    "com.linkedin.sdui.requests.comments.courtesyReminder",
    "com.linkedin.sdui.requests.comments.getCommentPrompt",
    "com.linkedin.sdui.requests.getThirdPartyTrackingPixels",
  ]) {
    assert.equal(rsc("server-request", id), false, id);
  }
  assert.equal(rsc("pagination", "com.linkedin.sdui.pagers.feed.mainFeed"), false);
});

test("failed or non-POST requests never count", () => {
  const url = "https://www.linkedin.com/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.comments.createComment";
  assert.equal(post(url, 500), false);
  assert.equal(isCommentCreate({ method: "GET", statusCode: 200, url }), false);
});

test("classic LinkedIn API: create counts, edits and reads don't", () => {
  const base = "https://www.linkedin.com/voyager/api/";
  assert.equal(post(base + "voyagerSocialDashNormComments?decorationId=x"), true);
  assert.equal(post(base + "feed/comments"), true);
  assert.equal(post(base + "voyagerSocialDashNormComments/urn%3Ali%3Afsd_comment%3A(123)"), false);
  assert.equal(post(base + "voyagerSocialDashReactions?threadUrn=urn%3Ali%3Acomment%3A1"), false);
  assert.equal(isCommentCreate({ method: "GET", statusCode: 200, url: base + "voyagerSocialDashNormComments" }), false);
});

test("streaks", () => {
  const now = new Date(2026, 10, 7, 15);
  const today = new Date(2026, 10, 7);
  const counts = {};
  const set = (offset, n) => (counts[dayKey(addDays(today, offset))] = n);
  // goal 3: today 1 (not met yet), 3 met days, a gap, then 4 met days
  set(0, 1); set(-1, 3); set(-2, 5); set(-3, 3); set(-4, 0);
  set(-5, 3); set(-6, 3); set(-7, 4); set(-8, 9); set(-9, 2);

  assert.deepEqual(computeStats(counts, 3, now), { today: 1, current: 3, longest: 4, yearTotal: 33, goalDays30: 7 });
  set(0, 3);
  assert.equal(computeStats(counts, 3, now).current, 4, "meeting today's goal extends the streak");
});

test("heatmap shades are relative to the goal", () => {
  assert.deepEqual([0, 1, 2, 3, 5, 9, 10].map((n) => level(n, 5)), [0, 1, 1, 2, 3, 3, 4]);
});
