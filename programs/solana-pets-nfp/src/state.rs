use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GenesisConfig {
    pub authority: Pubkey,
    pub max_supply: u16,
    pub minted: u16,
    pub paused: bool,
}
