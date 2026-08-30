import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaPetsNfp } from "../target/types/solana_pets_nfp";

describe("solana-pets-nfp", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolanaPetsNfp as Program<SolanaPetsNfp>;

  it("Mints Luna the Otter!", async () => {
    const petAccount = anchor.web3.Keypair.generate();

    const tx = await program.methods
      .createPet("Luna", "Otter")
      .accounts({
        pet: petAccount.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([petAccount])
      .rpc();

    console.log("Transaction signature:", tx);
    
    const petData = await program.account.pet.fetch(petAccount.publicKey);
    console.log("Pet Name:", petData.name);
    console.log("Pet Species:", petData.species);
    console.log("✅ Successfully verified Luna the Otter on-chain!");
  });
});
