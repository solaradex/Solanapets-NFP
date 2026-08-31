"use client";

import { useState } from "react";
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

  const mintLuna = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert("Please connect your wallet first!");
      return;
    }

    setIsMinting(true);
    setTxSignature(null);
    setPetInfo(null);

    try {
      console.log("Step 1: Wallet connected:", wallet.publicKey.toBase58());

      const provider = new anchor.AnchorProvider(
        connection,
        wallet as unknown as anchor.Wallet,
        { commitment: "confirmed" }
      );
      console.log("Step 2: Provider created");

      const program = new anchor.Program(idl as anchor.Idl, provider);
      console.log("Step 3: Program created");
      console.log("Step 4: Available methods:", Object.keys(program.methods));

      const petAccount = Keypair.generate();
      console.log("Step 5: Pet account generated:", petAccount.publicKey.toBase58());

      const tx = await program.methods
        .createPet("Luna", "Otter")
        .accounts({
          pet: petAccount.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([petAccount])
        .rpc({ skipPreflight: true, commitment: "confirmed", maxRetries: 5 });

      console.log("Step 6: Transaction sent:", tx);
      setTxSignature(tx);
      setPetInfo({ name: "Luna", species: "Otter" });
      setPetAccountAddress(petAccount.publicKey);
    } catch (err: any) {
      console.error("FULL ERROR:", err);
      console.error("Error name:", err?.name);
      console.error("Error message:", err?.message);
      console.error("Error logs:", err?.logs);
      console.error("Error code:", err?.code);
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