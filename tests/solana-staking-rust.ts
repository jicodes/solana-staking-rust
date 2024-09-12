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
  const mintKeypair = Keypair.fromSecretKey(
    new Uint8Array([
      118, 145, 161, 133, 222, 110, 174, 88, 125, 155, 124, 153, 212, 242, 53,
      243, 185, 166, 192, 225, 12, 25, 212, 41, 111, 109, 142, 131, 236, 114,
      15, 178, 62, 49, 151, 124, 55, 241, 146, 233, 101, 105, 49, 204, 240, 160,
      210, 130, 87, 206, 22, 154, 55, 221, 196, 158, 202, 210, 176, 210, 55, 63,
      187, 32,
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
});
