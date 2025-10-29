<template>
  <div class="panel">
    <div class="top">
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
            <img
              v-if="
                getTokenSymbol(requirement.chain, requirement.address) &&
                getTokenIcon(
                  getTokenSymbol(requirement.chain, requirement.address) || ''
                )
              "
              :src="
                getTokenIcon(
                  getTokenSymbol(requirement.chain, requirement.address) || ''
                )
              "
              :alt="
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
import { chainRegistry } from "@rhinestone/shared-configs";
import {
  http,
  type Address,
  type Chain,
  type Hex,
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  maxUint256,
} from "viem";
import * as chains from "viem/chains";
import { onMounted, ref } from "vue";
import ethIcon from "/icons/eth.svg?url";
import usdcIcon from "/icons/usdc.svg?url";
import IconCheck from "../icon/IconCheck.vue";
import IconX from "../icon/IconX.vue";
import type { IntentOp, TokenRequirement } from "./common";
import { getTypedData } from "./permit2";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    callback: (...args: unknown[]) => void
  ) => void;
}

const emit = defineEmits<{
  next: [signature: Hex];
  retry: [];
}>();

const { requirements, intentOp } = defineProps<{
  requirements: TokenRequirement[];
  intentOp: IntentOp;
}>();

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

function getTokenIcon(symbol: string): string {
  const iconMap: Record<string, string> = {
    ETH: ethIcon,
    WETH: ethIcon,
    USDC: usdcIcon,
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

function getChainName(chainId: string): string {
  const chainIdNum = Number(chainId);
  const chainList = Object.values(chains) as Chain[];
  const chain = chainList.find((c) => c.id === chainIdNum);
  return chain?.name || `Chain ${chainId}`;
}

async function switchChain(
  walletClient: ReturnType<typeof createWalletClient>,
  chain: Chain
): Promise<void> {
  try {
    await walletClient.switchChain({ id: chain.id });
  } catch (error: unknown) {
    // If the chain hasn't been added to the wallet, add it
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ChainNotConfiguredError"
    ) {
      try {
        await walletClient.addChain({ chain });
      } catch (addError) {
        throw new Error(
          `Failed to add chain ${chain.name}: ${
            addError instanceof Error ? addError.message : "Unknown error"
          }`
        );
      }
    } else {
      throw new Error(
        `Failed to switch chain: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
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
    if (!window.ethereum) {
      console.error("Please install a Web3 wallet");
      return false;
    }

    const chainIdNum = Number(requirement.chain);
    const chainList = Object.values(chains) as Chain[];
    const chain = chainList.find((c) => c.id === chainIdNum);

    if (!chain) {
      console.error(`Unsupported chain: ${requirement.chain}`);
      return false;
    }

    const walletClient = createWalletClient({
      chain,
      transport: custom(window.ethereum as unknown as EthereumProvider),
    });

    const [account] = await walletClient.requestAddresses();

    if (!account) {
      console.error("No account found");
      return false;
    }

    // Switch to the required chain
    await switchChain(walletClient, chain);

    if (requirement.type === "wrap") {
      // Handle WETH-style wrap (deposit native token)
      const hash = await walletClient.writeContract({
        account,
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

      // Wait for transaction confirmation
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      return true;
    }

    if (requirement.type === "approval") {
      // Handle ERC20 approval
      const hash = await walletClient.writeContract({
        account,
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

      // Wait for transaction confirmation
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      return true;
    }

    return false;
  } catch (error) {
    console.error("Action failed:", error);
    return false;
  }
}

async function handleSigning(): Promise<boolean> {
  try {
    if (!window.ethereum) {
      console.error("Please install a Web3 wallet");
      return false;
    }

    // Sign the first element in the intentOp
    const element = intentOp.elements[0];
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

    const walletClient = createWalletClient({
      chain,
      transport: custom(window.ethereum as unknown as EthereumProvider),
    });

    const [account] = await walletClient.requestAddresses();

    if (!account) {
      console.error("No account found");
      return false;
    }

    // Switch to the required chain
    await switchChain(walletClient, chain);

    // Generate typed data for this element
    const typedData = getTypedData(
      element,
      BigInt(intentOp.nonce),
      BigInt(intentOp.expires)
    );

    // Sign the typed data
    const sig = await walletClient.signTypedData({
      account,
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
  emit("next", signature.value);
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
    gap: 16px;
    flex: 1;
    overflow-y: auto;

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
        padding: 8px 12px;

        &.active {
          opacity: 1;
          background-color: #edf5fd;
        }

        &.completed {
          opacity: 0.4;
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
            width: 24px;
            height: 24px;
            border-radius: 50%;
            flex-shrink: 0;
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
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 18px;
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
