<template>
  <div class="balances-panel">
    <div v-if="isLoading" class="loading">Loading balances...</div>

    <div v-else class="balances-list">
      <div class="balance-item all-option" @click="handleSelectAll">
        <div class="balance-info">
          <div class="all-icon" />
          <div class="token-details">
            <span class="token-symbol">Default</span>
            <span class="chain-name">Use best available route</span>
          </div>
        </div>
      </div>

      <div
        v-for="balance in balances"
        :key="`${balance.chainId}-${balance.tokenAddress}`"
        class="balance-item"
        @click="handleSelect(balance)"
      >
        <div class="balance-info">
          <TokenIcon
            v-if="balance.symbol"
            :symbol="balance.symbol"
            :chain="getChain(balance.chainId)"
            class="token-icon"
            :size="32"
          />
          <div class="token-details">
            <span class="token-symbol">{{ balance.symbol }}</span>
            <span class="chain-name">{{ balance.chainName }}</span>
          </div>
        </div>
        <div class="balance-amounts">
          <div class="balance-amount">{{ balance.formattedBalance }}</div>
          <div class="balance-usd">${{ balance.formattedUsdValue }}</div>
        </div>
      </div>

      <div v-if="balances.length === 0" class="empty-state">
        No token balances found
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  chainRegistry,
  mainnetChains,
  chains as registryChains,
  testnetChains,
} from "@rhinestone/shared-configs";
import { type Address, type Chain, formatUnits } from "viem";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
  soneium,
} from "viem/chains";
import { onMounted, ref } from "vue";

import RhinestoneService from "../../services/rhinestone";
import TokenIcon from "../TokenIcon.vue";

const rhinestoneService = new RhinestoneService();

const emit = defineEmits<{
  close: [];
  select: [token: Address | null, chain: Chain | null];
}>();

const { userAddress, isMainnets } = defineProps<{
  userAddress: Address;
  isMainnets: boolean;
}>();

interface TokenBalance {
  chainId: number;
  chainName: string;
  tokenAddress: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
  usdValue: number;
  formattedUsdValue: string;
}

const balances = ref<TokenBalance[]>([]);
const isLoading = ref(false);
const ethPrice = ref<number>(0);

onMounted(async () => {
  await fetchBalances();
});

async function fetchEthPrice(): Promise<number> {
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=ethereum";
    const response = await fetch(url);
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch (error) {
    console.error("Failed to fetch ETH price:", error);
    return 0;
  }
}

function getChain(chainId: number): Chain | null {
  return registryChains.find((c) => c.id === chainId) || null;
}

function getTokenUsdPrice(symbol: string, ethPrice: number): number {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol === "USDC" || upperSymbol === "USDT") {
    return 1;
  }
  if (upperSymbol === "ETH" || upperSymbol === "WETH") {
    return ethPrice;
  }
  return 0;
}

async function fetchBalances(): Promise<void> {
  isLoading.value = true;
  const allBalances: TokenBalance[] = [];

  try {
    // Fetch ETH price first
    ethPrice.value = await fetchEthPrice();

    const portfolio = await rhinestoneService.getPortfolio(userAddress, {
      chainIds: isMainnets
        ? mainnetChains
            .filter((chain) => chain.id !== 1)
            .filter((chain) => chain.id !== 146)
            .map((chain) => chain.id)
        : testnetChains.map((chain) => chain.id),
    });

    for (const tokenPortfolio of portfolio) {
      // Iterate through each chain where this token has a balance
      for (const chainBalance of tokenPortfolio.chains) {
        const totalBalance = chainBalance.locked + chainBalance.unlocked;

        // Skip non USDC balances
        if (tokenPortfolio.symbol !== "USDC") {
          continue;
        }

        // Skip if balance is zero
        if (totalBalance === 0n) {
          continue;
        }

        // Only include non-zero balances
        const chainEntry = chainRegistry[chainBalance.chain.toString()];
        const formattedBalance = formatUnits(
          totalBalance,
          tokenPortfolio.decimals
        );
        const num = Number.parseFloat(formattedBalance);

        // Calculate USD value
        const tokenPrice = getTokenUsdPrice(
          tokenPortfolio.symbol,
          ethPrice.value
        );
        const usdValue = num * tokenPrice;

        allBalances.push({
          chainId: chainBalance.chain,
          chainName: chainEntry?.name || `Chain ${chainBalance.chain}`,
          tokenAddress: chainBalance.address,
          symbol: tokenPortfolio.symbol,
          decimals: tokenPortfolio.decimals,
          balance: totalBalance,
          formattedBalance: num.toFixed(5).replace(/\.?0+$/, ""),
          usdValue,
          formattedUsdValue: usdValue.toFixed(2),
        });
      }
    }

    // Sort balances by USD value from highest to lowest
    allBalances.sort((a, b) => b.usdValue - a.usdValue);

    balances.value = allBalances;
  } catch (error) {
    console.error("Failed to fetch portfolio:", error);
  } finally {
    isLoading.value = false;
  }
}

function getViemChain(chainId: number): Chain | null {
  // Map chain IDs to viem chain objects
  const chainMap: Record<number, Chain> = {
    1: mainnet,
    10: optimism,
    137: polygon,
    1868: soneium,
    8453: base,
    42161: arbitrum,
    11155111: sepolia,
    84532: baseSepolia,
    11155420: optimismSepolia,
    421614: arbitrumSepolia,
  };

  return chainMap[chainId] || null;
}

function handleSelect(balance: TokenBalance): void {
  const viemChain = getViemChain(balance.chainId);
  if (!viemChain) {
    console.error("Chain not found:", balance.chainId);
    return;
  }

  emit("select", balance.tokenAddress, viemChain);
  emit("close");
}

function handleSelectAll(): void {
  // Emit with null values to clear the custom route
  emit("select", null, null);
  emit("close");
}
</script>

<style scoped>
.balances-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fff;
  border-radius: 0 0 8px 8px;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #000;
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #000;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px;
  color: #666;
}

.balances-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.balance-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #fafafa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.balance-item:hover {
  background-color: #f0f0f0;
  border-color: #d0d0d0;
}

.balance-item.all-option {
  background-color: #e8f4ff;
  border-color: rgb(43, 156, 255);
}

.balance-item.all-option:hover {
  background-color: #d6ebff;
  border-color: rgb(43, 156, 255);
}

.all-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.balance-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-symbol {
  font-size: 14px;
  font-weight: 600;
  color: #000;
}

.chain-name {
  font-size: 12px;
  color: #666;
}

.balance-amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.balance-amount {
  font-size: 14px;
  font-weight: 600;
  color: #000;
}

.balance-usd {
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px;
  color: #666;
  font-size: 14px;
}
</style>
