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
          :style="{ maxWidth: inputWidth }"
          placeholder="0"
        />
      </div>
      <div v-if="quoteError" class="error-message">Not enough balance</div>
    </div>
    <div class="bottom">
      <div
        class="route-container"
        v-if="intentOp && inputTokens.length > 0 && outputToken"
      >
        <div class="path">
          <div class="inputs">
            <div class="input-tokens">
              <div
                v-for="inputToken in inputTokens"
                :key="`${inputToken.chain}-${inputToken.address}`"
                class="input-token"
              >
                <TokenIcon
                  v-if="getTokenSymbol(inputToken.chain, inputToken.address)"
                  :symbol="
                    getTokenSymbol(inputToken.chain, inputToken.address) || ''
                  "
                  class="icon"
                />
                <div class="token-info">
                  <div class="amount-row">
                    <span class="value">
                      {{
                        formatTokenAmount(
                          inputToken.chain,
                          inputToken.address,
                          inputToken.amount
                        )
                      }}
                    </span>
                    <span class="token-symbol">
                      {{
                        getTokenSymbol(inputToken.chain, inputToken.address) ||
                        "Unknown"
                      }}
                    </span>
                  </div>
                  <div class="chain-name">
                    on {{ getChain(inputToken.chain)?.name || "Unknown" }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <IconArrowRight class="icon-arrow" />
          <div class="output">
            <div class="output-token">
              <TokenIcon
                v-if="getTokenSymbol(outputToken.chain, outputToken.address)"
                :symbol="
                  getTokenSymbol(outputToken.chain, outputToken.address) || ''
                "
                class="icon"
              />
              <div class="token-info">
                <div class="amount-row">
                  <span class="value">
                    {{
                      formatTokenAmount(
                        outputToken.chain,
                        outputToken.address,
                        outputToken.amount
                      )
                    }}
                  </span>
                  <span class="token-symbol">
                    {{
                      getTokenSymbol(outputToken.chain, outputToken.address) ||
                      "Unknown"
                    }}
                  </span>
                </div>
                <div class="chain-name">
                  on {{ getChain(outputToken.chain)?.name || "Unknown" }}
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
import { computed, onMounted, ref, watch } from "vue";

import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
} from "viem/chains";
import RhinestoneService, { type ApiError } from "../../services/rhinestone";
import TokenIcon from "../TokenIcon.vue";
import IconArrowRight from "../icon/IconArrowRight.vue";
import WidgetDialogBalances from "./WidgetDialogBalances.vue";
import type { IntentOp, Token, TokenRequirement } from "./common";

const rhinestoneService = new RhinestoneService();

const emit = defineEmits<{
  next: [
    requirements: TokenRequirement[],
    intentOp: IntentOp,
    outputToken: Token,
    inputChain?: Chain | null,
    inputToken?: Address | null
  ];
}>();

const { token, chain, userAddress, recipient } = defineProps<{
  token: Address;
  chain: Chain;
  userAddress: Address;
  recipient: Address;
}>();

const isMainnets = computed(() => chain.testnet !== true);

const amount = ref<string>("");
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
const inputTokens = ref<Token[]>([]);
const inputTokenRequirements = ref<TokenRequirement[]>([]);
const intentOp = ref<IntentOp | null>(null);
const isQuoteLoading = ref(false);
const showBalances = ref(false);
const inputToken = ref<Address | null>(null);
const inputChain = ref<Chain | null>(null);
const quoteError = ref<ApiError | null>(null);

onMounted(() => {
  amountInput.value?.focus();
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
  return `${Math.max(characters + 0.5 * dots, 1)}ch`;
});

const isAmountZeroish = computed(() => {
  return !amount.value || amount.value === "0";
});

async function fetchQuote(): Promise<void> {
  const supportedChains = isMainnets.value
    ? [arbitrum, optimism, base]
    : [arbitrumSepolia, optimismSepolia, baseSepolia];
  if (isAmountZeroish.value) {
    return;
  }
  const amount = inputAmount.value;

  // If inputChain is specified, fetch quote for that chain only
  if (inputChain.value) {
    const quote = await rhinestoneService.getQuote(
      userAddress,
      chain,
      token,
      inputAmount.value,
      recipient,
      inputChain.value,
      inputToken.value || undefined
    );
    isQuoteLoading.value = false;

    // Prevent race conditions
    if (amount !== inputAmount.value) {
      return;
    }

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

    inputTokens.value = Object.entries(tokensSpent).flatMap(
      ([chainId, tokens]) =>
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
    return;
  }

  // If inputChain is not specified, fetch quotes for all supported chains
  const quotePromises = supportedChains.map(async (supportedChain) => {
    const quote = await rhinestoneService.getQuote(
      userAddress,
      chain,
      token,
      inputAmount.value,
      recipient,
      supportedChain,
      inputToken.value || undefined
    );
    return { quote, sourceChain: supportedChain };
  });

  const quoteResults = await Promise.all(quotePromises);
  isQuoteLoading.value = false;

  // Prevent race conditions
  if (amount !== inputAmount.value) {
    return;
  }

  // Filter valid quotes (no errors and has required data)
  const validQuotes = quoteResults.filter(
    ({ quote }) => !quote.error && quote.intentCost && quote.intentOp
  );

  // If no valid quotes, set error
  if (validQuotes.length === 0) {
    quoteError.value = {
      message: "No valid routes found",
    };
    inputTokens.value = [];
    intentOp.value = null;
    inputTokenRequirements.value = [];
    return;
  }

  // Clear any previous errors
  quoteError.value = null;

  // Pick the best quote - prioritize where input chain = target chain
  const targetChainId = chain.id.toString();
  let bestQuoteResult = validQuotes[0];

  if (!bestQuoteResult) {
    console.error("No valid quote result found");
    return;
  }

  for (const quoteResult of validQuotes) {
    if (!quoteResult.quote.intentCost) continue;
    const tokensSpent = quoteResult.quote.intentCost.tokensSpent;
    const inputChains = Object.keys(tokensSpent);

    // Check if this quote uses the target chain
    if (inputChains.includes(targetChainId)) {
      bestQuoteResult = quoteResult;
      break;
    }
  }

  const selectedQuote = bestQuoteResult.quote;
  if (!selectedQuote.intentCost || !selectedQuote.intentOp) {
    console.error("Selected quote missing required data");
    return;
  }

  const tokensSpent = selectedQuote.intentCost.tokensSpent;

  inputTokens.value = Object.entries(tokensSpent).flatMap(([chainId, tokens]) =>
    Object.entries(tokens).map(([tokenAddress, tokenData]) => ({
      chain: chainId,
      address: tokenAddress as Address,
      amount: BigInt(tokenData.unlocked),
    }))
  );
  intentOp.value = selectedQuote.intentOp;
  const tokenRequirements = selectedQuote.tokenRequirements || {};
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
}, 20 * 1000);

function handleContinue(): void {
  if (!intentOp.value) {
    console.error("No intent data available");
    return;
  }
  const firstElement = intentOp.value.elements[0];
  if (!firstElement) {
    console.error("No elements in intentOp");
    return;
  }
  inputChain.value = inputChain.value || getChain(firstElement.chainId);
  emit(
    "next",
    inputTokenRequirements.value,
    intentOp.value,
    outputToken.value,
    inputChain.value,
    inputToken.value
  );
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
      gap: 2px;
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
        field-sizing: content;
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

      .inputs,
      .output {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;

        .label {
          font-size: 12px;
          color: #666;
          text-align: center;
        }
      }

      .inputs {
        align-items: flex-end;
      }

      .output {
        align-items: flex-start;
      }

      .input-tokens {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 120px;
        overflow: scroll;
      }

      .input-token,
      .output-token {
        display: flex;
        align-items: center;
        gap: 8px;

        .icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .token-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .amount-row {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .chain-name {
          font-size: 12px;
          color: #999;
        }
      }

      .icon-arrow {
        width: 16px;
        height: 16px;
        color: #666;
        flex-shrink: 0;
      }
    }

    .custom-route-button {
      background: transparent;
      color: #6b6b6b;
      border-radius: 8px;
      outline: none;
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
