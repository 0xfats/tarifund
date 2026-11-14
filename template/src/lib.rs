// SPDX-License-Identifier: MIT
//! TariFund: crowdfunding with automatic refunds on Tari Ootle.
//!
//! A creator opens a campaign with a funding goal (in TARI) and a deadline
//! (in epochs). Anyone can contribute. After the deadline:
//!
//! * goal reached → the creator calls `claim` and the whole vault goes to
//!   the creator's account;
//! * goal missed → every contributor can call `refund` and gets their own
//!   contribution back, in full.
//!
//! There is no custodian and no platform fee: the contract itself enforces
//! the goal-or-refund rule. The only money that ever leaves the vault is a
//! creator claim after a reached goal, or a contributor's own refund after a
//! missed goal.
//!
//! Amounts are micro-Tari (µT): 1 TARI = 1,000,000 µT.
//!
//! What is public: the campaign, its goal, its deadline, the total raised,
//! and each contribution amount. Contributor identities are account addresses,
//! as with any Ootle component.

use tari_template_lib::prelude::*;

#[template]
mod tari_fund {
    use super::*;

    /// Campaign titles are short on purpose: they are shown on every listing.
    pub const MAX_TITLE_BYTES: usize = 140;
    /// Keeps a campaign's contributor list small enough to read in one call.
    pub const MAX_CONTRIBUTORS: usize = 256;

    pub struct Campaign {
        /// Short human-readable title, e.g. "Community radio transmitter".
        title: String,
        /// The account the payout goes to when the goal is reached.
        creator: ComponentAddress,
        /// Funding goal, in micro-Tari.
        goal: Amount,
        /// Last epoch in which contributions are accepted. Claims and refunds
        /// open at this epoch.
        deadline_epoch: u64,
        /// All contributions sit here until they are claimed or refunded.
        vault: Vault,
        /// Per-contributor totals, in contribution order. A contributor who
        /// contributes twice has one entry with the summed amount.
        contributions: Vec<(ComponentAddress, Amount)>,
        /// Number of distinct contributors.
        contributor_count: u64,
        /// Cumulative contributions, including refunded ones.
        total_raised: Amount,
        /// Cumulative refunds paid out.
        total_refunded: Amount,
        /// True once the creator has claimed. A claimed campaign never pays
        /// out again.
        claimed: bool,
    }

    impl Campaign {
        /// Opens a campaign. `creator` is the account the payout goes to; pass
        /// your own account. The signer of the creating transaction becomes the
        /// component owner and is the only one who can call `claim`.
        pub fn new(
            title: String,
            creator: ComponentAddress,
            goal: Amount,
            deadline_epoch: u64,
        ) -> Component<Self> {
            assert!(!title.is_empty() && title.len() <= MAX_TITLE_BYTES, "title must be 1 to 140 bytes");
            assert!(goal.is_positive(), "goal must be more than zero");
            assert!(
                deadline_epoch > Consensus::current_epoch(),
                "deadline must be in the future"
            );

            let access_rules = ComponentAccessRules::new()
                .method("contribute", rule![allow_all])
                .method("refund", rule![allow_all])
                .method("info", rule![allow_all])
                .method("contribution_of", rule![allow_all])
                .method("status", rule![allow_all]);

            Component::new(Self {
                title,
                creator,
                goal,
                deadline_epoch,
                vault: Vault::new_empty(TARI_TOKEN),
                contributions: Vec::new(),
                contributor_count: 0,
                total_raised: Amount::zero(),
                total_refunded: Amount::zero(),
                claimed: false,
            })
            .with_access_rules(access_rules)
            .create()
        }

        /// Contributes TARI to the campaign. Open to anyone while the campaign
        /// is before its deadline. `contributor` is the account the refund
        /// goes to if the goal is missed; pass your own account.
        pub fn contribute(&mut self, contributor: ComponentAddress, payment: Bucket) {
            assert!(payment.resource_address() == TARI_TOKEN, "contributions must be in TARI");
            let amount = payment.amount();
            assert!(amount.is_positive(), "contribution must be more than zero");
            assert!(
                Consensus::current_epoch() < self.deadline_epoch,
                "campaign is closed"
            );
            assert!(!self.claimed, "campaign already claimed");

            self.vault.deposit(payment);
            match self.contributions.iter_mut().find(|(who, _)| *who == contributor) {
                Some((_, total)) => {
                    *total = total.saturating_add(amount);
                }
                None => {
                    assert!(
                        self.contributor_count < MAX_CONTRIBUTORS as u64,
                        "campaign is full"
                    );
                    self.contributions.push((contributor, amount));
                    self.contributor_count += 1;
                }
            }
            self.total_raised = self.total_raised.saturating_add(amount);

            emit_event(
                "Contribute",
                metadata![
                    "title" => self.title.clone(),
                    "contributor" => contributor,
                    "amount" => amount,
                ],
            );
        }

        /// Pays the whole vault to the creator. Creator only (enforced by the
        /// component access rules), only after the deadline, and only when the
        /// goal was reached. Returns the amount paid.
        pub fn claim(&mut self) -> Amount {
            assert!(
                Consensus::current_epoch() >= self.deadline_epoch,
                "campaign is still open"
            );
            assert!(!self.claimed, "already claimed");
            let balance = self.vault.balance();
            assert!(balance >= self.goal, "goal not reached");

            self.claimed = true;
            let bucket = self.vault.withdraw(balance);
            ComponentManager::get(self.creator).invoke("deposit", args![bucket]);

            emit_event(
                "Claim",
                metadata![
                    "title" => self.title.clone(),
                    "creator" => self.creator,
                    "amount" => balance,
                ],
            );
            balance
        }

        /// Refunds one contributor's full contribution. Open to anyone after
        /// the deadline, but only when the goal was missed — and only to the
        /// contributor's own account, so triggering a refund can never steal
        /// someone else's money. Returns the amount refunded.
        pub fn refund(&mut self, contributor: ComponentAddress) -> Amount {
            assert!(
                Consensus::current_epoch() >= self.deadline_epoch,
                "campaign is still open"
            );
            assert!(!self.claimed, "campaign was claimed");
            assert!(self.vault.balance() < self.goal, "goal reached; no refunds");

            let amount = self.contribution_of(contributor);
            assert!(amount.is_positive(), "nothing to refund");

            if let Some((_, total)) = self
                .contributions
                .iter_mut()
                .find(|(who, _)| *who == contributor)
            {
                *total = Amount::zero();
            }
            self.total_refunded = self.total_refunded.saturating_add(amount);

            let bucket = self.vault.withdraw(amount);
            ComponentManager::get(contributor).invoke("deposit", args![bucket]);

            emit_event(
                "Refund",
                metadata![
                    "title" => self.title.clone(),
                    "contributor" => contributor,
                    "amount" => amount,
                ],
            );
            amount
        }

        /// Returns (title, creator, goal, balance, deadline, contributors,
        /// total raised, total refunded, claimed).
        pub fn info(
            &self,
        ) -> (
            String,
            ComponentAddress,
            Amount,
            Amount,
            u64,
            u64,
            Amount,
            Amount,
            bool,
        ) {
            (
                self.title.clone(),
                self.creator,
                self.goal,
                self.vault.balance(),
                self.deadline_epoch,
                self.contributor_count,
                self.total_raised,
                self.total_refunded,
                self.claimed,
            )
        }

        /// How much `contributor` has put in (and not yet had refunded).
        pub fn contribution_of(&self, contributor: ComponentAddress) -> Amount {
            self.contributions
                .iter()
                .find(|(who, _)| *who == contributor)
                .map(|(_, amount)| *amount)
                .unwrap_or_else(Amount::zero)
        }

        /// "open" before the deadline, "funded" after a reached deadline,
        /// "failed" after a missed deadline, "claimed" once the creator has
        /// been paid.
        pub fn status(&self) -> String {
            if self.claimed {
                "claimed".to_string()
            } else if Consensus::current_epoch() < self.deadline_epoch {
                "open".to_string()
            } else if self.vault.balance() >= self.goal {
                "funded".to_string()
            } else {
                "failed".to_string()
            }
        }
    }
}
