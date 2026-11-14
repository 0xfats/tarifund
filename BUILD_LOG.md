# TariFund — Build Log

Entry for the Tari November Build Contest (MVP theme). Cutoff: 1 Dec 2026, 00:00 UTC.

## Idea

**TariFund — crowdfunding with automatic refunds on Tari Ootle.**
A creator opens a campaign with a funding goal (in TARI) and a deadline (in
epochs). Anyone can contribute. After the deadline:
- goal reached → the creator claims the whole vault;
- goal missed → every contributor can refund their own contribution.

Why this one: none of the 13 existing November entries covers crowdfunding.
It is the most universally understood "go to market today" product, the
trust story (goal-or-refund enforced by the contract, no custodian) is easy
for judges to verify in two minutes, and the rules are crisp enough to test
thoroughly. It is deliberately not the flashiest idea — it is the most
shippable one.

## 2026-11-15 ~01:50 WIB — research

- Read the full contest thread (t/520): 13 entries as of 14 Nov — QuietTicket
  (silent voting), Ootle Pass (memberships), Ootip (tip jars), Signal Desk
  (sealed calls), Ootle Lockbox (time-locks), OotleInvoice, Allowance (agent
  spending), Skydrop/ATProto (Bluesky money), Specter, hidebox, Launch
  Commitments, Stake (goal commitments), Ghostline (pay-per-call). Several
  are already live on Ootle mainnet.
- Read the full contest rules (t/323): new code as of 1 Nov announcement,
  OSI license (MIT), agent development explicitly allowed
  ("Development using agents is fine"), submission = public code link +
  description + Tari payment address + social-media post (Bluesky/Reddit/
  Medium/YouTube). Winners voted by the Council, announced next month.
- Studied the Ootip template + engine tests (MIT, GeiserX/ootip) to learn the
  exact `tari_template_lib` 0.40 / `tari_template_test_tooling` 0.53 API
  (component access rules, Vault, `ComponentManager::get().invoke("deposit")`,
  `Consensus::current_epoch()`, `set_virtual_substate` for epochs in tests),
  and the Ootle Pass tests for epoch movement.
- Environment: no `gh` auth, no cargo/rust preinstalled. Installed rustup
  stable 1.100.0 + wasm32-unknown-unknown target. crates.io sparse index
  reachable; `tari_template_lib` 0.40.1 / `tari_template_test_tooling`
  0.53.4 confirmed available.

## 2026-11-15 — scaffold

- Repo layout mirrors the Ootip structure judges already recognize:
  `template/` (Rust `#[template]` + engine tests), `web/` (walletless
  simulation demo + Node tests), `.github/workflows/ci.yml`.
- Template: `Campaign` component — `new`, `contribute`, `claim`
  (creator-only via access rules), `refund`, `info`, `contribution_of`,
  `status`. Contributions recorded per account in a `Vec` (same pattern as
  Ootip's shares). Amounts are micro-Tari (µT), 1 TARI = 1,000,000 µT.
- Web demo: dependency-free static app. Same state machine as the template,
  seeded demo campaigns in three states (open / funded / failed), persona
  wallets with simulated TARI, epoch simulator (advance time to test the
  deadline), and an event log that shows the exact Ootle call each step
  mirrors. Clearly labelled SIMULATION; no wallet, no real funds.

## 2026-11-15 ~02:45 WIB — tests, demo polish, wallet research

- `cargo test` started — still compiling (tari + wasmer crates are heavy;
  expected to take a while on this VM). Not yet green — verify before calling
  the template done.
- Web demo finished and tested: `engine.js` (sim engine mirroring lib.rs
  rule-for-rule; seeded campaigns in open/funded/failed states),
  `engine.test.js` — 10 Node tests mirroring the Rust cases: **10/10 PASS**,
  `index.html` + `app.js` — personas, epoch controls (+1/+10/jump/reset),
  create/contribute/claim/refund actions, event log with mirrored Ootle call,
  honest-limits box. `node --check` clean on all JS; element IDs verified.
- README.md + `.github/workflows/ci.yml` written.
- Wallet research (web): prize address is a **Tari L1 (Minotari) address**
  (`12…`, ~100 chars). Fattah creates it himself in the free Tari Universe
  Wallet app (~5 min); Leo cannot generate it like the Solana wallet and must
  never hold/request his seed. Ootle deployment would use the Sapient browser
  extension (free, Chrome Web Store, `window.tari` provider, Esmeralda faucet
  in-app) — optional bonus evidence, needs fattah's browser.
- SUBMISSION.md written with the package + the 4 items still needed from
  fattah (Tari address, forum account, GitHub username, optional Sapient).
- Cargo test result recorded below once it finishes; the web tests already
  pass. The demo still needs a public host link (Space) — see SUBMISSION.md.

## 2026-11-15 ~03:00 WIB — lib compiles, demo hosted

- `cargo check --lib` PASSED (2m 10s, no errors): lib.rs compiles clean
  against tari_template_lib 0.40.1. Full `cargo test` (engine tests via
  tari_template_test_tooling + wasmer) still compiling at ~03:00 — the
  wasmer build is the long pole; result to be recorded when it lands.
- Demo hosted as Space "tarifund-demo" and SHARED: public link
  https://muse.ai/s/tarifund-demo-xua79xi58xvxvd0/FZeAr5gOTPThxSa4sRbJxCl-C_3h2IsUXQTz5MSPbQs
  Builder's live probe verified every flow end-to-end (contribute/claim/
  refund balances reconciled exactly, create rejection with the exact
  message, jump/reset/persistence, no console errors, no mobile overflow).
  SUBMISSION.md updated with the live link.

## 2026-11-15 ~03:20 WIB — engine tests GREEN

- Root cause of the first test run (0/10, all "No template with name
  TariFund"): the `#[template]` macro names the template after the component
  struct (`Campaign`), not the crate. Tests used "TariFund". Fix: one line in
  `tests/campaign.rs` — `const TEMPLATE: &str = "Campaign";`
- Re-run: **10/10 engine tests PASS** (real Ootle engine via
  `tari_template_test_tooling` 0.53.4, 14.77s). The template's rules are now
  verified on-chain-equivalent logic, not just in the web sim.
- Release WASM build verified (see command output above).
