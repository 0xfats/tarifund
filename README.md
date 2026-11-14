# TariFund — crowdfunding with automatic refunds on Tari Ootle

**Entry for the Tari November Build Contest (MVP theme).**

A creator opens a campaign with a funding goal (in TARI) and a deadline (in
epochs). Anyone can contribute. After the deadline:

- **goal reached** → the creator calls `claim` and the whole vault goes to the
  creator's account;
- **goal missed** → every contributor can call `refund` and gets their own
  contribution back, in full.

There is no custodian and no platform fee: the contract itself enforces the
goal-or-refund rule. The only money that ever leaves the vault is a creator
claim after a reached goal, or a contributor's own refund after a missed goal.

## Why crowdfunding

People raising money in TARI today have no native tool: they use fiat
crowdfunding (custodial, fees, chargebacks) or a multisig (trust). TariFund
is the trustless version — the outcome is decided by the goal and the
deadline, not by anyone's goodwill. It is a product you could take to market
today: a community radio, a well map, a compost hub — the demo ships with
all three.

## What is in this repo

| Path | What it is |
|---|---|
| `template/` | The Rust Ootle template (`Campaign` component) + engine tests that run the compiled WASM through the real Ootle engine |
| `web/` | Walletless browser simulation of the same rules — open `web/index.html`, no wallet or funds needed |
| `SUBMISSION.md` | The contest submission package (links, description, remaining steps) |
| `BUILD_LOG.md` | Build diary |

## The template

`template/src/lib.rs` — `Campaign` component:

- `new(title, creator, goal, deadline_epoch)` — opens a campaign. Title
  1–140 bytes, goal > 0, deadline in the future.
- `contribute(contributor, payment)` — anyone, while the epoch is before the
  deadline. TARI only, amount > 0. Contributions accumulate per account.
- `claim()` — creator only (enforced by the component access rules), after
  the deadline, only when the goal was reached. Pays the whole vault.
- `refund(contributor)` — anyone, after the deadline, only when the goal was
  missed. Pays the contributor's own account, so triggering a refund can
  never steal someone else's money.
- `info()`, `contribution_of(account)`, `status()` — read-only views.
  Status is `open` / `funded` / `failed` / `claimed`.

Amounts are micro-Tari (µT): 1 TARI = 1,000,000 µT.

### Tests

```sh
cd template
cargo test        # 10 engine tests, real Ootle engine via tari_template_test_tooling
```

Covered: funded payout to the creator, full refunds on a failed campaign,
contributions after the deadline rejected, claims before the deadline and
below the goal rejected, refunds on a funded campaign rejected, creator-only
claim (`Access Denied` for anyone else), invalid campaigns rejected,
per-contributor accumulation, and the status lifecycle.

Build the WASM:

```sh
cd template
cargo build --release --target wasm32-unknown-unknown
```

## The web demo

A dependency-free static app that runs the same state machine as the template,
with the same error messages:

```sh
# any static server, or just open the file:
cd web && python3 -m http.server 8000
# then open http://localhost:8000/
```

```sh
node --test web/engine.test.js   # 10 simulation tests mirroring the Rust cases
```

The demo ships with three campaigns in the three states a judge needs to see:
one open (fund it, then advance the clock), one funded (claim it now), one
failed (refund it now). The epoch controls let you move time forward to test
the deadline. Every action logs the exact Ootle call it mirrors.

## Honest limits

- Contribution amounts are public on chain, as with any Ootle vault deposit;
  contributor identities are account addresses.
- The template has not been published to Esmeralda or mainnet yet and is not
  audited. The demo is a simulation; the on-chain path (Sapient wallet +
  publish) is the next step.
- Refunds pay the account named at contribution time — in the live app that is
  always the contributor's own connected account.
- No partial-funding payout and no milestone release by design:
  goal-or-refund is the whole point.

## Contest

Tari November Build Contest, theme MVP. Cutoff 1 Dec 2026, 00:00 UTC.
Prizes: 1st 1,000,000 XTM / 2nd 500,000 / 3rd 250,000, paid to a Tari
payment address. Submission thread:
<https://community.tari.com/t/november-build-contest-thread-mvp/520>

## License

MIT. See `LICENSE`.

Built by an AI agent under its owner's direction.
