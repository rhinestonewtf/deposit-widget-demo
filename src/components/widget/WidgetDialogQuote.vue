<template>
  <div class="panel">
    <div class="top">
      <div
        class="input-wrapper"
        :class="{ 'has-error': quoteError }"
        @click="focusInput"
      >
        <span class="dollar-sign">$</span>
        <input
          ref="amountInput"
          v-model="amount"
          :style="{ width: inputWidth }"
          placeholder="0"
        />
      </div>
      <div v-if="quoteError" class="error-message">Not enough balance</div>
    </div>
    <div class="bottom">
      <div class="route-container" v-if="intentOp">
        <div class="path">
          <div class="input">
            <TokenIcon
              v-if="
                getTokenSymbol(firstInputToken.chain, firstInputToken.address)
              "
              :symbol="
                getTokenSymbol(
                  firstInputToken.chain,
                  firstInputToken.address
                ) || ''
              "
              :chain="getChain(firstInputToken.chain)"
              class="icon"
            />
            <div class="details">
              <div class="label">You send</div>
              <div class="amount">
                <div class="value">
                  {{
                    formatTokenAmount(
                      firstInputToken.chain,
                      firstInputToken.address,
                      firstInputToken.amount
                    )
                  }}
                </div>
                <div class="token-symbol">
                  {{
                    getTokenSymbol(
                      firstInputToken.chain,
                      firstInputToken.address
                    ) || "Unknown"
                  }}
                </div>
              </div>
            </div>
          </div>
          <IconArrowRight class="icon-arrow" />
          <div class="output">
            <TokenIcon
              v-if="getTokenSymbol(outputToken.chain, outputToken.address)"
              :symbol="
                getTokenSymbol(outputToken.chain, outputToken.address) || ''
              "
              :chain="getChain(outputToken.chain)"
              class="icon"
            />
            <div class="details">
              <div class="label">You deposit</div>
              <div class="amount">
                <div class="value">
                  {{
                    formatTokenAmount(
                      outputToken.chain,
                      outputToken.address,
                      outputToken.amount
                    )
                  }}
                </div>
                <div class="token-symbol">
                  {{
                    getTokenSymbol(outputToken.chain, outputToken.address) ||
                    "Unknown"
                  }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <button class="custom-route-button" @click="showBalances = true">
          Custom Route
        </button>
      </div>
      <button
        :disabled="!amount || isQuoteLoading || !!quoteError"
        @click="handleContinue"
      >
        Continue
      </button>
    </div>

    <WidgetDialogBalances
      v-if="showBalances"
      :user-address="userAddress"
      :is-mainnets="isMainnets"
      @close="showBalances = false"
      @select="handleTokenSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { chainRegistry, chains } from "@rhinestone/shared-configs";
import { useIntervalFn, watchDebounced } from "@vueuse/core";
import { type Address, type Chain, formatUnits, parseUnits } from "viem";
import { computed, ref, watch } from "vue";

import RhinestoneService, { type ApiError } from "../../services/rhinestone";
import TokenIcon from "../TokenIcon.vue";
import IconArrowRight from "../icon/IconArrowRight.vue";
import WidgetDialogBalances from "./WidgetDialogBalances.vue";
import type { IntentOp, TokenRequirement } from "./common";

const apiKey = import.meta.env.VITE_PUBLIC_RHINESTONE_API_KEY;
if (!apiKey) {
  throw new Error("VITE_PUBLIC_RHINESTONE_API_KEY is not set");
}
const rhinestoneService = new RhinestoneService(apiKey);

const emit = defineEmits<{
  next: [requirements: TokenRequirement[], intentOp: IntentOp];
}>();

const { token, chain, userAddress, recipient } = defineProps<{
  token: Address;
  chain: Chain;
  userAddress: Address;
  recipient: Address;
}>();

interface InputToken {
  chain: string;
  address: Address;
  amount: bigint;
}

const isMainnets = computed(() => chain.testnet !== true);

const amount = ref<number>(0);
const amountInput = ref<HTMLInputElement | null>(null);
const inputAmount = computed(() => {
  const chainEntry = chainRegistry[chain.id.toString()];
  if (!chainEntry) return BigInt(0);

  const tokenEntry = chainEntry.tokens.find(
    (t) => t.address.toLowerCase() === token.toLowerCase()
  );
  const decimals = tokenEntry?.decimals || 18;

  return parseUnits(amount.value.toString(), decimals);
});
const inputTokens = ref<InputToken[]>([]);
const inputTokenRequirements = ref<TokenRequirement[]>([]);
const intentOp = ref<IntentOp | null>(null);
const isQuoteLoading = ref(false);
const showBalances = ref(false);
const inputToken = ref<Address | null>(null);
const inputChain = ref<Chain | null>(null);
const quoteError = ref<ApiError | null>(null);

const firstInputToken = computed(() => {
  return inputTokens.value[0] as InputToken;
});
const outputToken = computed(() => {
  return {
    chain: chain.id.toString(),
    address: token,
    amount: inputAmount.value,
  };
});

const inputWidth = computed(() => {
  const value = amount.value.toString();
  const tokens = value.split(".");
  const characters = tokens.reduce((acc, token) => acc + token.length, 0);
  const dots = tokens.length - 1;
  return `${Math.max(characters + 0.25 * dots, 1)}ch`;
});

const isAmountZeroish = computed(() => {
  return !amount.value || amount.value === 0;
});

async function fetchQuote(): Promise<void> {
  if (isAmountZeroish.value) {
    return;
  }

  const quote = await rhinestoneService.getQuote(
    userAddress,
    chain,
    token,
    inputAmount.value,
    recipient,
    inputChain.value || undefined,
    inputToken.value || undefined
  );
  isQuoteLoading.value = false;

  // Check if the quote contains an error
  if (quote.error) {
    quoteError.value = quote.error;
    inputTokens.value = [];
    intentOp.value = null;
    inputTokenRequirements.value = [];
    return;
  }

  // Clear any previous errors
  quoteError.value = null;

  if (!quote.intentCost || !quote.intentOp) {
    console.error("Quote response missing required data");
    return;
  }

  const tokensSpent = quote.intentCost.tokensSpent;

  inputTokens.value = Object.entries(tokensSpent).flatMap(([chainId, tokens]) =>
    Object.entries(tokens).map(([tokenAddress, tokenData]) => ({
      chain: chainId,
      address: tokenAddress as Address,
      amount: BigInt(tokenData.unlocked),
    }))
  );
  intentOp.value = quote.intentOp;
  const tokenRequirements = quote.tokenRequirements || {};
  inputTokenRequirements.value = Object.entries(tokenRequirements).flatMap(
    ([chainId, tokens]) =>
      Object.entries(tokens).map(([tokenAddress, tokenData]) => {
        const base = {
          chain: chainId,
          address: tokenAddress as Address,
          type: tokenData.type,
          amount: BigInt(tokenData.amount),
        };

        if (tokenData.type === "approval") {
          return {
            ...base,
            type: "approval" as const,
            spender: tokenData.spender,
          };
        }
        return {
          ...base,
          type: "wrap" as const,
        };
      })
  );
}

watch([amount, inputChain, inputToken], ([amountValue]) => {
  // Reset intentOp and error when custom route changes
  intentOp.value = null;
  quoteError.value = null;
  if (amountValue) {
    isQuoteLoading.value = true;
  }
});

watchDebounced(
  [amount, inputChain, inputToken],
  async () => {
    await fetchQuote();
  },
  { debounce: 250, maxWait: 2000 }
);

// Poll for updated quotes every 10 seconds
useIntervalFn(async () => {
  if (!isAmountZeroish.value) {
    await fetchQuote();
  }
}, 10000);

function handleContinue(): void {
  if (!intentOp.value) {
    console.error("No intent data available");
    return;
  }
  emit("next", inputTokenRequirements.value, intentOp.value);
}

function focusInput(): void {
  amountInput.value?.focus();
}

function handleTokenSelect(
  selectedToken: Address | null,
  selectedChain: Chain | null
): void {
  // Reset the quote and error
  inputTokens.value = [];
  quoteError.value = null;
  // Handle "All Routes" option (null values)
  if (!selectedToken || !selectedChain) {
    inputToken.value = null;
    inputChain.value = null;
    showBalances.value = false;
    return;
  }

  // Convert ETH (zero address) to WETH
  if (
    selectedToken.toLowerCase() === "0x0000000000000000000000000000000000000000"
  ) {
    const chainEntry = chainRegistry[selectedChain.id.toString()];
    if (chainEntry) {
      const wethToken = chainEntry.tokens.find(
        (t) => t.symbol === "WETH" || t.symbol === "WPOL"
      );
      if (wethToken) {
        inputToken.value = wethToken.address as Address;
        inputChain.value = selectedChain;
        showBalances.value = false;
        return;
      }
    }
  }

  inputToken.value = selectedToken;
  inputChain.value = selectedChain;
  showBalances.value = false;
}

function getTokenSymbol(chainId: string, tokenAddress: Address): string | null {
  const chainEntry = chainRegistry[chainId];
  if (!chainEntry) return null;

  const tokenEntry = chainEntry.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return tokenEntry?.symbol || null;
}

function getChain(chainId: string): Chain | null {
  return chains.find((c) => c.id.toString() === chainId) || null;
}

function formatTokenAmount(
  chainId: string,
  tokenAddress: Address,
  amount: bigint
): string {
  const chainEntry = chainRegistry[chainId];
  if (!chainEntry) return "0";

  const tokenEntry = chainEntry.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  const decimals = tokenEntry?.decimals || 18;

  const formatted = formatUnits(amount, decimals);
  const num = Number.parseFloat(formatted);

  // Format with 5 decimal places maximum
  return num.toFixed(5).replace(/\.?0+$/, "");
}
</script>

<style scoped>
.panel {
  color: #000;
  padding: 16px;
  height: 400px;
  background-color: #fff;
  gap: 16px;
  display: flex;
  border-radius: 0 0 8px 8px;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  position: relative;

  .top {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .input-wrapper {
      display: flex;
      justify-content: center;
      align-items: baseline;
      width: 100%;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: text;

      &.has-error {
        border-color: #ef4444;
        background-color: #fef2f2;
      }

      .dollar-sign {
        font-size: 40px;
        font-weight: 600;
        color: #000;
      }

      input {
        border: none;
        background: transparent;
        text-align: center;
        font-size: 48px;
        font-weight: 600;
        color: #000;
        outline: none;
        min-width: 0;
        flex: none;
        padding: 0;
      }
    }

    .error-message {
      font-size: 12px;
      color: #ef4444;
      text-align: center;
    }
  }

  .bottom {
    display: flex;
    flex-direction: column;
    gap: 32px;

    .route-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .path {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;

      .input {
        justify-content: end;
      }

      .output {
        justify-content: start;
      }

      .input,
      .output {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;

        .icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        .details {
          display: flex;
          flex-direction: column;
        }

        .label {
          font-size: 12px;
          color: #666;
        }

        .amount {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
        }
      }

      .icon-arrow {
        width: 16px;
        height: 16px;
        color: #666;
      }
    }

    .custom-route-button {
      background: transparent;
      color: #6b6b6b;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      padding: 0;

      &:hover {
        color: #606060;
      }
    }

    button {
      width: 100%;
      background: rgb(43, 156, 255);
      color: #fff;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;

      &:disabled {
        background: #e0e0e0;
        color: #000;
        cursor: not-allowed;
      }
    }
  }
}

.panel:focus {
  outline: none;
}
</style>
