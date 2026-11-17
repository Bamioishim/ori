use near_sdk::{
    env, near, require, AccountId, NearToken, PanicOnDefault, Promise,
};
use std::collections::HashSet;

const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const DAY_MS: u64 = 86_400_000;

#[near(serializers = [json])]
#[derive(Clone)]
pub struct Policy {
    pub per_payment_cap: u128,
    pub daily_cap: u128,
    pub allowed_recipients: Vec<AccountId>,
    pub recipient_allowlist_enabled: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct OriPolicyVault {
    owner: AccountId,
    policy: Policy,
    spent_day: u64,
    spent_today: u128,
}

#[near]
impl OriPolicyVault {
    #[init]
    pub fn new(owner: AccountId, per_payment_cap: String, daily_cap: String) -> Self {
        let per_payment_cap = per_payment_cap.parse::<u128>().expect("invalid per-payment cap");
        let daily_cap = daily_cap.parse::<u128>().expect("invalid daily cap");
        require!(per_payment_cap > 0 && daily_cap >= per_payment_cap, "invalid caps");
        Self {
            owner,
            policy: Policy {
                per_payment_cap,
                daily_cap,
                allowed_recipients: vec![],
                recipient_allowlist_enabled: false,
            },
            spent_day: env::block_timestamp_ms() / DAY_MS,
            spent_today: 0,
        }
    }

    /// Anyone can fund the vault. Funds are held by this contract, not by the caller's ORI wallet.
    #[payable]
    pub fn deposit(&self) {
        require!(env::attached_deposit().as_yoctonear() > 0, "attach NEAR to deposit");
    }

    /// Update policy. Owner authorization is enforced on-chain.
    #[payable]
    pub fn set_policy(
        &mut self,
        per_payment_cap: String,
        daily_cap: String,
        allowed_recipients: Vec<AccountId>,
        recipient_allowlist_enabled: bool,
    ) {
        self.assert_owner();
        require!(env::attached_deposit() == ONE_YOCTO, "attach exactly 1 yoctoNEAR");
        let per_payment_cap = per_payment_cap.parse::<u128>().expect("invalid per-payment cap");
        let daily_cap = daily_cap.parse::<u128>().expect("invalid daily cap");
        require!(per_payment_cap > 0 && daily_cap >= per_payment_cap, "invalid caps");
        let mut seen = HashSet::new();
        require!(allowed_recipients.iter().all(|a| seen.insert(a)), "duplicate recipient");
        self.policy = Policy {
            per_payment_cap,
            daily_cap,
            allowed_recipients,
            recipient_allowlist_enabled,
        };
    }

    /// Transfer NEAR held by this vault. Cap accounting is committed before the async transfer;
    /// failed transfers remain counted until the owner explicitly reviews and resets the policy.
    #[payable]
    pub fn transfer_near(&mut self, recipient: AccountId, amount_yocto: String) -> Promise {
        self.assert_owner();
        require!(env::attached_deposit() == ONE_YOCTO, "attach exactly 1 yoctoNEAR");
        let amount = amount_yocto.parse::<u128>().expect("invalid amount");
        require!(amount > 0, "amount must be positive");
        require!(amount <= self.policy.per_payment_cap, "over per-payment cap");
        if self.policy.recipient_allowlist_enabled {
            require!(self.policy.allowed_recipients.contains(&recipient), "recipient is not allowlisted");
        }

        let today = env::block_timestamp_ms() / DAY_MS;
        if today != self.spent_day {
            self.spent_day = today;
            self.spent_today = 0;
        }
        let next_spend = self.spent_today.checked_add(amount).expect("daily spend overflow");
        require!(next_spend <= self.policy.daily_cap, "over daily cap");

        let storage_reserve = env::storage_usage() as u128
            * env::storage_byte_cost().as_yoctonear();
        let available = env::account_balance().as_yoctonear().saturating_sub(storage_reserve);
        require!(amount <= available, "insufficient vault balance after storage reserve");

        self.spent_today = next_spend;
        Promise::new(recipient).transfer(NearToken::from_yoctonear(amount))
    }

    pub fn get_policy(&self) -> Policy {
        self.policy.clone()
    }

    pub fn get_spending(&self) -> (u64, String) {
        (self.spent_day, self.spent_today.to_string())
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "owner only");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn context(owner: &str) {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(owner.parse().unwrap())
            .current_account_id("ori-vault.testnet".parse().unwrap())
            .account_balance(NearToken::from_near(100))
            .block_timestamp(1_800_000_000_000_000_000);
        testing_env!(builder.build());
    }

    #[test]
    fn initializes_caps() {
        context("owner.testnet");
        let c = OriPolicyVault::new("owner.testnet".parse().unwrap(), "100".into(), "500".into());
        assert_eq!(c.get_policy().per_payment_cap, 100);
        assert_eq!(c.get_policy().daily_cap, 500);
    }

    #[test]
    #[should_panic(expected = "invalid caps")]
    fn rejects_daily_cap_below_per_payment() {
        context("owner.testnet");
        OriPolicyVault::new("owner.testnet".parse().unwrap(), "500".into(), "100".into());
    }
}
