import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaStakingRust } from "../target/types/solana_staking_rust";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

describe("solana-staking-rust", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const mintKeypair = Keypair.fromSecretKey(
    new Uint8Array([
      233, 17, 81, 131, 170, 54, 236, 195, 63, 232, 175, 37, 50, 127, 112, 122,
      0, 136, 28, 97, 220, 51, 237, 143, 170, 230, 221, 181, 187, 237, 244, 189,
      25, 69, 97, 249, 57, 196, 2, 65, 198, 8, 64, 121, 55, 14, 22, 131, 71, 19,
      129, 233, 18, 143, 197, 186, 179, 27, 80, 241, 92, 170, 255, 189,
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
});
