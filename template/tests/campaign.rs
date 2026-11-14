// SPDX-License-Identifier: MIT
//! Engine tests: every transaction here runs the compiled WASM through the same
//! engine Ootle validators use (tari_template_test_tooling).
use tari_template_lib::{
    prelude::TARI_TOKEN,
    types::{Amount, ComponentAddress, NonFungibleAddress},
};
use tari_template_test_tooling::{
    crypto::RistrettoSecretKey,
    engine_types::virtual_substate::{VirtualSubstate, VirtualSubstateId},
    support::assert_error::assert_reject_reason,
    transaction::args,
    TemplateTest,
};

const TEMPLATE: &str = "Campaign"; // the #[template] name is the component struct's name
/// Amounts are micro-Tari: 1 TARI = 1,000,000 µT.
const GOAL: u64 = 1_000_000;
const START_EPOCH: u64 = 100;
const DEADLINE: u64 = 200;

struct Who {
    account: ComponentAddress,
    proof: NonFungibleAddress,
    key: RistrettoSecretKey,
}

fn set_epoch(test: &mut TemplateTest, epoch: u64) {
    test.set_virtual_substate(VirtualSubstateId::CurrentEpoch, VirtualSubstate::CurrentEpoch(epoch));
}

fn who(test: &mut TemplateTest) -> Who {
    let (account, proof, key) = test.create_funded_account();
    Who { account, proof, key }
}

fn create_campaign(
    test: &mut TemplateTest,
    creator: &Who,
    title: &str,
    goal: u64,
    deadline: u64,
) -> ComponentAddress {
    let template = test.get_template_address(TEMPLATE);
    test.execute_expect_success(
        test.transaction()
            .call_function(
                template,
                "new",
                args![title.to_string(), creator.account, Amount::from(goal), deadline],
            )
            .build_and_seal(&creator.key),
        vec![creator.proof.clone()],
    );
    test.expect_return::<ComponentAddress>(0)
}

fn contribute(test: &mut TemplateTest, from: &Who, campaign: ComponentAddress, amount: u64) {
    test.execute_expect_success(
        test.transaction()
            .call_method(from.account, "withdraw", args![TARI_TOKEN, amount])
            .put_last_instruction_output_on_workspace("pay")
            .call_method(campaign, "contribute", args![from.account, Workspace("pay")])
            .build_and_seal(&from.key),
        vec![from.proof.clone()],
    );
}

fn contribute_fails(
    test: &mut TemplateTest,
    from: &Who,
    campaign: ComponentAddress,
    amount: u64,
    reason: &str,
) {
    let rejected = test.execute_expect_failure(
        test.transaction()
            .call_method(from.account, "withdraw", args![TARI_TOKEN, amount])
            .put_last_instruction_output_on_workspace("pay")
            .call_method(campaign, "contribute", args![from.account, Workspace("pay")])
            .build_and_seal(&from.key),
        vec![from.proof.clone()],
    );
    assert_reject_reason(rejected, reason);
}

fn claim(test: &mut TemplateTest, caller: &Who, campaign: ComponentAddress) {
    test.execute_expect_success(
        test.transaction()
            .call_method(campaign, "claim", args![])
            .build_and_seal(&caller.key),
        vec![caller.proof.clone()],
    );
}

fn claim_fails(test: &mut TemplateTest, caller: &Who, campaign: ComponentAddress, reason: &str) {
    let rejected = test.execute_expect_failure(
        test.transaction()
            .call_method(campaign, "claim", args![])
            .build_and_seal(&caller.key),
        vec![caller.proof.clone()],
    );
    assert_reject_reason(rejected, reason);
}

fn refund(test: &mut TemplateTest, caller: &Who, campaign: ComponentAddress, who: ComponentAddress) {
    test.execute_expect_success(
        test.transaction()
            .call_method(campaign, "refund", args![who])
            .build_and_seal(&caller.key),
        vec![caller.proof.clone()],
    );
}

fn refund_fails(
    test: &mut TemplateTest,
    caller: &Who,
    campaign: ComponentAddress,
    who: ComponentAddress,
    reason: &str,
) {
    let rejected = test.execute_expect_failure(
        test.transaction()
            .call_method(campaign, "refund", args![who])
            .build_and_seal(&caller.key),
        vec![caller.proof.clone()],
    );
    assert_reject_reason(rejected, reason);
}

fn status(test: &mut TemplateTest, caller: &Who, campaign: ComponentAddress) -> String {
    test.execute_expect_success(
        test.transaction()
            .call_method(campaign, "status", args![])
            .build_and_seal(&caller.key),
        vec![],
    );
    test.return_values()[0].decoded().unwrap()
}

fn tari(test: &TemplateTest, account: ComponentAddress) -> Amount {
    test.read_only_state_store()
        .get_vaults_for_account(account)
        .unwrap()
        .get(&TARI_TOKEN)
        .map(|v| v.balance())
        .unwrap_or_default()
}

fn campaign_balance(test: &TemplateTest, campaign: ComponentAddress) -> Amount {
    let vaults = test
        .read_only_state_store()
        .get_vaults_for_component(campaign)
        .unwrap();
    vaults.values().next().map(|v| v.balance()).unwrap_or_default()
}

fn start() -> (TemplateTest, Who) {
    let mut test = TemplateTest::my_crate();
    set_epoch(&mut test, START_EPOCH);
    let creator = who(&mut test);
    (test, creator)
}

#[test]
fn funded_campaign_pays_the_creator() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);
    let bob = who(&mut test);

    contribute(&mut test, &alice, campaign, 600_000);
    contribute(&mut test, &bob, campaign, 500_000);
    assert_eq!(campaign_balance(&test, campaign), Amount::from(1_100_000u64));
    assert_eq!(status(&mut test, &alice, campaign), "open");

    set_epoch(&mut test, DEADLINE);
    assert_eq!(status(&mut test, &alice, campaign), "funded");

    let before = tari(&test, creator.account);
    claim(&mut test, &creator, campaign);
    assert_eq!(tari(&test, creator.account), before + Amount::from(1_100_000u64));
    assert_eq!(campaign_balance(&test, campaign), Amount::zero());
    assert_eq!(status(&mut test, &alice, campaign), "claimed");

    // A claimed campaign never pays out again.
    claim_fails(&mut test, &creator, campaign, "already claimed");
}

#[test]
fn failed_campaign_refunds_every_contributor() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);
    let bob = who(&mut test);

    contribute(&mut test, &alice, campaign, 400_000);
    contribute(&mut test, &bob, campaign, 300_000);
    set_epoch(&mut test, DEADLINE);
    assert_eq!(status(&mut test, &alice, campaign), "failed");

    let alice_before = tari(&test, alice.account);
    let bob_before = tari(&test, bob.account);
    refund(&mut test, &alice, campaign, alice.account);
    refund(&mut test, &bob, campaign, bob.account);
    assert_eq!(tari(&test, alice.account), alice_before + Amount::from(400_000u64));
    assert_eq!(tari(&test, bob.account), bob_before + Amount::from(300_000u64));
    assert_eq!(campaign_balance(&test, campaign), Amount::zero());

    // Nothing left to refund.
    refund_fails(&mut test, &alice, campaign, alice.account, "nothing to refund");
}

#[test]
fn cannot_contribute_after_the_deadline() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);

    set_epoch(&mut test, DEADLINE);
    contribute_fails(&mut test, &alice, campaign, 100_000, "campaign is closed");
    assert_eq!(campaign_balance(&test, campaign), Amount::zero());
}

#[test]
fn cannot_claim_before_the_deadline() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);

    contribute(&mut test, &alice, campaign, GOAL);
    claim_fails(&mut test, &creator, campaign, "campaign is still open");
    assert_eq!(campaign_balance(&test, campaign), Amount::from(GOAL));
}

#[test]
fn cannot_claim_below_the_goal() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);

    contribute(&mut test, &alice, campaign, GOAL - 1);
    set_epoch(&mut test, DEADLINE);
    claim_fails(&mut test, &creator, campaign, "goal not reached");
    assert_eq!(campaign_balance(&test, campaign), Amount::from(GOAL - 1));
}

#[test]
fn cannot_refund_a_funded_campaign() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);

    contribute(&mut test, &alice, campaign, GOAL);
    set_epoch(&mut test, DEADLINE);
    refund_fails(&mut test, &alice, campaign, alice.account, "goal reached; no refunds");

    // And after the creator claims, refunds stay closed.
    claim(&mut test, &creator, campaign);
    refund_fails(&mut test, &alice, campaign, alice.account, "campaign was claimed");
}

#[test]
fn only_the_creator_can_claim() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);
    let mallory = who(&mut test);

    contribute(&mut test, &alice, campaign, GOAL);
    set_epoch(&mut test, DEADLINE);

    claim_fails(&mut test, &mallory, campaign, "Access Denied");
    assert_eq!(campaign_balance(&test, campaign), Amount::from(GOAL));

    // The creator can still claim after the failed attempt.
    claim(&mut test, &creator, campaign);
    assert_eq!(campaign_balance(&test, campaign), Amount::zero());
}

#[test]
fn bad_campaigns_are_rejected() {
    let (mut test, creator) = start();
    let template = test.get_template_address(TEMPLATE);

    let expect_fail = |test: &mut TemplateTest, title: &str, goal: u64, deadline: u64, reason: &str| {
        let rejected = test.execute_expect_failure(
            test.transaction()
                .call_function(
                    template,
                    "new",
                    args![title.to_string(), creator.account, Amount::from(goal), deadline],
                )
                .build_and_seal(&creator.key),
            vec![creator.proof.clone()],
        );
        assert_reject_reason(rejected, reason);
    };

    expect_fail(&mut test, "", GOAL, DEADLINE, "title must be 1 to 140 bytes");
    expect_fail(&mut test, "x", 0, DEADLINE, "goal must be more than zero");
    expect_fail(&mut test, "x", GOAL, START_EPOCH, "deadline must be in the future");

    // A zero contribution is rejected and nothing moves.
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);
    contribute_fails(&mut test, &alice, campaign, 0, "contribution must be more than zero");
    assert_eq!(campaign_balance(&test, campaign), Amount::zero());
}

#[test]
fn contributions_accumulate_and_count_distinct_contributors() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);
    let bob = who(&mut test);

    contribute(&mut test, &alice, campaign, 100_000);
    contribute(&mut test, &alice, campaign, 50_000);
    contribute(&mut test, &bob, campaign, 25_000);

    let (title, creator_addr, goal, balance, deadline, contributors, raised, refunded, claimed): (
        String,
        ComponentAddress,
        Amount,
        Amount,
        u64,
        u64,
        Amount,
        Amount,
        bool,
    ) = {
        test.execute_expect_success(
            test.transaction()
                .call_method(campaign, "info", args![])
                .build_and_seal(&alice.key),
            vec![],
        );
        test.return_values()[0].decoded().unwrap()
    };

    assert_eq!(title, "Community radio");
    assert_eq!(creator_addr, creator.account);
    assert_eq!(goal, Amount::from(GOAL));
    assert_eq!(balance, Amount::from(175_000u64));
    assert_eq!(deadline, DEADLINE);
    assert_eq!(contributors, 2);
    assert_eq!(raised, Amount::from(175_000u64));
    assert_eq!(refunded, Amount::zero());
    assert!(!claimed);
}

#[test]
fn status_reports_the_campaign_lifecycle() {
    let (mut test, creator) = start();
    let campaign = create_campaign(&mut test, &creator, "Community radio", GOAL, DEADLINE);
    let alice = who(&mut test);

    assert_eq!(status(&mut test, &alice, campaign), "open");
    contribute(&mut test, &alice, campaign, GOAL);
    assert_eq!(status(&mut test, &alice, campaign), "open");

    set_epoch(&mut test, DEADLINE);
    assert_eq!(status(&mut test, &alice, campaign), "funded");

    claim(&mut test, &creator, campaign);
    assert_eq!(status(&mut test, &alice, campaign), "claimed");
}
