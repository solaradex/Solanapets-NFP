"use client";

import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import idl from "@/idl/solana_pets_nfp.json";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

const PROGRAM_ID = new PublicKey("5BQfuedprGSxUQcqiP1enfA8J721dF274dYTvt4qwwsQ");

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [petInfo, setPetInfo] = useState<{ name: string; species: string } | null>(null);
    const [petAccountAddress, setPetAccountAddress] = useState<PublicKey | null>(
    new PublicKey("6xV4EMms6GA2aef4Eq19RjagcaJFLpVkETJhxpFVBUrw")
  );

  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  const registerPasskey = async () => {
    setSecurityBusy(true);
    setSecurityStatus(null);
    try {
      const optionsResponse = await fetch("/api/passkey/register/options", { method: "POST" });
      if (!optionsResponse.ok) throw new Error((await optionsResponse.json()).error || "Unable to start passkey registration.");
      const options = await optionsResponse.json();
      const credential = await startRegistration({ optionsJSON: options });
      const verifyResponse = await fetch("/api/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error || "Passkey registration failed.");
      setSecurityStatus("Passkey secured this Player Identity.");
    } catch (err: any) {
      setSecurityStatus(err?.message || "Passkey registration cancelled or failed.");
    } finally {
      setSecurityBusy(false);
    }
  };

  const authenticatePasskey = async () => {
    setSecurityBusy(true);
    setSecurityStatus(null);
    try {
      const optionsResponse = await fetch("/api/passkey/authenticate/options", { method: "POST" });
      if (!optionsResponse.ok) throw new Error((await optionsResponse.json()).error || "Unable to start passkey authentication.");
      const options = await optionsResponse.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const verifyResponse = await fetch("/api/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error || "Passkey authentication failed.");
      setSecurityStatus("Player Identity authenticated.");
    } catch (err: any) {
      setSecurityStatus(err?.message || "Passkey authentication cancelled or failed.");
    } finally {
      setSecurityBusy(false);
    }
  };

  const verifyWalletForAssociation = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      setSecurityStatus("Connect a wallet that supports message signing.");
      return;
    }
    setSecurityBusy(true);
    setSecurityStatus(null);
    try {
      const optionsResponse = await fetch("/api/wallet/associate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.publicKey.toBase58() }),
      });
      if (!optionsResponse.ok) throw new Error((await optionsResponse.json()).error || "Passkey authentication is required.");
      const { challengeId, message } = await optionsResponse.json();
      const signature = await wallet.signMessage(new TextEncoder().encode(message));
      const signatureBase58 = anchor.utils.bytes.bs58.encode(signature);
      const verifyResponse = await fetch("/api/wallet/associate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, signature: signatureBase58 }),
      });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error || "Wallet verification failed.");
      setSecurityStatus("Wallet cryptographically verified. On-chain association is ready.");
    } catch (err: any) {
      setSecurityStatus(err?.message || "Wallet verification cancelled or failed.");
    } finally {
      setSecurityBusy(false);
    }
  };

  const mintLuna = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert("Please connect your wallet first!");
      return;
    }

    setIsMinting(true);
    setTxSignature(null);
    setPetInfo(null);

    try {
      const provider = new anchor.AnchorProvider(
        connection,
        wallet as unknown as anchor.Wallet,
        { commitment: "confirmed" }
      );
      const program = new anchor.Program(idl as anchor.Idl, provider);

      const [genesisPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("genesis")],
        PROGRAM_ID
      );

      let genesis;
      try {
        genesis = await program.account.genesisConfig.fetch(genesisPda);
      } catch {
        await program.methods
          .initializeGenesis()
          .accounts({
            genesis: genesisPda,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        genesis = await program.account.genesisConfig.fetch(genesisPda);
      }

      if (genesis.paused) throw new Error("Genesis minting is currently paused.");
      if (genesis.minted >= genesis.maxSupply) throw new Error("Genesis supply is sold out.");

      const petAccount = Keypair.generate();

      const tx = await program.methods
        .createPet("Luna", "Otter")
        .accounts({
          genesis: genesisPda,
          pet: petAccount.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([petAccount])
        .rpc({ commitment: "confirmed", maxRetries: 5 });

      const pet = await program.account.pet.fetch(petAccount.publicKey);
      setTxSignature(tx);
      setPetInfo({ name: pet.name, species: pet.species });
      setPetAccountAddress(petAccount.publicKey);
    } catch (err: any) {
      console.error("Genesis mint failed:", err);
      alert("Mint failed: " + (err?.message || err?.name || JSON.stringify(err)));
    } finally {
      setIsMinting(false);
    }
  };

  const feedLuna = async () => {
    if (!wallet.connected || !wallet.publicKey || !petAccountAddress) {
      alert("Mint Luna first!");
      return;
    }

    setIsMinting(true); // Reuse the loading state for simplicity
    try {
      const provider = new anchor.AnchorProvider(
        connection,
        wallet as unknown as anchor.Wallet,
        { commitment: "confirmed" }
      );
      const program = new anchor.Program(idl as anchor.Idl, provider);

      const tx = await program.methods
        .feedPet()
                .accounts({
          pet: petAccountAddress,
          owner: wallet.publicKey,
        })
        .rpc({ skipPreflight: true, commitment: "confirmed" });

      console.log("Fed Luna! Tx:", tx);
      alert("🦦 Luna has been fed! Hunger restored.");
    } catch (err: any) {
      console.error("Feed failed:", err);
      alert("Feed failed: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🦦</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            SolanaPets NFP
          </h1>
        </div>
        <WalletMultiButton />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="mx-auto w-40 h-40 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-3xl flex items-center justify-center border border-slate-700">
            <span className="text-7xl">🦦</span>
          </div>

          <div>
            <h2 className="text-4xl font-bold mb-3">
              Meet <span className="text-cyan-400">Luna</span>
            </h2>
            <p className="text-slate-400 text-lg">
              Your first Non-Fungible Pet on Solana. Mint Luna the Otter, feed her, and watch her grow on-chain.
            </p>
          </div>

          <button
            onClick={mintLuna}
            disabled={!wallet.connected || isMinting}
            className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
              !wallet.connected
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : isMinting
                ? "bg-cyan-700 text-white cursor-wait animate-pulse"
                : "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
            }`}
          >
            {isMinting
              ? "Minting Luna..."
              : wallet.connected
              ? "🐾 Mint Luna the Otter"
              : "Connect Wallet to Mint"}
          </button>

          {petInfo && txSignature && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-left space-y-2">
              <p className="text-emerald-400 font-semibold">
                ✅ {petInfo.name} the {petInfo.species} has been minted!
              </p>
              <p className="text-xs text-slate-400 break-all">
                Tx:{" "}
                <a
                  href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  {txSignature}
                </a>
              </p>
            </div>
          )}
        </div>
          {petAccountAddress && (
            <button
              onClick={feedLuna}
              disabled={isMinting}
              className="w-full py-3 rounded-xl text-lg font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
            >
              🐟 Feed Luna
            </button>
          )}
      </main>

      <footer className="px-8 py-4 border-t border-slate-800 text-center text-sm text-slate-500">
        SolanaPets NFP • Built on Solana Devnet • Program: 5BQf...wwsQ
      </footer>
    </div>
  );
}