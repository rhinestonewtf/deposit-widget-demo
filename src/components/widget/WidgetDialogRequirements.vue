<template>
  <div class="panel">
    <div class="top">
      <div class="header">Deposit</div>

      <div class="requirements">
        <div
          v-for="(requirement, index) in requirements"
          :key="index"
          class="requirement-item"
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
              <div class="requirement-text-top">
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
              <div class="requirement-text-bottom">
                <span class="chain-name"
                  >on {{ getChainName(requirement.chain) }}</span
                >
              </div>
            </div>
          </div>
          <button
            v-if="!completedRequirements.has(index)"
            @click="handleAction(requirement, index)"
            :disabled="processingIndex === index"
            class="action-button"
          >
            {{
              processingIndex === index
                ? "Processing..."
                : requirement.type === "wrap"
                ? "Wrap"
                : "Approve"
            }}
          </button>
          <span v-else class="completed-badge">✓</span>
        </div>

        <!-- Signing requirement -->
        <div class="requirement-item">
          <div class="requirement-info">
            <div class="requirement-text">
              <div class="requirement-text-top">
                <span class="action-type">Sign Intent</span>
              </div>
              <div class="requirement-text-bottom">
                <span class="chain-name">Approve the deposit order</span>
              </div>
            </div>
          </div>
          <button
            v-if="!isSigningCompleted"
            @click="handleSigning"
            :disabled="isSigningProcessing"
            class="action-button"
          >
            {{ isSigningProcessing ? "Signing..." : "Sign" }}
          </button>
          <span v-else class="completed-badge">✓</span>
        </div>
      </div>
    </div>
    <div class="bottom">
      <button @click="handleContinue" :disabled="!allCompleted">
        Continue
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
import { computed, ref } from "vue";
import ethIcon from "/icons/eth.svg?url";
import usdcIcon from "/icons/usdc.svg?url";
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
}>();

const { requirements, intentOp } = defineProps<{
  requirements: TokenRequirement[];
  intentOp: IntentOp;
}>();

const completedRequirements = ref<Set<number>>(new Set());
const processingIndex = ref<number | null>(null);
const isSigningCompleted = ref(false);
const isSigningProcessing = ref(false);
const signature = ref<Hex | null>(null);

const allTokenRequirementsCompleted = computed(() => {
  return completedRequirements.value.size === requirements.length;
});

const allCompleted = computed(() => {
  return allTokenRequirementsCompleted.value && isSigningCompleted.value;
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

async function handleAction(
  requirement: TokenRequirement,
  index: number
): Promise<void> {
  processingIndex.value = index;

  try {
    if (!window.ethereum) {
      console.error("Please install a Web3 wallet");
      return;
    }

    const chainIdNum = Number(requirement.chain);
    const chainList = Object.values(chains) as Chain[];
    const chain = chainList.find((c) => c.id === chainIdNum);

    if (!chain) {
      console.error(`Unsupported chain: ${requirement.chain}`);
      return;
    }

    const walletClient = createWalletClient({
      chain,
      transport: custom(window.ethereum as unknown as EthereumProvider),
    });

    const [account] = await walletClient.requestAddresses();

    if (!account) {
      console.error("No account found");
      return;
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

      completedRequirements.value.add(index);
    } else if (requirement.type === "approval") {
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

      completedRequirements.value.add(index);
    }
  } catch (error) {
    console.error("Action failed:", error);
  } finally {
    processingIndex.value = null;
  }
}

async function handleSigning(): Promise<void> {
  isSigningProcessing.value = true;

  try {
    if (!window.ethereum) {
      console.error("Please install a Web3 wallet");
      return;
    }

    const signatures: Hex[] = [];

    // Sign each element in the intentOp
    for (const element of intentOp.elements) {
      const chainIdNum = Number(element.chainId);
      const chainList = Object.values(chains) as Chain[];
      const chain = chainList.find((c) => c.id === chainIdNum);

      if (!chain) {
        console.error(`Unsupported chain: ${element.chainId}`);
        continue;
      }

      const walletClient = createWalletClient({
        chain,
        transport: custom(window.ethereum as unknown as EthereumProvider),
      });

      const [account] = await walletClient.requestAddresses();

      if (!account) {
        console.error("No account found");
        return;
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
      signatures.push(sig);
    }

    // Store the first signature (or use as needed)
    signature.value = signatures[0] ?? ("0x" as Hex);
    isSigningCompleted.value = true;
  } catch (error) {
    console.error("Signing failed:", error);
  } finally {
    isSigningProcessing.value = false;
  }
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
    flex: 1;
    overflow-y: auto;

    .header {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
    }

    .requirements {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .requirement-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background-color: #fafafa;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        gap: 12px;

        .requirement-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;

          .token-icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .requirement-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 14px;

            .requirement-text-top {
              display: flex;
              align-items: baseline;
              gap: 4px;

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
            }

            .requirement-text-bottom {
              .chain-name {
                color: #666;
                font-size: 13px;
              }
            }
          }
        }

        .action-button {
          background: rgb(43, 156, 255);
          color: #fff;
          border: none;
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;

          &:disabled {
            background: #b0d4f1;
            cursor: not-allowed;
          }

          &:hover:not(:disabled) {
            background: rgb(35, 135, 220);
          }
        }

        .completed-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: #4caf50;
          color: #fff;
          border-radius: 50%;
          font-size: 16px;
          font-weight: 600;
          flex-shrink: 0;
        }
      }
    }
  }

  .bottom {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;

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
    }
  }
}

.panel:focus {
  outline: none;
}
</style>
