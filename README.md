# Deposit Widget Demo

Interactive demo and configurator for the [`@rhinestone/deposit-widget`](https://www.npmjs.com/package/@rhinestone/deposit-widget) SDK.

## Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Swapped On-Ramp

The on-ramp simulator signs Swapped URLs server-side when these env vars are
configured. Keep keys server-side only — do not use `NEXT_PUBLIC_` for Swapped
secrets.

Sandbox is the default when `SWAPPED_ENVIRONMENT` is omitted:

```bash
SWAPPED_ENVIRONMENT=sandbox
SWAPPED_API_KEY=
SWAPPED_SECRET_KEY=
SWAPPED_DEFAULT_CURRENCY_CODE=ETH_ETHEREUM
```

For exchange Connect, optionally set `SWAPPED_CONNECT_PUB_KEY`,
`SWAPPED_CONNECT_SECRET`, and `SWAPPED_CONNECT_DEFAULT_CURRENCY_CODE`.

For the production Vercel demo, set these on the Vercel **Production**
environment:

```bash
SWAPPED_ENVIRONMENT=production
SWAPPED_API_KEY=
SWAPPED_SECRET_KEY=
SWAPPED_DEFAULT_CURRENCY_CODE=USDC_BASE
SWAPPED_CONNECT_DEFAULT_CURRENCY_CODE=USDC_BASE
```

The default production URLs are:

```bash
SWAPPED_WIDGET_BASE_URL=https://widget.swapped.com
SWAPPED_CONNECT_BASE_URL=https://connect.swapped.com
```

Only override those if Swapped gives us account-specific URLs. If testing a
preview deployment, add the same variables to the Vercel **Preview**
environment or branch-scope them to the preview branch; Production-scoped vars
are not available to Preview deployments.

The demo still mocks the backend webhook/status progression in the browser via
the "Simulate on-ramp" panel. With production Swapped credentials configured,
the Swapped iframe itself is real and can initiate a real on-ramp; only the
tracker/bridge state is simulated.
