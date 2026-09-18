use anchor_lang::prelude::*;

declare_id!("5BQfuedprGSxUQcqiP1enfA8J721dF274dYTvt4qwwsQ");

pub mod constants;
pub mod state;

use constants::*;
use state::*;

#[program]
pub mod solana_pets_nfp {
    use super::*;

    pub fn initialize_player_identity(ctx: Context<InitializePlayerIdentity>) -> Result<()> {
        let identity = &mut ctx.accounts.identity;
        identity.authority = ctx.accounts.authority.key();
        identity.created_at = Clock::get()?.unix_timestamp;
        identity.wallet_count = 0;
        Ok(())
    }

    pub fn associate_wallet(ctx: Context<AssociateWallet>) -> Result<()> {
        let identity = &mut ctx.accounts.identity;
        require!(
            identity.wallet_count < MAX_ASSOCIATED_WALLETS,
            PetError::WalletLimitReached
        );
        let association = &mut ctx.accounts.association;
        association.identity = identity.key();
        association.wallet = ctx.accounts.wallet.key();
        association.associated_at = Clock::get()?.unix_timestamp;
        association.active = true;
        identity.wallet_count = identity
            .wallet_count
            .checked_add(1)
            .ok_or(PetError::WalletLimitReached)?;
        Ok(())
    }

    pub fn deactivate_wallet(ctx: Context<DeactivateWallet>) -> Result<()> {
        let association = &mut ctx.accounts.association;
        require!(association.active, PetError::WalletAlreadyInactive);
        association.active = false;
        Ok(())
    }

    pub fn initialize_genesis(ctx: Context<InitializeGenesis>) -> Result<()> {
        let genesis = &mut ctx.accounts.genesis;
        genesis.authority = ctx.accounts.authority.key();
        genesis.max_supply = GENESIS_MAX_SUPPLY;
        genesis.minted = 0;
        genesis.paused = false;
        Ok(())
    }

    pub fn set_genesis_paused(ctx: Context<SetGenesisPaused>, paused: bool) -> Result<()> {
        ctx.accounts.genesis.paused = paused;
        Ok(())
    }

    pub fn create_pet(ctx: Context<CreatePet>, name: String, species: String) -> Result<()> {
        require!(!ctx.accounts.genesis.paused, PetError::GenesisPaused);
        require!(
            ctx.accounts.genesis.minted < ctx.accounts.genesis.max_supply,
            PetError::GenesisSoldOut
        );
        require!(name.len() <= MAX_PET_NAME, PetError::NameTooLong);
        require!(species.len() <= MAX_SPECIES, PetError::SpeciesTooLong);

        let genesis_number = ctx.accounts.genesis.minted + 1;
        let pet = &mut ctx.accounts.pet;
        pet.owner = ctx.accounts.payer.key();
        pet.name = name;
        pet.species = species.clone();
        pet.genesis_number = genesis_number;
        pet.hunger = 100;
        pet.is_alive = true;
        pet.genetics_version = GENETICS_VERSION_V1;
        pet.species_id = match species.as_str() {
            "Otter" => SPECIES_OTTER,
            "Cat" => SPECIES_CAT,
            "Monkey" => SPECIES_MONKEY,
            "Dog" => SPECIES_DOG,
            _ => return err!(PetError::UnsupportedSpecies),
        };
        pet.sex = 0;
        pet.coat_gene_a = 0;
        pet.coat_gene_b = 0;
        pet.eye_gene_a = 0;
        pet.eye_gene_b = 0;
        ctx.accounts.genesis.minted = genesis_number;
        msg!("Successfully minted Genesis SolanaPet #{}!", genesis_number);
        Ok(())
    }

    pub fn feed_pet(ctx: Context<FeedPet>) -> Result<()> {
        let pet = &mut ctx.accounts.pet;
        require!(pet.is_alive, PetError::PetIsDead);
        pet.hunger = std::cmp::min(pet.hunger + 20, 100);
        msg!("Fed {}! Fullness is now {}.", pet.name, pet.hunger);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePlayerIdentity<'info> {
    #[account(init, payer = authority, space = 8 + PlayerIdentity::INIT_SPACE, seeds = [PLAYER_IDENTITY_SEED, authority.key().as_ref()], bump)]
    pub identity: Account<'info, PlayerIdentity>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AssociateWallet<'info> {
    #[account(mut, seeds = [PLAYER_IDENTITY_SEED, authority.key().as_ref()], bump, has_one = authority)]
    pub identity: Account<'info, PlayerIdentity>,
    #[account(init, payer = authority, space = 8 + WalletAssociation::INIT_SPACE, seeds = [WALLET_ASSOCIATION_SEED, identity.key().as_ref(), wallet.key().as_ref()], bump)]
    pub association: Account<'info, WalletAssociation>,
    /// CHECK: wallet is the explicitly verified wallet being associated.
    pub wallet: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateWallet<'info> {
    #[account(mut, seeds = [PLAYER_IDENTITY_SEED, authority.key().as_ref()], bump, has_one = authority)]
    pub identity: Account<'info, PlayerIdentity>,
    #[account(mut, seeds = [WALLET_ASSOCIATION_SEED, identity.key().as_ref(), wallet.key().as_ref()], bump, has_one = identity)]
    pub association: Account<'info, WalletAssociation>,
    /// CHECK: wallet is the associated wallet.
    pub wallet: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeGenesis<'info> {
    #[account(init, payer = authority, space = 8 + GenesisConfig::INIT_SPACE, seeds = [GENESIS_SEED], bump)]
    pub genesis: Account<'info, GenesisConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetGenesisPaused<'info> {
    #[account(mut, seeds = [GENESIS_SEED], bump, has_one = authority)]
    pub genesis: Account<'info, GenesisConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreatePet<'info> {
    #[account(mut, seeds = [GENESIS_SEED], bump)]
    pub genesis: Account<'info, GenesisConfig>,
    #[account(init, payer = payer, space = 8 + Pet::INIT_SPACE)]
    pub pet: Account<'info, Pet>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FeedPet<'info> {
    #[account(mut, has_one = owner)]
    pub pet: Account<'info, Pet>,
    pub owner: Signer<'info>,
}

#[error_code]
pub enum PetError {
    #[msg("This pet has passed away.")]
    PetIsDead,
    #[msg("Genesis minting is paused.")]
    GenesisPaused,
    #[msg("The Genesis supply is sold out.")]
    GenesisSoldOut,
    #[msg("Pet name is too long.")]
    NameTooLong,
    #[msg("Species name is too long.")]
    SpeciesTooLong,
    #[msg("Species is not enabled in the V1 Genesis collection.")]
    UnsupportedSpecies,
    #[msg("The maximum number of wallets is already associated.")]
    WalletLimitReached,
    #[msg("The wallet association is already inactive.")]
    WalletAlreadyInactive,
}
