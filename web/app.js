// TariFund demo UI — wires the simulation engine (engine.js) to the page.
// No network, no wallet, no keys. State is kept in localStorage.
(function () {
  "use strict";

  var TF = window.TariFund;
  var MICRO = TF.MICRO;
  var PERSONAS = [
    { id: "ayu", name: "Ayu", role: "creator" },
    { id: "budi", name: "Budi", role: "contributor" },
    { id: "citra", name: "Citra", role: "contributor" },
    { id: "dewi", name: "Dewi", role: "contributor" },
  ];
  var STORE_KEY = "tarifund-demo-v1";

  var world = loadWorld();
  var activePersona = "ayu";

  function loadWorld() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var w = JSON.parse(raw);
        if (w && Array.isArray(w.campaigns) && typeof w.epoch === "number") return w;
      }
    } catch (e) { /* corrupted state: reseed below */ }
    var fresh = TF.seedDemo(TF.newWorld());
    saveWorld(fresh);
    return fresh;
  }

  function saveWorld(w) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(w)); } catch (e) { /* storage unavailable: session-only */ }
  }
  function save() { saveWorld(world); }

  function $(id) { return document.getElementById(id); }

  function toast(message, ok) {
    var el = $("toast");
    el.textContent = message || "";
    el.className = "toast " + (ok ? "ok" : "err");
  }

  function callLabel(ev) {
    var title = "";
    for (var i = 0; i < world.campaigns.length; i++) {
      if (world.campaigns[i].id === ev.campaignId) title = world.campaigns[i].title;
    }
    var who = ev.who || "";
    if (ev.type === "Create") return 'Campaign::new("' + title + '")';
    if (ev.type === "Contribute") return "campaign.contribute(" + who + ", " + TF.fmt(ev.amount) + " TARI)";
    if (ev.type === "Claim") return "campaign.claim() → " + TF.fmt(ev.amount) + " TARI to " + who;
    if (ev.type === "Refund") return "campaign.refund(" + who + ") → " + TF.fmt(ev.amount) + " TARI";
    return ev.type;
  }

  function render() {
    $("epoch").textContent = world.epoch;
    $("deadlineHint").textContent = world.epoch + 100;

    // Personas
    var personasEl = $("personas");
    personasEl.innerHTML = "";
    PERSONAS.forEach(function (p) {
      var div = document.createElement("div");
      div.className = "persona" + (p.id === activePersona ? " active" : "");
      div.innerHTML = "<b>" + p.name + "</b> <span class='mut small'>" + p.role + "</span><br>" +
        "<span class='bal'>" + TF.fmt(world.balances[p.id] || 0) + " TARI</span>";
      div.onclick = function () { activePersona = p.id; render(); };
      personasEl.appendChild(div);
    });

    // Campaign cards
    var cardsEl = $("cards");
    cardsEl.innerHTML = "";
    var sorted = world.campaigns.slice().sort(function (a, b) { return b.createdEpoch - a.createdEpoch; });
    sorted.forEach(function (c) {
      var st = TF.status(c, world.epoch);
      var pct = c.goal > 0 ? Math.min(100, Math.round((c.balance / c.goal) * 100)) : 0;
      var card = document.createElement("div");
      card.className = "card";
      var mine = TF.contributionOf(c, activePersona);
      var html = "<div class='row' style='justify-content:space-between'><h3>" + escapeHtml(c.title) + "</h3>" +
        "<span class='status st-" + st + "'>" + st + "</span></div>" +
        "<div class='bar'><div style='width:" + pct + "%'></div></div>" +
        "<div class='kv'><span>Raised</span><b>" + TF.fmt(c.balance) + " / " + TF.fmt(c.goal) + " TARI (" + pct + "%)</b></div>" +
        "<div class='kv'><span>Creator</span><span>" + personaName(c.creator) + "</span></div>" +
        "<div class='kv'><span>Deadline</span><span>epoch " + c.deadlineEpoch + "</span></div>" +
        "<div class='kv'><span>Contributors</span><span>" + c.contributorCount + " · raised " + TF.fmt(c.totalRaised) + " · refunded " + TF.fmt(c.totalRefunded) + "</span></div>";
      if (mine > 0) {
        html += "<div class='kv'><span>Your contribution</span><b>" + TF.fmt(mine) + " TARI</b></div>";
      }
      if (c.contributions.length) {
        var list = c.contributions.filter(function (x) { return x.amount > 0; })
          .map(function (x) { return personaName(x.account) + " " + TF.fmt(x.amount); }).join(" · ");
        html += "<p class='small mut'>" + escapeHtml(list) + "</p>";
      }
      html += "<div class='row' style='margin-top:10px'>";
      if (st === "open") {
        html += "<input type='number' min='1' step='1' placeholder='Amount (TARI)' data-amount-for='" + c.id + "'>" +
          "<button data-contribute='" + c.id + "'>Contribute</button>";
      }
      if (st === "funded" && activePersona === c.creator) {
        html += "<button data-claim='" + c.id + "'>Claim " + TF.fmt(c.balance) + " TARI</button>";
      }
      if (st === "funded" && activePersona !== c.creator) {
        html += "<span class='small mut'>Only the creator (" + personaName(c.creator) + ") can claim.</span>";
      }
      if (st === "failed" && mine > 0) {
        html += "<button data-refund='" + c.id + "'>Refund my " + TF.fmt(mine) + " TARI</button>";
      }
      if (st === "failed" && mine === 0) {
        html += "<span class='small mut'>Goal missed — contributors can refund.</span>";
      }
      if (st === "claimed") {
        html += "<span class='small mut'>Creator claimed. This campaign is settled.</span>";
      }
      html += "</div>";
      card.innerHTML = html;
      cardsEl.appendChild(card);
    });

    // Event log
    var logEl = $("log");
    if (!world.events.length) {
      logEl.textContent = "No events yet — contribute or create a campaign.";
    } else {
      logEl.innerHTML = world.events.slice(-60).map(function (ev) {
        return "<span class='mut'>[epoch " + ev.epoch + "]</span> " + escapeHtml(callLabel(ev)) + " <span class='ok'>✓</span>";
      }).join("\n");
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function personaName(id) {
    for (var i = 0; i < PERSONAS.length; i++) if (PERSONAS[i].id === id) return PERSONAS[i].name;
    return id;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function findCampaign(id) {
    for (var i = 0; i < world.campaigns.length; i++) if (world.campaigns[i].id === id) return world.campaigns[i];
    return null;
  }

  function act(fn) {
    try {
      var result = fn();
      save();
      render();
      return result;
    } catch (err) {
      toast("Rejected: " + err.message, false);
      render();
      return null;
    }
  }

  // Events
  $("createBtn").onclick = function () {
    var title = $("newTitle").value.trim();
    var goalTari = parseFloat($("newGoal").value);
    var deadline = parseInt($("newDeadline").value, 10);
    if (!title || isNaN(goalTari) || isNaN(deadline)) { toast("Fill in a title, a goal and a deadline epoch.", false); return; }
    act(function () {
      TF.createCampaign(world, {
        title: title,
        creator: activePersona,
        goal: Math.round(goalTari * MICRO),
        deadlineEpoch: deadline,
      });
      $("newTitle").value = "";
      $("newGoal").value = "";
      $("newDeadline").value = "";
      toast("Campaign created.", true);
    });
  };

  $("cards").addEventListener("click", function (e) {
    var t = e.target;
    var cId = t.getAttribute("data-contribute") || t.getAttribute("data-claim") || t.getAttribute("data-refund");
    if (!cId) return;
    var c = findCampaign(cId);
    if (!c) return;
    if (t.hasAttribute("data-contribute")) {
      var input = document.querySelector("input[data-amount-for='" + cId + "']");
      var amountTari = input ? parseFloat(input.value) : NaN;
      if (isNaN(amountTari) || amountTari <= 0) { toast("Enter an amount in TARI first.", false); return; }
      act(function () {
        TF.contribute(world, c, activePersona, Math.round(amountTari * MICRO));
        toast(personaName(activePersona) + " contributed " + amountTari + " TARI.", true);
      });
    } else if (t.hasAttribute("data-claim")) {
      act(function () {
        var paid = TF.claim(world, c, activePersona);
        toast("Claimed " + TF.fmt(paid) + " TARI to " + personaName(activePersona) + ".", true);
      });
    } else if (t.hasAttribute("data-refund")) {
      act(function () {
        var back = TF.refund(world, c, activePersona);
        toast("Refunded " + TF.fmt(back) + " TARI to " + personaName(activePersona) + ".", true);
      });
    }
  });

  function advance(n) {
    world.epoch += n;
    save();
    render();
  }

  $("adv1").onclick = function () { advance(1); };
  $("adv10").onclick = function () { advance(10); };
  $("jump").onclick = function () {
    var next = null;
    world.campaigns.forEach(function (c) {
      if (c.deadlineEpoch > world.epoch && (next === null || c.deadlineEpoch < next)) next = c.deadlineEpoch;
    });
    if (next === null) { toast("No open deadlines ahead.", false); return; }
    world.epoch = next;
    save();
    render();
  };
  $("reset").onclick = function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    world = TF.seedDemo(TF.newWorld());
    activePersona = "ayu";
    save();
    toast("Demo reset.", true);
    render();
  };

  render();
})();
