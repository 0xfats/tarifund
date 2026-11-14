// Node tests for web/engine.js — the simulation engine must mirror the Rust
// template rule-for-rule. Run: node --test web/engine.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const TF = require("./engine.js");
const MICRO = TF.MICRO;

function world() {
  const w = TF.newWorld();
  return w;
}

function create(w, creator, goal, deadline) {
  return TF.createCampaign(w, { title: "Community radio", creator, goal, deadlineEpoch: deadline });
}

function fails(fn, message) {
  assert.throws(fn, (err) => err instanceof Error && err.message === message);
}

test("funded campaign pays the creator", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, c, "budi", 600 * MICRO);
  TF.contribute(w, c, "citra", 500 * MICRO);
  assert.equal(c.balance, 1100 * MICRO);
  assert.equal(TF.status(c, w.epoch), "open");
  w.epoch = 200;
  assert.equal(TF.status(c, w.epoch), "funded");
  const before = w.balances.ayu;
  const paid = TF.claim(w, c, "ayu");
  assert.equal(paid, 1100 * MICRO);
  assert.equal(w.balances.ayu, before + 1100 * MICRO);
  assert.equal(c.balance, 0);
  assert.equal(TF.status(c, w.epoch), "claimed");
  fails(() => TF.claim(w, c, "ayu"), "already claimed");
});

test("failed campaign refunds every contributor", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, c, "budi", 400 * MICRO);
  TF.contribute(w, c, "citra", 300 * MICRO);
  w.epoch = 200;
  assert.equal(TF.status(c, w.epoch), "failed");
  const budiBefore = w.balances.budi;
  const citraBefore = w.balances.citra;
  assert.equal(TF.refund(w, c, "budi"), 400 * MICRO);
  assert.equal(TF.refund(w, c, "citra"), 300 * MICRO);
  assert.equal(w.balances.budi, budiBefore + 400 * MICRO);
  assert.equal(w.balances.citra, citraBefore + 300 * MICRO);
  assert.equal(c.balance, 0);
  fails(() => TF.refund(w, c, "budi"), "nothing to refund");
});

test("cannot contribute after the deadline", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  w.epoch = 200;
  fails(() => TF.contribute(w, c, "budi", 100 * MICRO), "campaign is closed");
  assert.equal(c.balance, 0);
});

test("cannot claim before the deadline or below the goal", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, c, "budi", 1000 * MICRO);
  fails(() => TF.claim(w, c, "ayu"), "campaign is still open");
  const d = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, d, "budi", 999 * MICRO);
  w.epoch = 200;
  fails(() => TF.claim(w, d, "ayu"), "goal not reached");
});

test("cannot refund a funded campaign", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, c, "budi", 1000 * MICRO);
  w.epoch = 200;
  fails(() => TF.refund(w, c, "budi"), "goal reached; no refunds");
  TF.claim(w, c, "ayu");
  fails(() => TF.refund(w, c, "budi"), "campaign was claimed");
});

test("only the creator can claim", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, c, "budi", 1000 * MICRO);
  w.epoch = 200;
  fails(() => TF.claim(w, c, "budi"), "Access Denied");
  assert.equal(c.balance, 1000 * MICRO);
  TF.claim(w, c, "ayu");
  assert.equal(c.balance, 0);
});

test("bad campaigns are rejected", () => {
  const w = world();
  fails(() => TF.createCampaign(w, { title: "", creator: "ayu", goal: 1000 * MICRO, deadlineEpoch: 200 }), "title must be 1 to 140 bytes");
  fails(() => TF.createCampaign(w, { title: "x", creator: "ayu", goal: 0, deadlineEpoch: 200 }), "goal must be more than zero");
  fails(() => TF.createCampaign(w, { title: "x", creator: "ayu", goal: 1000 * MICRO, deadlineEpoch: 100 }), "deadline must be in the future");
  const c = create(w, "ayu", 1000 * MICRO, 200);
  fails(() => TF.contribute(w, c, "budi", 0), "contribution must be more than zero");
});

test("contributions accumulate per contributor", () => {
  const w = world();
  const c = create(w, "ayu", 1000 * MICRO, 200);
  TF.contribute(w, c, "budi", 100 * MICRO);
  TF.contribute(w, c, "budi", 50 * MICRO);
  TF.contribute(w, c, "citra", 25 * MICRO);
  assert.equal(TF.contributionOf(c, "budi"), 150 * MICRO);
  assert.equal(c.contributorCount, 2);
  assert.equal(c.totalRaised, 175 * MICRO);
});

test("seeded demo covers all three states", () => {
  const w = TF.seedDemo(TF.newWorld());
  assert.equal(w.campaigns.length, 3);
  const byTitle = {};
  for (const c of w.campaigns) byTitle[c.title] = c;
  assert.equal(TF.status(byTitle["Community radio transmitter"], w.epoch), "open");
  assert.equal(TF.status(byTitle["Open map of Jakarta wells"], w.epoch), "funded");
  assert.equal(TF.status(byTitle["Neighborhood compost hub"], w.epoch), "failed");
  // The funded one is claimable and the failed one refundable right away.
  assert.equal(TF.claim(w, byTitle["Open map of Jakarta wells"], "budi"), 250 * MICRO);
  assert.equal(TF.refund(w, byTitle["Neighborhood compost hub"], "budi"), 50 * MICRO);
});

test("fmt prints TARI amounts cleanly", () => {
  assert.equal(TF.fmt(0), "0");
  assert.equal(TF.fmt(1 * MICRO), "1");
  assert.equal(TF.fmt(1500000), "1.5");
  assert.equal(TF.fmt(1001), "0.001001");
});
