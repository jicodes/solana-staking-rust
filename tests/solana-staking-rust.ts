import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaStakingRust } from "../target/types/solana_staking_rust";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

describe("solana-staking-rust", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // const mintKeypair = Keypair.generate();
  // console.log("Mint Keypair:", mintKeypair);

  const mintKeypair = Keypair.fromSecretKey(
    new Uint8Array([
      98, 95, 204, 150, 109, 247, 95, 158, 45, 86, 236, 146, 220, 77, 184, 102,
      35, 61, 14, 143, 135, 153, 23, 239, 161, 143, 135, 210, 127, 57, 246, 87,
      12, 40, 86, 214, 25, 110, 147, 17, 88, 215, 95, 46, 188, 237, 215, 232,
      131, 118, 211, 197, 13, 28, 79, 224, 118, 29, 3, 135, 230, 3, 143, 190,
    ]),
  );

  const program = anchor.workspace
    .SolanaStakingRust as Program<SolanaStakingRust>;

  async function createMintToken() {
    const mint = await createMint(
      connection,
      payer.payer,
      payer.publicKey,
      payer.publicKey,
      9,
      mintKeypair,
    );
    console.log("Mint:", mint);
  }

  it("Is initialized!", async () => {
    // await createMintToken();

    let [vaultAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    );

    const tx = await program.methods
      .initialize()
      .accounts({
        tokenVaultAccount: vaultAccount,
        signer: payer.publicKey,
        mint: mintKeypair.publicKey,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Should stake", async () => {
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      payer.publicKey,
    );

    await mintTo(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      userTokenAccount.address,
      payer.payer,
      1e11,
    );

    let [stakeInfoAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), payer.publicKey.toBuffer()],
      program.programId,
    );

    let [stakeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("token"), payer.publicKey.toBuffer()],
      program.programId,
    );

    const tx = await program.methods
      .stake(new anchor.BN(1))
      .signers([payer.payer])
      .accounts({
        stakeInfoAccount,
        stakeAccount,
        userTokenAccount: userTokenAccount.address,
        signer: payer.publicKey,
        mint: mintKeypair.publicKey,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Should destake and distribute reward", async () => {
    let userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      payer.publicKey,
    );

    let [stakeInfoAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), payer.publicKey.toBuffer()],
      program.programId,
    );

    let [stakeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("token"), payer.publicKey.toBuffer()],
      program.programId,
    );

    let [vaultAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    );

    // mint some SPL token to the vault, so that we can distribute it as reward
    await mintTo(
      connection,
      payer.payer,
      mintKeypair.publicKey,
      vaultAccount,
      payer.payer,
      1e21,
    );

    const tx = await program.methods
      .destake()
      .signers([payer.payer])
      .accounts({
        stakeInfoAccount,
        stakeAccount,
        userTokenAccount: userTokenAccount.address,
        vaultAccount,
        signer: payer.publicKey,
        mint: mintKeypair.publicKey,
      })
      .rpc();

    console.log("Your transaction signature", tx);
  });
});
