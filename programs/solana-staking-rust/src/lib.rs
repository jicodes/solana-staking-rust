use anchor_lang::prelude::*;

declare_id!("63uB2o4jHubS5RJUWYt8QwAp74RqzBrt4Eci3rzgL7sC");

#[program]
pub mod solana_staking_rust {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
