use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GenesisConfig {
    pub authority: Pubkey,
    pub max_supply: u16,
    pub minted: u16,
    pub paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Pet {
    pub owner: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(16)]
    pub species: String,
    pub genesis_number: u16,
    pub hunger: u64,
    pub is_alive: bool,
    pub genetics_version: u8,
    pub species_id: u8,
    pub sex: u8,
    pub coat_gene_a: u8,
    pub coat_gene_b: u8,
    pub eye_gene_a: u8,
    pub eye_gene_b: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerIdentity {
    pub authority: Pubkey,
    pub created_at: i64,
    pub wallet_count: u8,
}

#[account]
#[derive(InitSpace)]
pub struct WalletAssociation {
    pub identity: Pubkey,
    pub wallet: Pubkey,
    pub associated_at: i64,
    pub active: bool,
}
