<template>
  <img
    v-if="iconSrc"
    :src="iconSrc"
    :alt="symbol"
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="token-icon"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import ethIcon from "/icons/eth.svg?url";
import usdcIcon from "/icons/usdc.svg?url";

interface Props {
  symbol: string;
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
});

const iconSrc = computed(() => {
  const iconMap: Record<string, string> = {
    ETH: ethIcon,
    WETH: ethIcon,
    USDC: usdcIcon,
  };
  return iconMap[props.symbol.toUpperCase()] || "";
});
</script>

<style scoped>
.token-icon {
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
