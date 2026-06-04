# Deposit Widget Demo

Interactive demo and configurator for the [`@rhinestone/deposit-widget`](https://www.npmjs.com/package/@rhinestone/deposit-widget) SDK.

## Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown (WalletConnect) project ID for wallet connection. |
| `NEXT_PUBLIC_RHINESTONE_API_KEY` | Rhinestone API key shown in the generated code snippet. |
| `NEXT_PUBLIC_ENABLE_FIAT_ONRAMP` | **Internal-only.** Set to `true` to expose the Swapped fiat on-ramp controls in the **Behaviour** tab (per-method fiat rows, Fund from Exchange, Transfer Crypto QR). Off by default — the public demo is unchanged. |

### Internal: Swapped fiat on-ramp

Setting `NEXT_PUBLIC_ENABLE_FIAT_ONRAMP=true` reveals a **Payment methods** section in
the Behaviour tab that toggles the modal's `enableFiatOnramp` / `fiatOnrampMethods` /
`enableExchangeConnect` / `enableQrTransfer` props. It is a build-time flag, so set it in
the build/deploy environment of the internal preview (not just at runtime). The Swapped
endpoints are served by the default orchestrator backend, which is already configured with
Swapped keys — no `backendUrl` override is needed.
