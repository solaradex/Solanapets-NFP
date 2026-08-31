use anchor_lang::prelude::*;

declare_id!("5BQfuedprGSxUQcqiP1enfA8J721dF274dYTvt4qwwsQ");

#[program]
pub mod solana_pets_nfp {
    use super::*;

    pub fn create_pet(ctx: Context<CreatePet>, name: String, species: String) -> Result<()> {
        let pet = &mut ctx.accounts.pet;
        pet.owner = ctx.accounts.payer.key();
        pet.name = name;
        pet.species = species;
        pet.hunger = 100;
        pet.is_alive = true;
        
        msg!("Successfully minted {} the {}!", pet.name, pet.species);
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

// --- ACCOUNT STRUCTURES ---

#[derive(Accounts)]
pub struct CreatePet<'info> {
    #[account(init, payer = payer, space = 8 + 32 + 50 + 50 + 8 + 1)]
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

// --- DATA STRUCTURES ---

#[account]
pub struct Pet {
    pub owner: Pubkey,
    pub name: String,
    pub species: String,
    pub hunger: u64,
    pub is_alive: bool,
}

// --- ERRORS ---

#[error_code]
pub enum PetError {
    #[msg("This pet has passed away.")]
    PetIsDead,
}