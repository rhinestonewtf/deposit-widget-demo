# Deposit Widget Demo

Interactive demo and configurator for the [`@rhinestone/deposit-widget`](https://www.npmjs.com/package/@rhinestone/deposit-widget) SDK.

## Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Swapped On-Ramp

The demo embeds `@rhinestone/deposit-modal` pointed at the production backend
(`DEFAULT_BACKEND_URL`), which owns the entire Swapped on-ramp flow: it signs
the Swapped widget URL, receives Swapped's webhooks, and drives the tracker and
bridge status. The demo needs **no** Swapped configuration of its own — there
are no `SWAPPED_*` env vars, no client-side URL signing, and no simulated
tracker/bridge state.

Because the flow is fully live, completing an on-ramp moves **real funds**.
