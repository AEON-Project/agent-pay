# Generate AI Image

## Prerequisites

1. Wallet is configured — run `setup --check` first.
2. Service URL is configured (built-in default is available).
3. The `generate` command auto-checks allowance/balance and triggers WalletConnect funding when needed; **do not pre-call `topup`**.

## Request Shape

The server signature is `@GetMapping("/create") create(@RequestParam String body, ...)` — the entire JSON payload is passed as the URL-encoded `body` **query parameter**, not as a request body.

```
GET <serviceUrl>/open/ai/x402/skillBoss/create?body=<urlencoded-json>
```

Where the decoded `body` is:
```json
{
  "model": "replicate/black-forest-labs/flux-schnell",
  "inputs": {
    "prompt": "<user prompt>",
    "aspect_ratio": "16:9",
    "output_format": "png"
  }
}
```

The first call returns HTTP 402 with payment requirements; the second call is the **same URL** plus an added `PAYMENT-SIGNATURE` header.

### CLI flags

| Flag | Required | Default | Maps to |
| --- | --- | --- | --- |
| `--prompt <text>` | yes | — | `inputs.prompt` |
| `--aspect-ratio <ratio>` | no | `16:9` | `inputs.aspect_ratio` |
| `--output-format <fmt>` | no | `png` | `inputs.output_format` |
| `--model <id>` | no | `replicate/black-forest-labs/flux-schnell` | `model` |
| `--output <dir>` | no | `~/agent-pay-images` | local image save directory |
| `--service-url <url>` | no | from config | base URL |
| `--private-key <key>` | no | from config | session key override |

## Workflow

1. Collect a prompt from the user.
2. Run `agent-pay generate --prompt "<text>"` (add other flags only if user explicitly asks).
3. CLI does the x402 dance (402 → fund-if-needed → approve-if-needed → signed retry → 200).
4. CLI downloads each `data.images[].url` and reads its format/dimensions/size.
5. Present the result table per image.

## Successful Response

Server returns:
```json
{
  "transaction": "0x...",
  "data": { "images": [ { "url": "https://assets.skillboss.co/....png" } ] }
}
```

CLI emits to stdout:
```json
{
  "success": true,
  "prompt": "<original>",
  "aspectRatio": "16:9",
  "outputFormat": "png",
  "model": "replicate/black-forest-labs/flux-schnell",
  "transaction": "0x...",
  "images": [
    {
      "url": "https://...png",
      "localPath": "/Users/<user>/agent-pay-images/<file>.png",
      "format": "png",
      "width": 1344,
      "height": 768,
      "sizeBytes": 1016287,
      "sizeHuman": "992.4 KB"
    }
  ],
  "data": { /* full server payload */ },
  "paymentResponse": { "txHash": "0x...", "networkId": "eip155:56" }
}
```

Notes:
- `transaction` (top-level) is the on-chain tx hash returned by the server. Display this — not `paymentResponse.txHash` — in the user-facing table.
- `format/width/height/sizeBytes/sizeHuman` come from local parsing of the downloaded file (PNG/JPEG/WebP headers). Fields may be `null` if the format is unknown.
- A failed download yields `{ url, error }` (no `localPath`/format/dimensions).

## User-Facing Display Template

After parsing the JSON, render each image as a box-drawing table:

```
✅ 生成完成

┌──────┬─────────────────────────────┐
│ 路径 │ {localPath}                 │
├──────┼─────────────────────────────┤
│ 格式 │ {FORMAT}                    │
├──────┼─────────────────────────────┤
│ 尺寸 │ {width} × {height}          │
├──────┼─────────────────────────────┤
│ 大小 │ {sizeHuman}                 │
├──────┼─────────────────────────────┤
│ 交易 │ {transaction}               │
└──────┴─────────────────────────────┘
```

Rules:
- `✅ 生成完成` is verbatim (one line, then a blank line before the table).
- Use box-drawing chars `┌ ─ ┬ ┐ │ ├ ┼ ┤ └ ┴ ┘`.
- Right column must be wide enough that no value wraps.
- `{FORMAT}` = uppercase of `images[].format` (e.g. `png` → `PNG`).
- `{width} × {height}` uses U+00D7 with single spaces around it.
- `{transaction}` = full top-level tx hash.
- One table per image when multiple images were returned.

## Error Handling

| Scenario | CLI Output | Action |
|---|---|---|
| Empty prompt | `Missing --prompt. Provide a non-empty image prompt.` | Ask user for a prompt |
| Wallet not configured | `Wallet not configured` | Run `setup --check` |
| Funding signature timeout (5 min) | `Payment approval timed out. Please try again.` | Relay; do not auto-retry |
| User rejected signature | `Payment approval was rejected. Please try again if you'd like to proceed.` | Relay; do not auto-retry |
| Insufficient balance after funding | `Still insufficient USDT after funding.` | Relay |
| Server network error | Error JSON | Suggest retry / check `serviceUrl` |
| Image download failed | Entry has `error` instead of `localPath` | Show `│ 路径 │ 下载失败：{error}` and omit format/尺寸/大小 rows |

## Pricing Model

- Per-call USDT amount is **decided by the server** in the 402 response — not hardcoded client-side.
- Top-up covers exactly the shortfall: `requiredUsdt - currentBalance`.
