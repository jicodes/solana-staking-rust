use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

declare_id!("8cXhMUmMvLBwKgbfXrjAw6TxtXoVqNbFbky4smRNw25x");

pub mod constants {
    pub const VAULT_SEED: &[u8] = b"vault";
    pub const STAKE_INFO_SEED: &[u8] = b"stake_info";
    pub const TOKEN_SEED: &[u8] = b"token";
}

#[program]
pub mod solana_staking_rust {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let stake_info_account = &mut ctx.accounts.stake_info_account;

        if stake_info_account.is_staked {
            return Err(ErrorCode::TokensAlreadyStaked.into());
        }

        if amount == 0 {
            return Err(ErrorCode::NoTokensToStake.into());
        }

        let clock = Clock::get().unwrap();
        stake_info_account.stake_at_slot = clock.slot;
        stake_info_account.is_staked = true;

        let stake_amount = (amount)
            .checked_mul(10u64.pow(ctx.accounts.mint.decimals as u32))
            .unwrap();

        // do cross-program invocation to transfer tokens from user token account to user stake account
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.stake_account.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        Ok(())
    }

    pub fn destake(ctx: Context<DeStake>) -> Result<()> {
        let stake_info_account = &mut ctx.accounts.stake_info_account;

        if !stake_info_account.is_staked {
            return Err(ErrorCode::TokensNotStaked.into());
        }
        // calculate the reward
        let clock = Clock::get().unwrap();
        let stake_duration = clock.slot - stake_info_account.stake_at_slot;
        // simply based on the stake duration: 1 token per slot
        let reward = stake_duration
            .checked_mul(10u64.pow(ctx.accounts.mint.decimals as u32))
            .unwrap();

        // when signing on behalf of a PDA for the CPI,
        // we need to provide the seeds and bump to the signer and
        // use CpiContext::new_with_signer instead of CpiContext::new

        let vault_bump = ctx.bumps.token_vault_account;
        let seeds = &[constants::VAULT_SEED, &[vault_bump]];
        let signer = &[&seeds[..]];

        // do cross-program invocation to transfer reward from vault account to user token account
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_vault_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.token_vault_account.to_account_info(),
                },
                signer,
            ),
            reward,
        )?;

        // do cross-program invocation to transfer staked tokens from user stake account to user token account
        let staker = ctx.accounts.signer.key();
        let stake_account_bump = ctx.bumps.stake_account;
        let seeds = &[
            constants::TOKEN_SEED,
            staker.as_ref(),
            &[stake_account_bump],
        ];
        let signer = &[&seeds[..]];

        let stake_amount = ctx.accounts.stake_account.amount;

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.stake_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.stake_account.to_account_info(),
                },
                signer,
            ),
            stake_amount,
        )?;

        stake_info_account.is_staked = false;
        stake_info_account.stake_at_slot = clock.slot;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [constants::VAULT_SEED],
        bump,
        token::mint = mint,
        token::authority = token_vault_account, // to sign the transfer, authority is the vault account itself
    )]
    pub token_vault_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + std::mem::size_of::<StakeInfoAccount>(),
        seeds = [constants::STAKE_INFO_SEED, signer.key().as_ref()],
        bump,
    )]
    pub stake_info_account: Account<'info, StakeInfoAccount>, // custom account to store stake info, need space field

    #[account(
        init_if_needed,
        payer = signer,
        seeds = [constants::TOKEN_SEED, signer.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = stake_account,
    )]
    pub stake_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
pub struct StakeInfoAccount {
    pub stake_at_slot: u64, // the slot at which the stake was made
    pub is_staked: bool,
}

#[derive(Accounts)]
pub struct DeStake<'info> {
    #[account(
        mut,
        seeds = [constants::VAULT_SEED],
        bump,
    )]
    pub token_vault_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [constants::STAKE_INFO_SEED, signer.key().as_ref()],
        bump,
    )]
    pub stake_info_account: Account<'info, StakeInfoAccount>,

    #[account(
        mut,
        seeds = [constants::TOKEN_SEED, signer.key().as_ref()],
        bump,
    )]
    pub stake_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Tokens are already staked")]
    TokensAlreadyStaked,
    #[msg("Tokens are not staked")]
    TokensNotStaked,
    #[msg("No tokens to stake")]
    NoTokensToStake,
}
