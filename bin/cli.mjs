#!/usr/bin/env node

const [major] = process.versions.node.split(".").map(Number);
if (major < 25) {
  console.error(`agent-pay requires Node.js >= 25. Current: v${process.versions.node}`);
  console.error("Upgrade: https://nodejs.org/");
  process.exit(1);
}

// WalletConnect v2 SDK 已知缺陷：relay 偶发 null WebSocket 帧导致
// isJsonRpcPayload 内部 'id' in null 抛 TypeError，不影响业务流程，静默忽略
process.on("uncaughtException", (err) => {
  if (
    err instanceof TypeError &&
    err.message.includes("Cannot use 'in' operator") &&
    err.stack?.includes("isJsonRpcPayload")
  ) {
    console.error("[WC guard] Caught null-frame TypeError via uncaughtException, ignored.");
    return;
  }
  console.error(err);
  process.exit(1);
});

import { Command } from "commander";
import { checkForUpdates } from "../src/update-check.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT_VERSION = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")).version;
checkForUpdates(CURRENT_VERSION);

const program = new Command();

program
  .name("agent-pay")
  .description("Agent payment CLI — generate AI images via x402 protocol, paid with crypto")
  .version(CURRENT_VERSION);

program
  .command("setup")
  .description("Pre-check: auto-create local wallet on first run, or show config")
  .option("--service-url <url>", "Override service URL")
  .option("--show", "Show current configuration", false)
  .option("--check", "Check & auto-create wallet if missing (exit 0=ready, 1=not ready)", false)
  .action(async (opts) => {
    const { setup } = await import("../src/commands/setup.mjs");
    return setup(opts);
  });

program
  .command("generate")
  .description("Generate an AI image from a prompt, paying with USDT on BSC via x402")
  .requiredOption("--prompt <text>", "Image prompt (free-form text describing the desired image)")
  .option("--aspect-ratio <ratio>", "Image aspect ratio (e.g. 16:9, 1:1)", "16:9")
  .option("--output-format <fmt>", "Image output format (png, jpg, webp)", "png")
  .option("--model <id>", "Model id", "replicate/black-forest-labs/flux-schnell")
  .option("--output <dir>", "Directory to save downloaded images (default: ~/agent-pay-images)")
  .option("--service-url <url>", "Override service URL")
  .option("--private-key <key>", "Override EVM private key")
  .action(async (opts) => {
    const { generate } = await import("../src/commands/generate.mjs");
    return generate(opts);
  });

program
  .command("wallet")
  .description("Check local wallet USDT balance on BSC")
  .option("--private-key <key>", "Override EVM private key")
  .action(async (opts) => {
    const { wallet } = await import("../src/commands/wallet.mjs");
    return wallet(opts);
  });

program
  .command("topup")
  .description("Top up local wallet via WalletConnect (USDT + BNB for approve gas)")
  .option("--amount <usdt>", "USDT amount to add", "50")
  .option("--skip-gas", "Skip automatic BNB transfer", false)
  .option("--project-id <id>", "WalletConnect Cloud project ID")
  .action(async (opts) => {
    const { topup } = await import("../src/commands/topup.mjs");
    return topup(opts);
  });

program
  .command("gas")
  .description("Send BNB from main wallet to local wallet via WalletConnect (for withdraw gas)")
  .option("--amount <bnb>", "BNB amount to send", "0.001")
  .option("--project-id <id>", "WalletConnect Cloud project ID")
  .action(async (opts) => {
    const { gas } = await import("../src/commands/gas.mjs");
    return gas(opts);
  });

program
  .command("withdraw")
  .description("Withdraw USDT from session key back to main wallet")
  .option("--amount <usdt>", "USDT amount to withdraw (default: all)")
  .option("--to <address>", "Override destination address")
  .action(async (opts) => {
    const { withdraw } = await import("../src/commands/withdraw.mjs");
    return withdraw(opts);
  });

program
  .command("clean")
  .description("Remove skill, uninstall package, and clear npm/npx cache")
  .action(async () => {
    const { clean } = await import("../src/commands/clean.mjs");
    return clean();
  });

program.parse();
