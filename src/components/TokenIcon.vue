<template>
  <div
    v-if="iconSrc"
    class="token-icon-wrapper"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      :src="iconSrc"
      :alt="symbol"
      :style="{ width: `${size}px`, height: `${size}px` }"
      class="token-icon"
    />
    <img
      v-if="chainIconSrc"
      :src="chainIconSrc"
      :alt="chain?.name"
      :style="{ width: `${chainSize}px`, height: `${chainSize}px` }"
      class="chain-icon"
    />
  </div>
</template>

<script setup lang="ts">
import type { Chain } from "viem";
import { computed } from "vue";
import arbitrumIcon from "/icons/arbitrum.svg?url";
import baseIcon from "/icons/base.svg?url";
import ethIcon from "/icons/eth.svg?url";
import ethereumIcon from "/icons/ethereum.svg?url";
import optimismIcon from "/icons/optimism.svg?url";
import polygonIcon from "/icons/polygon.svg?url";
import usdcIcon from "/icons/usdc.svg?url";

interface Props {
  symbol: string;
  size?: number;
  chain?: Chain | null;
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  chain: undefined,
});

const iconSrc = computed(() => {
  const iconMap: Record<string, string> = {
    ETH: ethIcon,
    WETH: ethIcon,
    USDC: usdcIcon,
  };
  return iconMap[props.symbol.toUpperCase()] || "";
});

const chainSize = computed(() => Math.round(props.size * 0.6));

const chainIconSrc = computed(() => {
  if (!props.chain) return "";

  const chainIconMap: Record<number, string> = {
    1: ethereumIcon, // Ethereum Mainnet
    10: optimismIcon, // Optimism
    137: polygonIcon, // Polygon
    8453: baseIcon, // Base
    42161: arbitrumIcon, // Arbitrum
    11155111: ethereumIcon, // Sepolia
    84532: baseIcon, // Base Sepolia
    11155420: optimismIcon, // Optimism Sepolia
    421614: arbitrumIcon, // Arbitrum Sepolia
  };

  return chainIconMap[props.chain.id] || "";
});
</script>

<style scoped>
.token-icon-wrapper {
  position: relative;
  flex-shrink: 0;
  display: inline-block;
}

.token-icon {
  border-radius: 50%;
  display: block;
}

.chain-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  border-radius: 50%;
  border: 2px solid white;
  background: white;
  display: block;
}
</style>
