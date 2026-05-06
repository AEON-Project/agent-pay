# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@aeon-ai-pay/agent-pay` — Agent skill & CLI for **AI image generation**, paid per-request via the x402 HTTP payment protocol with USDT (BEP-20) on BSC. User supplies a `prompt`; the CLI handles wallet setup, x402 payment, and returns the generated image.

The single business endpoint is `GET /open/ai/x402/skillBoss/create?prompt=<text>`.

Published as both a global npm CLI (`agent-pay`) and an agent skill compatible with Claude Code, Cursor, Codex, and 39+ platforms.

## Commands

```bash
# Run CLI commands directly
node bin/cli.mjs setup                            # Generate local wallet, show config
node bin/cli.mjs generate --prompt "<text>"       # Generate AI image via x402 payment
node bin/cli.mjs wallet                           # Check USDT/BNB balance
node bin/cli.mjs topup                            # Transfer USDT via WalletConnect
node bin/cli.mjs gas                              # Transfer BNB for tx fees
node bin/cli.mjs withdraw                         # Reclaim funds from session key
node bin/cli.mjs clean                            # Uninstall skill & clear cache

# Or via npm scripts
npm run generate -- --prompt "..."
npm run wallet

# Release
node scripts/release.mjs
```

No build step — all source is native ES Modules (`.mjs`), executed directly by Node.js >=18. No test suite exists.

## Architecture

### Entry Points
- `bin/cli.mjs` — Commander.js CLI definition, lazy-loads command modules
- `skills/agent-pay/SKILL.md` — Agent skill specification (triggers, opening protocol, workflow)
- `scripts/postinstall.mjs` — Auto-installs skill into detected AI coding agents on `npm install`

### Core Modules (`src/`)
- `x402.mjs` — x402 protocol client: wraps axios with EIP-712 signing, parses 402 payment requirements
- `walletconnect.mjs` — WalletConnect v2 integration: QR code UI (custom HTML page), local status server, ERC20 transfers (USDT + BNB)
- `balance.mjs` — EVM balance/allowance queries via Viem public client on BSC
- `config.mjs` — Config persistence at `~/.agent-pay/config.json` (mode 0o600). Priority: CLI args > env vars > config file
- `constants.mjs` — BSC addresses, RPC URL, WalletConnect timeouts
- `update-check.mjs` — Background auto-update detection via `npm view`

### Command Modules (`src/commands/`)
Each command module exports a single async function. Pattern: parse options → load/validate config → call shared utilities → output JSON or error.

### Key Architectural Concepts

**Session Key Model**: A randomly generated private key stored locally acts as a "session key." The user's main wallet (MetaMask, etc.) funds this key via WalletConnect. The session key then signs x402 payments (gasless EIP-712) for image generation.

**x402 Payment Flow**: `GET /open/ai/x402/skillBoss/create?body=<urlencoded JSON> (decoded { model, inputs: { prompt, aspect_ratio, output_format } }) → HTTP 402 + requirements → client EIP-712 sign → retry same URL with PAYMENT-SIGNATURE → HTTP 200 + { transaction, data: { images: [{url}] } } → CLI downloads & parses meta`. Server endpoint is Spring `@GetMapping("/create") create(@RequestParam String body, ...)`.

**Gas Model**: One-time `approve` tx requires BNB (~0.0003). Each generation itself is gasless (server-paid). Withdrawal requires BNB for direct on-chain transfer.

**Pricing Model**: Per-call USDT amount is decided by the server in the 402 response, not hardcoded client-side. The wallet is charged exactly that amount. Top-up covers exactly the shortfall (`requiredUsdt - currentBalance`).

## Key Dependencies
- `viem` — EVM client (balance queries, contract reads)
- `@walletconnect/sign-client` — Wallet connection protocol
- `@aeon-ai-pay/axios` / `@aeon-ai-pay/evm` — Custom x402 protocol wrappers
- `commander` — CLI framework
