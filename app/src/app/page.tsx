"use client";

import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import idl from "@/idl/solana_pets_nfp.json";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton), { ssr: false });
const PROGRAM_ID = new PublicKey("5BQfuedprGSxUQcqiP1enfA8J721dF274dYTvt4qwwsQ");

type PetAccount = { name: string; species: string };
type GenesisAccount = { paused: boolean; minted: number; maxSupply: number };
type MethodBuilder = { accounts(accounts: Record<string, PublicKey>): MethodBuilder; signers(signers: Keypair[]): MethodBuilder; rpc(options?: Record<string, unknown>): Promise<string> };
type PetsProgram = {
  account: {
    playerIdentity: { fetch(address: PublicKey): Promise<unknown> };
    genesisConfig: { fetch(address: PublicKey): Promise<GenesisAccount> };
    pet: { fetch(address: PublicKey): Promise<PetAccount> };
  };
  methods: {
    initializePlayerIdentity(): MethodBuilder;
    initializePlayerIdentityV2(): MethodBuilder;
    associateWallet(): MethodBuilder;
    associateWalletV2(): MethodBuilder;
    initializeGenesis(): MethodBuilder;
    createPet(name: string, species: string): MethodBuilder;
    feedPet(): MethodBuilder;
  };
};

function errorMessage(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [petInfo, setPetInfo] = useState<{ name: string; species: string } | null>(null);
  const [petAccountAddress, setPetAccountAddress] = useState<PublicKey | null>(new PublicKey("6xV4EMms6GA2aef4Eq19RjagcaJFLpVkETJhxpFVBUrw"));
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  const registerPasskey = async () => {
    setSecurityBusy(true); setSecurityStatus(null);
    try {
      const optionsResponse = await fetch("/api/passkey/register/options", { method: "POST" });
      if (!optionsResponse.ok) throw new Error((await optionsResponse.json()).error || "Unable to start passkey registration.");
      const credential = await startRegistration({ optionsJSON: await optionsResponse.json() });
      const verifyResponse = await fetch("/api/passkey/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credential) });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error || "Passkey registration failed.");
      setSecurityStatus("Passkey secured this Player Identity.");
    } catch (err: unknown) { setSecurityStatus(errorMessage(err, "Passkey registration cancelled or failed.")); }
    finally { setSecurityBusy(false); }
  };

  const authenticatePasskey = async () => {
    setSecurityBusy(true); setSecurityStatus(null);
    try {
      const optionsResponse = await fetch("/api/passkey/authenticate/options", { method: "POST" });
      if (!optionsResponse.ok) throw new Error((await optionsResponse.json()).error || "Unable to start passkey authentication.");
      const credential = await startAuthentication({ optionsJSON: await optionsResponse.json() });
      const verifyResponse = await fetch("/api/passkey/authenticate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credential) });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error || "Passkey authentication failed.");
      setSecurityStatus("Player Identity authenticated.");
    } catch (err: unknown) { setSecurityStatus(errorMessage(err, "Passkey authentication cancelled or failed.")); }
    finally { setSecurityBusy(false); }
  };

  const verifyWalletForAssociation = async () => {
    if (!wallet.publicKey || !wallet.signMessage) { setSecurityStatus("Connect a wallet that supports message signing."); return; }
    setSecurityBusy(true); setSecurityStatus(null);
    try {
      const optionsResponse = await fetch("/api/wallet/associate/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: wallet.publicKey.toBase58() }) });
      if (!optionsResponse.ok) throw new Error((await optionsResponse.json()).error || "Passkey authentication is required.");
      const { challengeId, message } = await optionsResponse.json();
      const signature = await wallet.signMessage(new TextEncoder().encode(message));
      const signatureBase58 = anchor.utils.bytes.bs58.encode(signature);
      const verifyResponse = await fetch("/api/wallet/associate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, signature: signatureBase58 }) });
      if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error || "Wallet verification failed.");
      const verified = await verifyResponse.json();

      const identityResponse = await fetch("/api/player/identity");
      if (!identityResponse.ok) throw new Error("Unable to load canonical Player Identity.");
      const identity = await identityResponse.json();
      if (!identity.primaryWallet || identity.primaryWallet !== wallet.publicKey.toBase58() || verified.primaryWallet !== wallet.publicKey.toBase58()) {
        setSecurityStatus("Wallet verified off-chain. Connect the primary wallet to complete the on-chain V2 association.");
        return;
      }

      const provider = new anchor.AnchorProvider(connection, wallet as unknown as anchor.Wallet, { commitment: "confirmed" });
      const program = new anchor.Program(idl as anchor.Idl, provider) as unknown as PetsProgram;
      const [identityPda] = PublicKey.findProgramAddressSync([Buffer.from("player-v2"), wallet.publicKey.toBuffer()], PROGRAM_ID);
      try { await program.account.playerIdentity.fetch(identityPda); }
      catch {
        await program.methods.initializePlayerIdentityV2().accounts({ identity: identityPda, authority: wallet.publicKey, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed", maxRetries: 5 });
      }
      const [associationPda] = PublicKey.findProgramAddressSync([Buffer.from("wallet-v2"), identityPda.toBuffer(), wallet.publicKey.toBuffer()], PROGRAM_ID);
      const tx = await program.methods.associateWalletV2().accounts({ identity: identityPda, association: associationPda, wallet: wallet.publicKey, authority: wallet.publicKey, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed", maxRetries: 5 });
      setSecurityStatus("Primary wallet verified and associated through Player Identity V2. Tx: " + tx);
    } catch (err: unknown) { setSecurityStatus(errorMessage(err, "Wallet association cancelled or failed.")); }
    finally { setSecurityBusy(false); }
  };

  const mintLuna = async () => {
    if (!wallet.connected || !wallet.publicKey) { alert("Please connect your wallet first!"); return; }
    setIsMinting(true); setTxSignature(null); setPetInfo(null);
    try {
      const provider = new anchor.AnchorProvider(connection, wallet as unknown as anchor.Wallet, { commitment: "confirmed" });
      const program = new anchor.Program(idl as anchor.Idl, provider) as unknown as PetsProgram;
      const [genesisPda] = PublicKey.findProgramAddressSync([Buffer.from("genesis")], PROGRAM_ID);
      let genesis;
      try { genesis = await program.account.genesisConfig.fetch(genesisPda); }
      catch {
        await program.methods.initializeGenesis().accounts({ genesis: genesisPda, authority: wallet.publicKey, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed" });
        genesis = await program.account.genesisConfig.fetch(genesisPda);
      }
      if (genesis.paused) throw new Error("Genesis minting is currently paused.");
      if (genesis.minted >= genesis.maxSupply) throw new Error("Genesis supply is sold out.");
      const petAccount = Keypair.generate();
      const tx = await program.methods.createPet("Luna", "Otter").accounts({ genesis: genesisPda, pet: petAccount.publicKey, payer: wallet.publicKey, systemProgram: SystemProgram.programId }).signers([petAccount]).rpc({ commitment: "confirmed", maxRetries: 5 });
      const pet = await program.account.pet.fetch(petAccount.publicKey);
      setTxSignature(tx); setPetInfo({ name: pet.name, species: pet.species }); setPetAccountAddress(petAccount.publicKey);
    } catch (err: unknown) { console.error("Genesis mint failed:", err); alert("Mint failed: " + errorMessage(err, "Unknown mint error.")); }
    finally { setIsMinting(false); }
  };

  const feedLuna = async () => {
    if (!wallet.connected || !wallet.publicKey || !petAccountAddress) { alert("Mint Luna first!"); return; }
    setIsMinting(true);
    try {
      const provider = new anchor.AnchorProvider(connection, wallet as unknown as anchor.Wallet, { commitment: "confirmed" });
      const program = new anchor.Program(idl as anchor.Idl, provider);
      const tx = await program.methods.feedPet().accounts({ pet: petAccountAddress, owner: wallet.publicKey }).rpc({ skipPreflight: true, commitment: "confirmed" });
      console.log("Fed Luna! Tx:", tx); alert("🦦 Luna has been fed! Hunger restored.");
    } catch (err: unknown) { console.error("Feed failed:", err); alert("Feed failed: " + errorMessage(err, "Unknown feed error.")); }
    finally { setIsMinting(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800"><div className="flex items-center gap-2"><span className="text-3xl">🦦</span><h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">SolanaPets NFP</h1></div><WalletMultiButton /></header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12"><div className="max-w-md w-full text-center space-y-8">
        <div className="mx-auto w-40 h-40 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-3xl flex items-center justify-center border border-slate-700"><span className="text-7xl">🦦</span></div>
        <div><h2 className="text-4xl font-bold mb-3">Meet <span className="text-cyan-400">Luna</span></h2><p className="text-slate-400 text-lg">Your first Non-Fungible Pet on Solana. Mint Luna the Otter, feed her, and watch her grow on-chain.</p></div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 text-left space-y-4"><div><h3 className="font-semibold text-lg">🔐 Player Identity Security</h3><p className="text-sm text-slate-400 mt-1">Protect your SolanaPets Identity with a device passkey and verify wallet ownership before association.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={registerPasskey} disabled={securityBusy} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold disabled:opacity-50">Create Passkey</button><button onClick={authenticatePasskey} disabled={securityBusy} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold disabled:opacity-50">Authenticate</button></div><button onClick={verifyWalletForAssociation} disabled={securityBusy || !wallet.connected} className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30 font-semibold disabled:opacity-50">Verify & Associate Connected Wallet</button>{securityStatus&&<p className="text-xs text-slate-300 break-words">{securityStatus}</p>}</div>
        <div className="space-y-4"><button onClick={mintLuna} disabled={isMinting||!wallet.connected} className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 font-bold text-lg disabled:opacity-50">{isMinting?"Minting...":"🦦 Mint Luna"}</button><button onClick={feedLuna} disabled={isMinting||!petAccountAddress||!wallet.connected} className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 font-semibold disabled:opacity-50">🍎 Feed Luna</button></div>
        {petInfo&&<div className="bg-slate-800 rounded-xl p-4"><p className="font-bold">{petInfo.name} the {petInfo.species}</p>{txSignature&&<a href={`https://solscan.io/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-cyan-400 text-sm">View transaction on Solscan ↗</a>}</div>}
      </div></main>
      <footer className="text-center py-6 text-slate-600 text-xs">SolanaPets NFP • Devnet</footer>
    </div>
  );
}