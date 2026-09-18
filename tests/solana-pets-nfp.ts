import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaPetsNfp } from "../target/types/solana_pets_nfp";

describe("solana-pets-nfp", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolanaPetsNfp as Program<SolanaPetsNfp>;

  const [genesisPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("genesis")],
    program.programId,
  );

  it("initializes Genesis and mints Luna #1", async () => {
    await program.methods
      .initializeGenesis()
      .accounts({
        genesis: genesisPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const petAccount = anchor.web3.Keypair.generate();

    await program.methods
      .createPet("Luna", "Otter")
      .accounts({
        genesis: genesisPda,
        pet: petAccount.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([petAccount])
      .rpc();

    const genesis = await program.account.genesisConfig.fetch(genesisPda);
    const pet = await program.account.pet.fetch(petAccount.publicKey);

    if (genesis.maxSupply !== 15000) {
      throw new Error("Genesis max supply must be 15000");
    }
    if (genesis.minted !== 1) {
      throw new Error("Genesis minted counter must be 1 after the first mint");
    }
    if (pet.genesisNumber !== 1) {
      throw new Error("First Genesis pet must be numbered #1");
    }
    if (pet.name !== "Luna" || pet.species !== "Otter") {
      throw new Error("Luna pet data is incorrect");
    }
  });

  it("supports one v2 identity with multiple wallet associations", async () => {
    const [identityPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player-v2"), provider.wallet.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .initializePlayerIdentityV2()
      .accounts({
        identity: identityPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const secondaryWallet = anchor.web3.Keypair.generate().publicKey;
    const [associationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("wallet-v2"), identityPda.toBuffer(), secondaryWallet.toBuffer()],
      program.programId,
    );

    await program.methods
      .associateWalletV2()
      .accounts({
        identity: identityPda,
        association: associationPda,
        wallet: secondaryWallet,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const identity = await program.account.playerIdentity.fetch(identityPda);
    const association = await program.account.walletAssociation.fetch(associationPda);
    if (identity.walletCount !== 1) throw new Error("V2 identity wallet count should be 1");
    if (!association.active || !association.wallet.equals(secondaryWallet)) throw new Error("V2 wallet association is incorrect");
  });
});
