<template>
  <Dialog.Root :open="open" @update:open="handleOpen">
    <Dialog.Portal>
      <Dialog.Overlay class="overlay" />
      <Dialog.Content as-child>
        <div class="content">
          <VisuallyHidden as-child>
            <Dialog.Title>Deposit</Dialog.Title>
          </VisuallyHidden>
          <VisuallyHidden as-child>
            <Dialog.Description>
              Deposit your funds to the platform
            </Dialog.Description>
          </VisuallyHidden>
          <div class="panel">
            <div class="top">
              <div class="header">Deposit</div>
              <div class="input-wrapper">
                <span class="dollar-sign">$</span>
                <input
                  v-model="amount"
                  :style="{ width: inputWidth }"
                  placeholder="0"
                />
              </div>
            </div>
            <div class="bottom">
              <div class="input-tokens">
                <div
                  class="input-token"
                  v-for="token in inputTokens"
                  :key="`${token.chain}-${token.address}`"
                >
                  <div class="input-token-info">
                    <img
                      v-if="getTokenSymbol(token.chain, token.address)"
                      :src="
                        getTokenIcon(
                          getTokenSymbol(token.chain, token.address) || ''
                        )
                      "
                      :alt="getTokenSymbol(token.chain, token.address) || ''"
                      class="token-icon"
                    />
                    <span class="token-symbol">{{
                      getTokenSymbol(token.chain, token.address) || "Unknown"
                    }}</span>
                  </div>
                  <div class="input-token-amount">
                    {{
                      formatTokenAmount(
                        token.chain,
                        token.address,
                        token.amount
                      )
                    }}
                  </div>
                </div>
              </div>
              <button
                :disabled="!amount || isQuoteLoading"
                @click="handleDeposit"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</template>

<script setup lang="ts">
import { useAppKitAccount } from "@reown/appkit/vue";
import { chainRegistry } from "@rhinestone/shared-configs";
import { watchDebounced } from "@vueuse/core";
import { VisuallyHidden } from "reka-ui";
import { Dialog } from "reka-ui/namespaced";
import { type Address, type Chain, formatUnits, parseUnits } from "viem";
import { computed, ref, watch } from "vue";

import RhinestoneService from "../../services/rhinestone";

const apiKey = import.meta.env.VITE_PUBLIC_RHINESTONE_API_KEY;
if (!apiKey) {
  throw new Error("VITE_PUBLIC_RHINESTONE_API_KEY is not set");
}
const rhinestoneService = new RhinestoneService(apiKey);

const accountData = useAppKitAccount();

const open = defineModel<boolean>("open", {
  required: true,
});

const { token, chain } = defineProps<{
  token: Address;
  chain: Chain;
}>();

function handleOpen(value: boolean): void {
  if (!value) {
    open.value = false;
  }
}

interface InputToken {
  chain: string;
  address: Address;
  amount: bigint;
}
type TokenRequirement =
  | {
      chain: string;
      address: Address;
      type: "approval";
      amount: bigint;
      spender: Address;
    }
  | {
      chain: string;
      address: Address;
      type: "wrap";
      amount: bigint;
    };

const amount = ref<number>(0);
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
const isQuoteLoading = ref(false);

const inputWidth = computed(() => {
  const value = amount.value.toString();
  const length = value.length || 1;
  return `${Math.max(length * 0.6 + 0.2, 1)}em`;
});

watch(amount, (value) => {
  if (value) {
    isQuoteLoading.value = true;
  }
});
watchDebounced(
  amount,
  async (value) => {
    const address = accountData.value.address;
    if (!address) {
      return;
    }
    if (value) {
      const quote = await rhinestoneService.getQuote(
        address as `0x${string}`,
        chain,
        token,
        inputAmount.value
      );
      isQuoteLoading.value = false;
      const tokensSpent = quote.intentCost.tokensSpent;

      inputTokens.value = Object.entries(tokensSpent).flatMap(
        ([chainId, tokens]) =>
          Object.entries(tokens).map(([tokenAddress, tokenData]) => ({
            chain: chainId,
            address: tokenAddress as Address,
            amount: BigInt(tokenData.unlocked),
          }))
      );
      const tokenRequirements = quote.tokenRequirements;
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
  },
  { debounce: 250, maxWait: 2000 }
);

function handleDeposit(): void {
  console.log("deposit", amount.value);
}

function getTokenSymbol(chainId: string, tokenAddress: Address): string | null {
  const chainEntry = chainRegistry[chainId];
  if (!chainEntry) return null;

  const tokenEntry = chainEntry.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return tokenEntry?.symbol || null;
}

function getTokenIcon(symbol: string): string {
  const iconMap: Record<string, string> = {
    ETH: "/icons/eth.svg",
    WETH: "/icons/eth.svg",
    USDC: "/icons/usdc.svg",
  };
  return iconMap[symbol] || "";
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
.overlay {
  position: fixed;
  z-index: 1;
  background-color: rgb(0 0 0 / 40%);
  inset: 0;
  backdrop-filter: blur(4px);
}

.overlay[data-state="open"] {
  animation: overlay-show 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes overlay-show {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.content {
  --top: 40%;

  position: fixed;
  z-index: 1;
  top: var(--top);
  left: 50%;
  width: 360px;
  max-width: 90vw;
  max-height: 80vh;
  transform: translate(-50%, -50%);

  @media (height < 680px) {
    --top: 50%;
  }
}

.content[data-state="open"] {
  animation: content-show 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes content-show {
  from {
    transform: translate(-50%, -48%) scale(0.96);
    opacity: 0;
  }

  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

.panel {
  padding: 16px;
  height: 400px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

  .top {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .header {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
    }

    .input-wrapper {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 4px;
      width: 100%;
      padding: 8px;
      margin-bottom: 16px;
      background-color: #fafafa;
      border-radius: 4px;
      border: 1px solid transparent;

      &:focus-within {
        border-color: #e0e0e0;
      }

      .dollar-sign {
        font-size: 26px;
        font-weight: 600;
        color: #000;
      }

      input {
        border: none;
        background: transparent;
        text-align: center;
        font-size: 32px;
        font-weight: 600;
        color: #000;
        outline: none;
        min-width: 0;
        flex: none;
        padding: 0;
      }
    }
  }

  .bottom {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .input-tokens {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .input-token {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background-color: #fafafa;
        border-radius: 6px;
        border: 1px solid #e0e0e0;

        .input-token-info {
          display: flex;
          align-items: center;
          gap: 8px;

          .token-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
          }

          .token-symbol {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
        }

        .input-token-amount {
          font-size: 14px;
          font-weight: 500;
          color: #666;
        }
      }
    }

    button {
      width: 100%;
      background: rgb(43, 156, 255);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 18px;
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
