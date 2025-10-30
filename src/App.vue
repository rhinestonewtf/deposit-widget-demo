<template>
  <header>
    <appkit-button />
  </header>
  <main>
    <button v-if="!isConnected" @click="openConnectModal">Connect</button>
    <button v-else @click="openDepositModal">Deposit</button>
    <WidgetDialog
      v-model:open="isModalOpen"
      :token="token"
      :chain="chain"
      :account="account"
      :recipient="recipient"
    />
  </main>
</template>

<script setup lang="ts">
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  type AppKitNetwork,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  sepolia,
} from "@reown/appkit/networks";
import { createAppKit, useAppKit } from "@reown/appkit/vue";
import { useAppKitAccount } from "@reown/appkit/vue";
import type { Address, Chain } from "viem";
import { computed, ref } from "vue";
import WidgetDialog from "./components/widget/WidgetDialog.vue";

// 1. Get projectId from https://dashboard.reown.com
const projectId = import.meta.env.VITE_PUBLIC_REOWN_PROJECT_ID;
if (!projectId) {
  throw new Error("VITE_PUBLIC_REOWN_PROJECT_ID is not set");
}

// 2. Create a metadata object
const metadata = {
  name: "Deposit Widget Demo",
  description:
    "Demo Application that shows Rhinestone Deposit Widget in action",
  url: "localhost:5173",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// 3. Set the networks
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  arbitrum,
  base,
  optimism,
  sepolia,
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
];

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
});

// 5. Create the modal
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
  },
});

// 6. Use AppKit composables after createAppKit
const { open } = useAppKit();
const accountData = useAppKitAccount();
const account = computed(() => accountData.value?.address as Address);
const isConnected = computed(() => !!accountData.value?.address);
const recipient = "0x0000000000000000000000000000000000000042" as Address;

const isModalOpen = ref(false);

function openConnectModal() {
  open();
}

function openDepositModal() {
  isModalOpen.value = true;
}

const chain = base;
const USDC = getUsdcAddress(chain);
const token = ref<Address>(USDC);

function getUsdcAddress(chain: Chain): Address {
  switch (chain.id) {
    case sepolia.id:
      return "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    case baseSepolia.id:
      return "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
    case arbitrumSepolia.id:
      return "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    case optimismSepolia.id:
      return "0x5fd84259d66Cd46123540766Be93DFE6D43130D7";
    case base.id:
      return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    case arbitrum.id:
      return "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    case optimism.id:
      return "0x0b2c639c533813f4aa9d7837caf62653d097ff85";
    default:
      throw new Error("Unsupported chain");
  }
}
</script>

<style scoped>
header {
  display: flex;
  justify-content: end;
  align-items: center;
  padding: 16px;
  width: 100%;
  background-color: #f8f8f8;

  @media (prefers-color-scheme: dark) {
    background-color: #18181b;
  }
}

main {
  width: 100%;
  height: 60%;
  display: flex;
  justify-content: center;
  align-items: center;
}

button {
  background: rgb(43, 156, 255);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
}
</style>

<!-- eslint-disable-next-line vue/enforce-style-attribute -->
<style>
#app {
  isolation: isolate;
  width: 100%;
  height: 100vh;
}

:root {
  --font-general: "Inter Variable", -apple-system, "BlinkMacSystemFont",
    avenir next, avenir, segoe ui, helvetica neue, helvetica, "Ubuntu", roboto,
    noto, arial, sans-serif;
  --font-mono: "Inconsolata Variable", "Menlo", "Consolas", "Monaco",
    "Liberation Mono", "Lucida Console", monospace;
}

body {
  margin: 0;
  font-family: var(--font-general);
}

a {
  color: inherit;
  text-decoration: none;
}

/* Reset */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

input,
button,
textarea,
select {
  font: inherit;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
}
</style>
