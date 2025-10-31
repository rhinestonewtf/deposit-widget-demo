<template>
  <div class="panel">
    <div class="top">
      <div class="deposit">
        <TokenIcon
          v-if="outputToken"
          :symbol="getTokenSymbol(outputToken.chain, outputToken.address) || ''"
          :chain="getChain(outputToken.chain)"
          class="token-icon"
          :size="40"
        />
        <div class="deposit-details">
          Depositing
          {{
            formatTokenAmount(
              outputToken.chain,
              outputToken.address,
              outputToken.amount
            )
          }}
          {{ getTokenSymbol(outputToken.chain, outputToken.address) || "" }} on
          {{ getChainName(outputToken.chain) }}
        </div>
      </div>
      <div class="requirements">
        <div
          v-for="(requirement, index) in requirements"
          :key="index"
          class="requirement-item"
          :class="{
            active: currentStep === index,
            completed: completedRequirements.has(index),
            failed: failedStep === index,
          }"
        >
          <div class="requirement-info">
            <TokenIcon
              v-if="getTokenSymbol(requirement.chain, requirement.address)"
              :symbol="
                getTokenSymbol(requirement.chain, requirement.address) || ''
              "
              class="token-icon"
            />
            <div class="requirement-text">
              <div class="requirement-text-content">
                <span class="action-type">{{
                  requirement.type === "wrap" ? "Wrap" : "Approve"
                }}</span>
                <span class="amount" v-if="requirement.type === 'wrap'">{{
                  formatTokenAmount(
                    requirement.chain,
                    requirement.address,
                    requirement.amount
                  )
                }}</span>
                <span class="token-symbol">{{
                  getTokenSymbol(requirement.chain, requirement.address) ||
                  "Unknown"
                }}</span>
              </div>
              <span class="chain-name"
                >on {{ getChainName(requirement.chain) }}</span
              >
            </div>
          </div>
          <span v-if="completedRequirements.has(index)" class="status-badge">
            <IconCheck />
          </span>
          <span
            v-else-if="failedStep === index"
            class="status-badge failed-badge"
          >
            <IconX />
          </span>
        </div>

        <!-- Signing requirement -->
        <div
          class="requirement-item"
          :class="{
            active: currentStep === requirements.length,
            completed: isSigningCompleted,
            failed: failedStep === requirements.length,
          }"
        >
          <div class="requirement-info">
            <div class="requirement-text">
              <span class="action-type">Sign Intent</span>
              <span class="chain-name">Approve the deposit order</span>
            </div>
          </div>
          <span v-if="isSigningCompleted" class="status-badge">
            <IconCheck />
          </span>
          <span
            v-else-if="failedStep === requirements.length"
            class="status-badge failed-badge"
          >
            <IconX />
          </span>
        </div>
      </div>
    </div>
    <div class="bottom">
      <button
        v-if="failedStep !== null"
        @click="handleRetry"
        class="retry-button"
      >
        Retry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { chainRegistry, chains } from "@rhinestone/shared-configs";
import {
  getAccount,
  signTypedData,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import {
  type Address,
  type Chain,
  type Hex,
  formatUnits,
  maxUint256,
} from "viem";
import { onMounted, ref } from "vue";
import { wagmiConfig } from "../../config/appkit";
import RhinestoneService from "../../services/rhinestone";
import TokenIcon from "../TokenIcon.vue";
import IconCheck from "../icon/IconCheck.vue";
import IconX from "../icon/IconX.vue";
import type { IntentOp, Token, TokenRequirement } from "./common";
import { getTypedData } from "./permit2";

const rhinestoneService = new RhinestoneService();

const emit = defineEmits<{
  next: [intentOp: IntentOp, signature: Hex];
  retry: [];
}>();

const {
  requirements,
  intentOp: initialIntentOp,
  outputToken,
  userAddress,
  recipient,
  inputChain,
  inputToken,
} = defineProps<{
  requirements: TokenRequirement[];
  intentOp: IntentOp;
  outputToken: Token;
  userAddress: Address;
  recipient: Address;
  inputChain?: Chain | null;
  inputToken?: Address | null;
}>();

const intentOp = ref<IntentOp>(initialIntentOp);

const completedRequirements = ref<Set<number>>(new Set());
const isSigningCompleted = ref(false);
const signature = ref<Hex | null>(null);
const currentStep = ref<number>(0);
const failedStep = ref<number | null>(null);

// Start auto-execution when component mounts
onMounted(() => {
  executeNextStep();
});

function getTokenSymbol(chainId: string, tokenAddress: Address): string | null {
  const chainEntry = chainRegistry[chainId];
  if (!chainEntry) return null;

  const tokenEntry = chainEntry.tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return tokenEntry?.symbol || null;
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

function getChain(chainId: string): Chain | null {
  return chains.find((c) => c.id.toString() === chainId) || null;
}

function getChainName(chainId: string): string {
  const chain = getChain(chainId);
  return chain?.name || `Chain ${chainId}`;
}

async function executeNextStep(): Promise<void> {
  // Execute token requirements first
  if (currentStep.value < requirements.length) {
    const requirement = requirements[currentStep.value];
    if (!requirement) {
      console.error("No requirement found at current step");
      return;
    }

    const success = await handleAction(requirement);

    if (success) {
      completedRequirements.value.add(currentStep.value);
      currentStep.value++;
      // Continue to next step
      await executeNextStep();
    } else {
      // Mark current step as failed
      failedStep.value = currentStep.value;
    }
  }
  // Then execute signing
  else if (
    currentStep.value === requirements.length &&
    !isSigningCompleted.value
  ) {
    const success = await handleSigning();

    if (success) {
      isSigningCompleted.value = true;
      // Automatically advance to next step
      handleContinue();
    } else {
      // Mark signing step as failed
      failedStep.value = requirements.length;
    }
  }
}

async function handleAction(requirement: TokenRequirement): Promise<boolean> {
  try {
    // Get the connected account
    const account = getAccount(wagmiConfig);

    if (!account.address) {
      console.error("No account connected");
      return false;
    }

    const chainIdNum = Number(requirement.chain);
    const chainList = Object.values(chains) as Chain[];
    const chain = chainList.find((c) => c.id === chainIdNum);

    if (!chain) {
      console.error(`Unsupported chain: ${requirement.chain}`);
      return false;
    }

    // Switch to the required chain using Wagmi
    await switchChain(wagmiConfig, { chainId: chain.id });

    if (requirement.type === "wrap") {
      // Handle WETH-style wrap (deposit native token)
      const hash = await writeContract(wagmiConfig, {
        address: requirement.address,
        abi: [
          {
            name: "deposit",
            type: "function",
            stateMutability: "payable",
            inputs: [],
            outputs: [],
          },
        ],
        functionName: "deposit",
        value: requirement.amount,
      });

      // Wait for transaction confirmation using Wagmi
      await waitForTransactionReceipt(wagmiConfig, { hash });

      return true;
    }

    if (requirement.type === "approval") {
      // Handle ERC20 approval
      const hash = await writeContract(wagmiConfig, {
        address: requirement.address,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [requirement.spender, maxUint256],
      });

      // Wait for transaction confirmation using Wagmi
      await waitForTransactionReceipt(wagmiConfig, { hash });

      return true;
    }

    return false;
  } catch (error) {
    console.error("Action failed:", error);
    return false;
  }
}

async function fetchQuote(): Promise<boolean> {
  try {
    const chain = getChain(outputToken.chain);
    if (!chain) {
      console.error(`Unsupported chain: ${outputToken.chain}`);
      return false;
    }

    const quote = await rhinestoneService.getQuote(
      userAddress,
      chain,
      outputToken.address,
      outputToken.amount,
      recipient,
      inputChain || undefined,
      inputToken || undefined
    );

    // Check if the quote contains an error
    if (quote.error) {
      console.error("Quote error:", quote.error);
      return false;
    }

    if (!quote.intentOp) {
      console.error("Quote response missing intentOp");
      return false;
    }

    // Update the intentOp with fresh data
    intentOp.value = quote.intentOp;
    return true;
  } catch (error) {
    console.error("Failed to fetch quote:", error);
    return false;
  }
}

async function handleSigning(): Promise<boolean> {
  try {
    // Get the connected account
    const account = getAccount(wagmiConfig);

    if (!account.address) {
      console.error("No account connected");
      return false;
    }

    // Fetch the latest quote before signing
    const quoteSuccess = await fetchQuote();
    if (!quoteSuccess) {
      console.error("Failed to get fresh quote");
      return false;
    }

    // Sign the first element in the intentOp
    const element = intentOp.value.elements[0];
    if (!element) {
      console.error("No elements in intentOp");
      return false;
    }

    const chainIdNum = Number(element.chainId);
    const chainList = Object.values(chains) as Chain[];
    const chain = chainList.find((c) => c.id === chainIdNum);

    if (!chain) {
      console.error(`Unsupported chain: ${element.chainId}`);
      return false;
    }

    // Switch to the required chain using Wagmi
    await switchChain(wagmiConfig, { chainId: chain.id });

    // Generate typed data for this element
    const typedData = getTypedData(
      element,
      BigInt(intentOp.value.nonce),
      BigInt(intentOp.value.expires)
    );

    // Sign the typed data using Wagmi
    const sig = await signTypedData(wagmiConfig, {
      ...typedData,
    });

    // Store the signature
    signature.value = sig;
    return true;
  } catch (error) {
    console.error("Signing failed:", error);
    return false;
  }
}

function handleRetry(): void {
  emit("retry");
}

function handleContinue(): void {
  if (!signature.value) {
    console.error("No signature available");
    return;
  }
  emit("next", intentOp.value, signature.value);
}
</script>

<style scoped>
.panel {
  color: #000;
  padding: 16px;
  height: 400px;
  border-radius: 0 0 8px 8px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

  .top {
    display: flex;
    flex-direction: column;
    gap: 32px;
    flex: 1;
    overflow-y: auto;

    .deposit {
      margin-top: 16px;
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 8px;
    }

    .deposit-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }

    .requirements {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .requirement-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 6px;
        gap: 12px;
        transition: all 0.2s ease;
        opacity: 0.5;
        border: 1px solid transparent;
        padding: 12px 12px;

        &.active {
          opacity: 1;
          background-color: #edf5fd;
        }

        &.completed {
          opacity: 0.4;
          padding: 4px 12px;
        }

        &.failed {
          opacity: 1;
          background-color: #fff5f5;
          border-color: #fecaca;
        }

        .requirement-info {
          display: flex;
          gap: 10px;
          flex: 1;
          align-items: center;

          .token-icon {
            transition: all 0.2s ease;
          }

          .requirement-text {
            display: flex;
            flex-direction: column;
            flex-wrap: wrap;
            align-items: baseline;
            font-size: 14px;
            transition: all 0.2s ease;

            .requirement-text-content {
              display: flex;
              gap: 4px;
            }

            .action-type {
              font-weight: 600;
              color: #000;
            }

            .amount {
              font-weight: 600;
              color: #000;
            }

            .token-symbol {
              font-weight: 600;
              color: #000;
            }

            .chain-name {
              color: #666;
              font-size: 13px;
            }
          }
        }

        .status-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #4caf50;
          color: #fff;
          border-radius: 50%;
          flex-shrink: 0;
          transition: all 0.2s ease;

          svg {
            width: 14px;
            height: 14px;
          }

          &.failed-badge {
            background: #ef4444;
          }
        }
      }
    }
  }

  .bottom {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 16px;

    button {
      width: 100%;
      background: rgb(43, 156, 255);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;

      &:disabled {
        background: #e0e0e0;
        color: #999;
        cursor: not-allowed;
      }

      &:hover:not(:disabled) {
        background: rgb(35, 135, 220);
      }

      &.retry-button {
        background: #ef4444;

        &:hover {
          background: #dc2626;
        }
      }
    }
  }
}

.panel:focus {
  outline: none;
}
</style>
