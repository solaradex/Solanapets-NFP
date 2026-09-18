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
});
