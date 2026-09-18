pub const GENESIS_SEED: &[u8] = b"genesis";
pub const GENESIS_MAX_SUPPLY: u16 = 15_000;
pub const MAX_PET_NAME: usize = 32;
pub const MAX_SPECIES: usize = 16;

pub const GENETICS_VERSION_V1: u8 = 1;

// Stable species identifiers for the V1 ecosystem.
pub const SPECIES_OTTER: u8 = 1;
pub const SPECIES_CAT: u8 = 2;
pub const SPECIES_MONKEY: u8 = 3;
pub const SPECIES_DOG: u8 = 4;

// Sex identifiers are intentionally numeric so the schema can remain compact.
pub const SEX_FEMALE: u8 = 1;
pub const SEX_MALE: u8 = 2;

// V1 Genesis coat genes reference the shared 10-color coat pool A-J.
pub const COAT_GENE_A: u8 = 1;
pub const COAT_GENE_B: u8 = 2;
pub const COAT_GENE_C: u8 = 3;
pub const COAT_GENE_D: u8 = 4;
pub const COAT_GENE_E: u8 = 5;
pub const COAT_GENE_F: u8 = 6;
pub const COAT_GENE_G: u8 = 7;
pub const COAT_GENE_H: u8 = 8;
pub const COAT_GENE_I: u8 = 9;
pub const COAT_GENE_J: u8 = 10;

// V1 eye genes reference the six locked base eye colors.
pub const EYE_GENE_AMBER: u8 = 1;
pub const EYE_GENE_HONEY: u8 = 2;
pub const EYE_GENE_HAZEL: u8 = 3;
pub const EYE_GENE_BROWN: u8 = 4;
pub const EYE_GENE_BLUE: u8 = 5;
pub const EYE_GENE_GREEN: u8 = 6;

pub const PLAYER_IDENTITY_SEED: &[u8] = b"player";
pub const WALLET_ASSOCIATION_SEED: &[u8] = b"wallet";
pub const MAX_ASSOCIATED_WALLETS: u8 = 8;
