// TariFund simulation engine — dependency-free, runs in the browser and Node.
// It mirrors template/src/lib.rs rule-for-rule, so the demo behaves exactly
// like the on-chain template: same asserts, same outcomes, same event names.
// Amounts are micro-Tari (µT): 1 TARI = 1,000,000 µT.
//
// The demo is a SIMULATION: no wallet is connected and no real TARI moves.
// The template is the source of truth; this engine exists so judges can run
// the full campaign lifecycle in the browser in two minutes.
(function (root) {
  "use strict";

  var MICRO = 1000000;
  var MAX_TITLE_BYTES = 140;
  var MAX_CONTRIBUTORS = 256;

  function fail(message) {
    var err = new Error(message);
    err.name = "TariFundError";
    throw err;
  }

  function fmt(amountMu) {
    var whole = Math.floor(amountMu / MICRO);
    var frac = amountMu % MICRO;
    if (frac === 0) return whole.toString();
    var text = whole + "." + String(frac).padStart(6, "0");
    return text.replace(/0+$/, "").replace(/\.$/, "");
  }

  function contributionOf(campaign, account) {
    for (var i = 0; i < campaign.contributions.length; i++) {
      if (campaign.contributions[i].account === account) {
        return campaign.contributions[i].amount;
      }
    }
    return 0;
  }

  function status(campaign, nowEpoch) {
    if (campaign.claimed) return "claimed";
    if (nowEpoch < campaign.deadlineEpoch) return "open";
    if (campaign.balance >= campaign.goal) return "funded";
    return "failed";
  }

  // --- template methods (same names, same rules as the Rust template) ---

  function createCampaign(world, opts) {
    var title = opts.title;
    if (!title || title.length === 0 || title.length > MAX_TITLE_BYTES) {
      fail("title must be 1 to 140 bytes");
    }
    if (!(opts.goal > 0)) fail("goal must be more than zero");
    if (!(opts.deadlineEpoch > world.epoch)) fail("deadline must be in the future");
    var campaign = {
      id: "c" + world.nextCampaignId++,
      title: title,
      creator: opts.creator, // account id, e.g. "ayu"
      goal: opts.goal,
      deadlineEpoch: opts.deadlineEpoch,
      balance: 0,
      contributions: [],
      contributorCount: 0,
      totalRaised: 0,
      totalRefunded: 0,
      claimed: false,
      createdEpoch: world.epoch,
    };
    world.campaigns.push(campaign);
    logEvent(world, { type: "Create", campaignId: campaign.id, who: opts.creator, amount: 0 });
    return campaign;
  }

  function contribute(world, campaign, contributor, amountMu) {
    if (!(amountMu > 0)) fail("contribution must be more than zero");
    if (!(world.epoch < campaign.deadlineEpoch)) fail("campaign is closed");
    if (campaign.claimed) fail("campaign already claimed");
    var balance = world.balances[contributor] || 0;
    if (balance < amountMu) fail("insufficient demo balance");
    var entry = null;
    for (var i = 0; i < campaign.contributions.length; i++) {
      if (campaign.contributions[i].account === contributor) entry = campaign.contributions[i];
    }
    if (!entry) {
      if (campaign.contributorCount >= MAX_CONTRIBUTORS) fail("campaign is full");
      entry = { account: contributor, amount: 0 };
      campaign.contributions.push(entry);
      campaign.contributorCount += 1;
    }
    entry.amount += amountMu;
    campaign.balance += amountMu;
    campaign.totalRaised += amountMu;
    world.balances[contributor] = balance - amountMu;
    logEvent(world, { type: "Contribute", campaignId: campaign.id, who: contributor, amount: amountMu });
    return campaign;
  }

  function claim(world, campaign, caller) {
    if (!(world.epoch >= campaign.deadlineEpoch)) fail("campaign is still open");
    if (campaign.claimed) fail("already claimed");
    if (!(campaign.balance >= campaign.goal)) fail("goal not reached");
    if (caller !== campaign.creator) fail("Access Denied");
    var amount = campaign.balance;
    campaign.claimed = true;
    campaign.balance = 0;
    world.balances[campaign.creator] = (world.balances[campaign.creator] || 0) + amount;
    logEvent(world, { type: "Claim", campaignId: campaign.id, who: caller, amount: amount });
    return amount;
  }

  function refund(world, campaign, contributor) {
    if (!(world.epoch >= campaign.deadlineEpoch)) fail("campaign is still open");
    if (campaign.claimed) fail("campaign was claimed");
    if (!(campaign.balance < campaign.goal)) fail("goal reached; no refunds");
    var amount = contributionOf(campaign, contributor);
    if (!(amount > 0)) fail("nothing to refund");
    for (var i = 0; i < campaign.contributions.length; i++) {
      if (campaign.contributions[i].account === contributor) {
        campaign.contributions[i].amount = 0;
      }
    }
    campaign.totalRefunded += amount;
    campaign.balance -= amount;
    world.balances[contributor] = (world.balances[contributor] || 0) + amount;
    logEvent(world, { type: "Refund", campaignId: campaign.id, who: contributor, amount: amount });
    return amount;
  }

  function logEvent(world, event) {
    event.epoch = world.epoch;
    world.events.push(event);
    if (world.events.length > 200) world.events.shift();
  }

  function newWorld() {
    return {
      epoch: 100,
      nextCampaignId: 1,
      balances: { ayu: 5000 * MICRO, budi: 2000 * MICRO, citra: 2000 * MICRO, dewi: 1500 * MICRO },
      campaigns: [],
      events: [],
    };
  }

  // Seeded demo campaigns: one in each terminal state, so a judge can see
  // every path immediately, then create their own campaign.
  function seedDemo(world) {
    var radio = createCampaign(world, {
      title: "Community radio transmitter",
      creator: "ayu",
      goal: 1000 * MICRO,
      deadlineEpoch: 200,
    });
    contribute(world, radio, "budi", 400 * MICRO);
    contribute(world, radio, "citra", 220 * MICRO);

    // Funded: deadline already passed (epoch 90 < now 100), goal reached.
    // Failed: deadline passed, goal missed — refunds are open.
    // Both are created while the clock is at epoch 80, then time is restored.
    world.epoch = 80;
    var map = createCampaign(world, {
      title: "Open map of Jakarta wells",
      creator: "budi",
      goal: 250 * MICRO,
      deadlineEpoch: 90,
    });
    contribute(world, map, "ayu", 150 * MICRO);
    contribute(world, map, "dewi", 100 * MICRO);

    var compost = createCampaign(world, {
      title: "Neighborhood compost hub",
      creator: "citra",
      goal: 500 * MICRO,
      deadlineEpoch: 90,
    });
    contribute(world, compost, "budi", 50 * MICRO);
    contribute(world, compost, "dewi", 30 * MICRO);
    world.epoch = 100;
    return world;
  }

  var api = {
    MICRO: MICRO,
    fmt: fmt,
    fail: fail,
    contributionOf: contributionOf,
    status: status,
    createCampaign: createCampaign,
    contribute: contribute,
    claim: claim,
    refund: refund,
    newWorld: newWorld,
    seedDemo: seedDemo,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.TariFund = api;
  }
})(typeof self !== "undefined" ? self : this);
