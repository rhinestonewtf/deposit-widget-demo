<template>
  <header>
    <appkit-button />
  </header>
  <main>
    <button @click="openDepositModal">Deposit</button>
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
import { createAppKit } from "@reown/appkit/vue";
import { useAppKitAccount } from "@reown/appkit/vue";
import type { Address, Chain } from "viem";
import { computed, ref } from "vue";
import WidgetDialog from "./components/widget/WidgetDialog.vue";

const accountData = useAppKitAccount();
const account = computed(() => accountData.value?.address as Address);
const recipient = "0x0000000000000000000000000000000000000042" as Address;

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

const isModalOpen = ref(false);
function openDepositModal() {
  isModalOpen.value = true;
}

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const token = ref<Address>(USDC);
const chain = ref<Chain>(baseSepolia);
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
