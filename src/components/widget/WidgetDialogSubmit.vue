<template>
  <div class="panel">
    <div class="top">
      <div class="header">Deposit</div>
      <div class="status-section">
        <div class="status-title">Submitting transaction...</div>
        <div class="status-description">
          Filling your transaction on the blockchain.
        </div>

        <!-- Status details -->
        <div class="status-details">
          <div class="status-row">
            <span class="status-label">Fill status</span>
            <span class="status-value" :class="statusClass">{{
              displayStatus
            }}</span>
          </div>

          <!-- Source and Destination info -->
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Source</span>
              <div class="info-value">
                <span class="wallet-text">{{ shortAddress }}</span>
              </div>
            </div>
            <div class="info-row">
              <span class="info-label">Destination</span>
              <div class="info-value">
                <span class="wallet-text">Smart Account</span>
              </div>
            </div>
          </div>

          <!-- Amount info -->
          <div class="amount-section">
            <span class="amount-label">You deposit</span>
            <div class="amount-value">
              <img
                v-if="destinationTokenSymbol"
                :src="getTokenIcon(destinationTokenSymbol)"
                :alt="destinationTokenSymbol"
                class="token-icon"
              />
              <span class="amount-text"
                >{{ displayAmount }} {{ destinationTokenSymbol }}</span
              >
            </div>
          </div>

          <!-- Error message -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>
        </div>
      </div>
    </div>
    <div class="bottom">
      <button @click="handleComplete" :disabled="!isCompleted">Complete</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { chainRegistry } from "@rhinestone/shared-configs";
import type { Address, Hex } from "viem";
import { formatUnits } from "viem";
import { computed, onMounted, onUnmounted, ref } from "vue";
import RhinestoneService, {
  type IntentStatus,
  type SignedIntentOp,
} from "../../services/rhinestone";
import type { IntentOp } from "./common";

const apiKey = import.meta.env.VITE_PUBLIC_RHINESTONE_API_KEY;
if (!apiKey) {
  throw new Error("VITE_PUBLIC_RHINESTONE_API_KEY is not set");
}
const rhinestoneService = new RhinestoneService(apiKey);

const emit = defineEmits<{
  next: [];
}>();

const { signatures, intentOp, userAddress } = defineProps<{
  signatures: Hex[];
  intentOp: IntentOp;
  userAddress: string;
}>();

const intentId = ref<bigint | null>(null);
const status = ref<IntentStatus>("PENDING");
const error = ref<string | null>(null);
const pollingInterval = ref<number | null>(null);
const fillTransactionHash = ref<Hex | undefined>(undefined);

const isCompleted = computed(() => {
  return (
    status.value === "FILLED" ||
    status.value === "FAILED" ||
    status.value === "EXPIRED"
  );
});

const displayStatus = computed(() => {
  return status.value;
});

const statusClass = computed(() => {
  const s = status.value;
  if (s === "FILLED") return "status-success";
  if (s === "FAILED" || s === "EXPIRED") return "status-error";
  if (s === "PRECONFIRMED") return "status-preconfirmed";
  return "status-pending";
});

const shortAddress = computed(() => {
  return `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
});

const destinationTokenAddress = computed<Address | null>(() => {
  if (!intentOp.elements || intentOp.elements.length === 0) {
    return null;
  }
  const element = intentOp.elements[0];
  if (!element) return null;
  const tokenOut = element.mandate.tokenOut;
  if (!tokenOut) {
    return null;
  }
  const firstToken = tokenOut[0];
  if (!firstToken) return null;
  const tokenId = BigInt(firstToken[0]);
  return toToken(tokenId);
});

const destinationTokenAmount = computed<bigint | null>(() => {
  if (!intentOp.elements || intentOp.elements.length === 0) {
    return null;
  }
  const element = intentOp.elements[0];
  if (!element) return null;
  const tokenOut = element.mandate.tokenOut;
  if (!tokenOut) {
    return null;
  }
  const firstToken = tokenOut[0];
  if (!firstToken) return null;
  return BigInt(firstToken[1]);
});

const destinationChainId = computed<string | null>(() => {
  if (!intentOp.elements || intentOp.elements.length === 0) {
    return null;
  }
  const element = intentOp.elements[0];
  if (!element) return null;
  return element.mandate.destinationChainId;
});

const destinationTokenSymbol = computed<string | null>(() => {
  if (!destinationChainId.value || !destinationTokenAddress.value) {
    return null;
  }
  return getTokenSymbol(
    destinationChainId.value,
    destinationTokenAddress.value
  );
});

const displayAmount = computed(() => {
  if (
    !destinationChainId.value ||
    !destinationTokenAddress.value ||
    !destinationTokenAmount.value
  ) {
    return "0";
  }
  return formatTokenAmount(
    destinationChainId.value,
    destinationTokenAddress.value,
    destinationTokenAmount.value
  );
});

async function submitIntent(): Promise<void> {
  if (signatures.length === 0) {
    throw new Error("No signatures provided");
  }

  // Construct SignedIntentOp from intentOp and signatures
  // For single element intents, use the same signature for both origin and destination
  // For multi-element intents, use all but last for origin, and last for destination
  const lastSignature = signatures[signatures.length - 1];
  if (!lastSignature) {
    throw new Error("Invalid signature array");
  }

  const originSignatures =
    signatures.length > 1 ? signatures.slice(0, -1) : signatures;
  const signedIntentOp = createSignedIntentOp(
    intentOp,
    originSignatures,
    lastSignature
  );

  const response = await rhinestoneService.submitIntent(signedIntentOp);
  console.log(response);
  intentId.value = BigInt(response.result.id);
  startPolling();
}

function createSignedIntentOp(
  intentOp: IntentOp,
  originSignatures: Hex[],
  destinationSignature: Hex
): SignedIntentOp {
  return {
    ...intentOp,
    originSignatures,
    destinationSignature,
  };
}

async function checkStatus(): Promise<void> {
  if (!intentId.value) return;

  try {
    const response = await rhinestoneService.getIntentStatus(intentId.value);
    status.value = response.status;
    fillTransactionHash.value = response.fillTransactionHash;

    // Stop polling if we reached a final state
    if (isCompleted.value) {
      stopPolling();
    }
  } catch (err) {
    console.error("Failed to check intent status:", err);
  }
}

function startPolling(): void {
  // Poll every 2 seconds
  pollingInterval.value = window.setInterval(() => {
    checkStatus();
  }, 2000);
}

function stopPolling(): void {
  if (pollingInterval.value !== null) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }
}

function handleComplete(): void {
  emit("next");
}

function toToken(id: bigint): Address {
  return `0x${(id & ((1n << 160n) - 1n)).toString(16).padStart(40, "0")}`;
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

onMounted(() => {
  submitIntent();
});

onUnmounted(() => {
  stopPolling();
});
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

    .status-section {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .status-title {
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        color: #000;
      }

      .status-description {
        font-size: 13px;
        text-align: center;
        color: #666;
      }

      .status-details {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        background-color: #fafafa;
        border-radius: 8px;
        border: 1px solid #e0e0e0;

        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid #e0e0e0;

          .status-label {
            font-size: 14px;
            color: #666;
          }

          .status-value {
            font-size: 14px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;

            &.status-pending {
              color: #666;
              background-color: #f0f0f0;
            }

            &.status-preconfirmed {
              color: #ff9800;
              background-color: #fff3e0;
            }

            &.status-success {
              color: #4caf50;
              background-color: #e8f5e9;
            }

            &.status-error {
              color: #f44336;
              background-color: #ffebee;
            }
          }
        }

        .info-section {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .info-label {
              font-size: 13px;
              color: #666;
            }

            .info-value {
              display: flex;
              align-items: center;
              gap: 6px;

              .wallet-text {
                font-size: 13px;
                font-weight: 500;
                color: #000;
              }
            }
          }
        }

        .amount-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #e0e0e0;

          .amount-label {
            font-size: 13px;
            color: #666;
          }

          .amount-value {
            display: flex;
            align-items: center;
            gap: 6px;

            .token-icon {
              width: 20px;
              height: 20px;
              border-radius: 50%;
            }

            .amount-text {
              font-size: 14px;
              font-weight: 600;
              color: #000;
            }
          }
        }

        .error-message {
          padding: 8px;
          background-color: #ffebee;
          border-radius: 4px;
          color: #f44336;
          font-size: 13px;
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
