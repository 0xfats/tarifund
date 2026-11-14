# TariFund — submission package for the Tari November Build Contest (MVP)

**Status: READY TO SUBMIT except the items in "Still needed from fattah" below.
Do NOT post the forum reply until those are filled in.**

Contest thread: https://community.tari.com/t/november-build-contest-thread-mvp/520
Cutoff: 1 Dec 2026, 00:00 UTC. Theme: MVP.
Prizes: 1st 1,000,000 XTM / 2nd 500,000 / 3rd 250,000, paid to a Tari payment address.

## 1. Public code link

**Repo (to publish): https://github.com/0xfats/tarifund** — local repo at
`~/workspace/tari-november-mvp/` (MIT license, all code written 15 Nov 2026,
after the 1 Nov announcement).

⚠️ PUBLISH STEP STILL NEEDED: no GitHub account/CLI is connected on this VM
(`gh auth` not present). At submit time: create the repo under fattah's
GitHub account (handle to confirm — `@0xfats` on X, GitHub username not yet
confirmed) and push `~/workspace/tari-november-mvp/`. The repo contains:
`template/` (Rust Ootle template + 10 engine tests), `web/` (walletless demo),
`README.md`, `LICENSE` (MIT), `BUILD_LOG.md`, `.github/workflows/ci.yml`.

## 2. Running MVP app link

**Demo link: https://muse.ai/s/tarifund-demo-xua79xi58xvxvd0/FZeAr5gOTPThxSa4sRbJxCl-C_3h2IsUXQTz5MSPbQs**

The demo is a static web app (Space "tarifund-demo", hosted on Muse). It is
tested end-to-end — the builder's live probe verified every flow: contribute
100 TARI (balance 5,000→4,900, log entry correct), claim the funded campaign
(250 TARI), refund a failed contribution (50 TARI; balance reconciled exactly),
create-form rejection with the exact message "deadline must be in the future",
jump to next deadline (100→150), reset, and persistence across reload.
No console errors, no mobile overflow. The same demo also lives locally in
`web/` (run with `cd web && python3 -m http.server 8000`).

## 3. Project description (for the forum reply)

> **TariFund — crowdfunding with automatic refunds on Tari Ootle.**
>
> A creator opens a campaign with a funding goal (in TARI) and a deadline (in
> epochs). Anyone can contribute. After the deadline, if the goal was reached
> the creator claims the whole vault; if it was missed, every contributor can
> refund their own contribution in full. No custodian, no platform fee — the
> contract enforces the rule.
>
> What it is:
> - A Rust Ootle template (`template/src/lib.rs`): `Campaign` component with
>   `new` / `contribute` / `claim` / `refund` / `info` / `contribution_of` /
>   `status`. Amounts in micro-Tari; creator-only claim via component access
>   rules; refunds always pay the contributor's own account.
> - 10 engine tests passing against the real Ootle engine
>   (`tari_template_test_tooling`), covering the funded payout, full refunds,
>   late contributions, early/below-goal claims, creator-only claim and the
>   status lifecycle.
> - A walletless browser demo that runs the same rules, so anyone can try the
>   full campaign lifecycle in two minutes — no wallet, no funds.
>
> Why it matters: people raising money in TARI today have no native tool —
> fiat crowdfunding is custodial and takes fees; a multisig needs trust.
> TariFund is the trustless version. It is a product you could take to market
> today: the demo ships with a community radio, a well map and a compost hub.
>
> Honest limits: contribution amounts are public on chain, as with any vault
> deposit; the template has not been published to Esmeralda or mainnet yet and
> is not audited; there is no partial-funding payout by design —
> goal-or-refund is the whole point.
>
> License: MIT. Built by an AI agent under its owner's direction.

## 4. Tari payment address

**Tari payment address (received from fattah 15 Nov 02:29 WIB):**
`125cwwkBcLMGRNnnwoozEKeWgWqnaEbuTNFRj8FGZTYFK48BNzy3c56yRhGeRp5y7sjzVfHvWL83xcHc4oauYzQuM3k`

How fattah gets one (free, ~5 minutes, his action — I cannot generate this
for him the way I generated his Solana wallet):
1. Install **Tari Universe Wallet** (free mobile app, Google Play / App Store)
   or the Tari Universe desktop app.
2. Create a wallet (it generates its own seed — keep it private, never paste
   it anywhere).
3. Copy the **receiving address** — it starts with `12` and is about 100
   characters, e.g. `12Gtjb5qbgYBbF9meZ31HKnEusGgnwfbDYBcZV3k4xko1htBQisjvgMW1zJL4gERkcryLntDKLqK2GQ2xEKD2i6Bq8s`.
4. Paste ONLY the address (public) into the submission. Never the seed.

Note: prizes are XTM on Tari L1, so the address must be a **Tari L1
(Minotari) address**, NOT an Ootle `otl_…` address (Sapient/Ootle addresses
cannot receive L1 XTM).

## 5. Draft social-media announcement

Accepted channels this month: Bluesky, Reddit, Medium, or YouTube (X is NOT
accepted; a Reddit throwaway is accepted). Draft (post on Reddit or Bluesky,
then link it in the forum reply):

> **TariFund — crowdfunding with automatic refunds on Tari Ootle**
>
> I built TariFund for the Tari November Build Contest (MVP theme).
>
> Set a goal and a deadline. If the goal is reached, the creator claims the
> vault. If it is missed, every contributor gets their money back — enforced
> by the template itself, no custodian, no platform fee.
>
> Try the walletless demo: https://muse.ai/s/tarifund-demo-xua79xi58xvxvd0/FZeAr5gOTPThxSa4sRbJxCl-C_3h2IsUXQTz5MSPbQs
> Code (MIT): https://github.com/0xfats/tarifund
>
> Built with an AI agent. Feedback welcome — especially on the refund path.

## 6. Still needed from fattah

1. **Tari payment address** ✅ DONE — received from fattah 15 Nov 02:29 WIB (see §4).
2. **Tari forum account** — a login for community.tari.com to post the reply
   (create one if needed; posting the reply is the one step that needs his
   account — I prepare the reply text, he (or a browser session under his
   login) posts it).
3. **GitHub username** to publish the repo under (confirm it is `0xfats`, or
   give the right handle) — and, if he wants the repo under his account, a
   one-time push from a machine where his GitHub is signed in.
4. **(Optional, bonus evidence only)** Install the **Sapient** browser
   extension (free, Chrome Web Store, sapient.tari.mw) to deploy the template
   to Esmeralda testnet and attach a live on-chain proof. NOT required —
   walletless sims are accepted entries.

## 7. Forum reply — final text (post after §6 is done)

```
TariFund — crowdfunding with automatic refunds on Tari Ootle

[description from §3]

Code: https://github.com/0xfats/tarifund
Live demo: https://muse.ai/s/tarifund-demo-xua79xi58xvxvd0/FZeAr5gOTPThxSa4sRbJxCl-C_3h2IsUXQTz5MSPbQs
Tari payment address: 125cwwkBcLMGRNnnwoozEKeWgWqnaEbuTNFRj8FGZTYFK48BNzy3c56yRhGeRp5y7sjzVfHvWL83xcHc4oauYzQuM3k
Announcement: [SOCIAL LINK]
```
