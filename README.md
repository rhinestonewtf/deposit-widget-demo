# Deposit Widget Demo

Interactive demo and configurator for the [`@rhinestone/deposit-widget`](https://www.npmjs.com/package/@rhinestone/deposit-widget) SDK.

## Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Swapped Sandbox

The on-ramp simulator signs Swapped sandbox URLs server-side when these env vars
are configured:

```bash
SWAPPED_API_KEY=
SWAPPED_SECRET_KEY=
SWAPPED_DEFAULT_CURRENCY_CODE=ETH
```

For exchange Connect, optionally set `SWAPPED_CONNECT_PUB_KEY`,
`SWAPPED_CONNECT_SECRET`, and `SWAPPED_CONNECT_DEFAULT_CURRENCY_CODE`.
