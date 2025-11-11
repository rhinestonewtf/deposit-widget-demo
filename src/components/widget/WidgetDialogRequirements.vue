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
            active: getRequirementStep(index) === currentStep,
            completed: completedRequirements.has(index),
            failed: failedStep === getRequirementStep(index),
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
                <span class="action-type">{{ requirement.action }}</span>
                <span class="amount">{{
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
            v-else-if="failedStep === getRequirementStep(index)"
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
import type { RhinestoneAccount } from "@rhinestone/sdk";
import { chainRegistry } from "@rhinestone/shared-configs";
import { useStorage } from "@vueuse/core";
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import {
  http,
  type Address,
  type Chain,
  type Hex,
  createPublicClient,
  erc20Abi,
  formatUnits,
  parseEther,
  parseUnits,
  size,
} from "viem";
import { generatePrivateKey } from "viem/accounts";
import { computed, onMounted, ref } from "vue";
import { wagmiConfig } from "../../config/appkit";
import TokenIcon from "../TokenIcon.vue";
import IconCheck from "../icon/IconCheck.vue";
import IconX from "../icon/IconX.vue";
import { createAccount, getSignerAccount } from "./account";
import type { IntentOp, Token } from "./common";
import { getChain, getChainName, getToken } from "./registry";

interface Requirement {
  chain: string;
  address: Address;
  amount: bigint;
  action: string;
  transferTo?: Address; // For cross-chain transfers to companion account
}

const signerPk = useStorage<Hex>(
  "rhinestone.temporarySignerKey",
  generatePrivateKey()
);

const emit = defineEmits<{
  next: [
    data:
      | {
          kind: "intent";
          intentOp: IntentOp;
          signatures: { originSignatures: Hex[]; destinationSignature: Hex };
        }
      | {
          kind: "transaction";
          transactionHash: Hex;
          outputToken: Token;
        }
  ];
  retry: [];
}>();

const {
  tokensSpent,
  outputToken,
  userAddress,
  recipient,
  inputChain,
  inputToken,
} = defineProps<{
  tokensSpent: Token[];
  intentOp: IntentOp;
  outputToken: Token;
  userAddress: Address;
  recipient: Address;
  inputChain?: Chain | null;
  inputToken?: Address | null;
}>();

const failedStep = ref<number | null>(null);
const currentStep = ref<number>(0);
const completedRequirements = ref<Set<number>>(new Set());
const companionAccountAddress = ref<Address | null>(null);

// Compute requirements based on whether it's same-chain or cross-chain
const requirements = computed<Requirement[]>(() => {
  const isSameChain = tokensSpent.every(
    (token) => token.chain === outputToken.chain
  );

  if (isSameChain) {
    // For same-chain, show just the transfer action
    return [
      {
        chain: outputToken.chain,
        address: outputToken.address,
        amount: outputToken.amount,
        action: "Transfer",
      },
    ];
  }

  // For cross-chain, show token transfers to companion account
  return tokensSpent.map((token) => ({
    chain: token.chain,
    address: token.address,
    amount: token.amount,
    action: "Transfer",
  }));
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Transfers a single token to the companion account with buffer for gas
 * Returns true if successful, false if user rejected
 */
async function transferTokenToAccount(
  token: Token,
  companionAccountAddress: Address
): Promise<boolean> {
  try {
    // Switch to the required chain
    await switchChain(wagmiConfig, { chainId: Number(token.chain) });

    // Add a 5% buffer (to account for price fluctuations)
    const priceImpactBuffer = token.amount / 20n;
    const tokenEntry = getToken(token.chain, token.address);

    // Add a fixed buffer to account for deployment costs
    const chain = getChain(token.chain);
    if (!chain) {
      throw new Error(`Unsupported chain: ${token.chain}`);
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    const accountCode = await publicClient.getCode({
      address: companionAccountAddress,
    });
    const isAccountDeployed = accountCode && size(accountCode) > 0;
    const deploymentBuffer = isAccountDeployed
      ? 0n
      : tokenEntry?.symbol === "USDC"
      ? parseUnits("0.1", 6)
      : tokenEntry?.symbol === "WETH"
      ? parseEther("0.00005")
      : tokenEntry?.symbol === "ETH"
      ? parseEther("0.00005")
      : 0n;
    const tokenAmount = token.amount + priceImpactBuffer + deploymentBuffer;

    // Check the existing token balance of the companion account
    const existingBalance = await readContract(wagmiConfig, {
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [companionAccountAddress],
    });

    const transferAmount =
      existingBalance > tokenAmount ? 0n : tokenAmount - existingBalance;

    if (transferAmount > 0n) {
      // Make the transfer - this can throw if user rejects
      const transferHash = await writeContract(wagmiConfig, {
        address: token.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [companionAccountAddress, transferAmount],
      });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: transferHash,
        chainId: chain.id,
      });

      // Wait for a few seconds for the balance to be indexed
      await sleep(5 * 1000);
    }

    return true;
  } catch (error) {
    console.error("Token transfer failed:", error);
    // Check if it's a user rejection (usually has "rejected" or "user rejected" in message)
    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    if (
      errorMessage.includes("rejected") ||
      errorMessage.includes("user rejected") ||
      errorMessage.includes("denied")
    ) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Prepares transaction data for the companion account
 */
async function prepareTransactionData(companionAccount: RhinestoneAccount) {
  const chain = getChain(outputToken.chain);
  if (!chain) {
    throw new Error(`Unsupported chain: ${outputToken.chain}`);
  }

  const signerAccount = getSignerAccount(signerPk.value);

  return await companionAccount.prepareTransaction({
    sourceAssets:
      inputChain && inputToken
        ? {
            [inputChain.id]: [inputToken],
          }
        : inputToken
        ? [inputToken]
        : undefined,
    sourceChains: inputChain ? [inputChain] : undefined,
    targetChain: chain,
    calls: [],
    tokenRequests: [
      {
        address: outputToken.address,
        amount: outputToken.amount,
      },
    ],
    recipient: {
      address: recipient,
      accountType: "EOA",
      setupOps: [],
    },
    signers: {
      type: "owner",
      kind: "ecdsa",
      accounts: [signerAccount],
    },
  });
}

/**
 * Executes a direct ERC20 transfer for same-chain deposits
 * Returns true if successful, false if user rejected
 */
async function executeDirectTransfer(): Promise<boolean> {
  try {
    const chain = getChain(outputToken.chain);
    if (!chain) {
      throw new Error(`Unsupported chain: ${outputToken.chain}`);
    }

    // Switch to the required chain
    await switchChain(wagmiConfig, { chainId: Number(outputToken.chain) });

    // Execute the transfer - this can throw if user rejects
    const hash = await writeContract(wagmiConfig, {
      address: outputToken.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, outputToken.amount],
    });

    // Emit the transaction hash
    emit("next", {
      kind: "transaction",
      transactionHash: hash,
      outputToken: outputToken,
    });

    return true;
  } catch (error) {
    console.error("Direct transfer failed:", error);
    // Check if it's a user rejection
    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    if (
      errorMessage.includes("rejected") ||
      errorMessage.includes("user rejected") ||
      errorMessage.includes("denied")
    ) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Executes the next step in the deposit flow
 */
async function executeNextStep(): Promise<void> {
  // Check if this is a same-chain transfer
  const isSameChain = tokensSpent.every(
    (token) => token.chain === outputToken.chain
  );

  if (isSameChain) {
    // For same-chain, execute the single transfer step
    if (currentStep.value === 0) {
      const success = await executeDirectTransfer();
      if (success) {
        completedRequirements.value.add(0);
        // Flow completed, emit already happened in executeDirectTransfer
      } else {
        failedStep.value = 0;
      }
    }
    return;
  }

  // For cross-chain deposits
  if (currentStep.value === 0) {
    // First step: create companion account
    try {
      const companionAccount = await createAccount(userAddress, signerPk.value);
      companionAccountAddress.value = companionAccount.getAddress();
      currentStep.value++;
      await executeNextStep();
    } catch (error) {
      console.error("Failed to create companion account:", error);
      failedStep.value = 0;
    }
    return;
  }

  // Transfer tokens step by step
  const tokenIndex = currentStep.value - 1;
  if (tokenIndex < tokensSpent.length && companionAccountAddress.value) {
    const token = tokensSpent[tokenIndex];
    if (!token) {
      console.error(`No token found at index ${tokenIndex}`);
      failedStep.value = currentStep.value;
      return;
    }

    const success = await transferTokenToAccount(
      token,
      companionAccountAddress.value
    );

    if (success) {
      // Map currentStep to requirement index (for cross-chain, requirement index = currentStep - 1)
      const requirementIndex = tokenIndex;
      completedRequirements.value.add(requirementIndex);
      currentStep.value++;

      // Check if all tokens have been transferred
      if (currentStep.value > tokensSpent.length) {
        // All transfers complete, now prepare and sign transaction
        await completeCrossChainDeposit();
      } else {
        // Continue to next token transfer
        await executeNextStep();
      }
    } else {
      // User rejected the transfer
      failedStep.value = currentStep.value;
    }
  }
}

/**
 * Completes the cross-chain deposit after all tokens are transferred
 */
async function completeCrossChainDeposit(): Promise<void> {
  try {
    if (!companionAccountAddress.value) {
      throw new Error("Companion account not created");
    }

    const companionAccount = await createAccount(userAddress, signerPk.value);
    const outputChain = getChain(outputToken.chain);
    if (!outputChain) {
      throw new Error(`Unsupported chain: ${outputToken.chain}`);
    }

    // Request a quote from the smart account
    const transactionData = await prepareTransactionData(companionAccount);

    // Sign the transaction
    const signedTransactionData = await companionAccount.signTransaction(
      transactionData
    );

    // Emit the signed data
    emit("next", {
      kind: "intent",
      intentOp: signedTransactionData.intentRoute.intentOp,
      signatures: {
        originSignatures: signedTransactionData.originSignatures,
        destinationSignature: signedTransactionData.destinationSignature,
      },
    });
  } catch (error) {
    console.error("Failed to complete cross-chain deposit:", error);
    // Mark the last step as failed
    failedStep.value = currentStep.value - 1;
  }
}

// Start auto-execution when component mounts
onMounted(async () => {
  await executeNextStep();
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

/**
 * Maps requirement index to the actual step number
 * For same-chain: requirement index = step index
 * For cross-chain: requirement index = step index - 1 (since step 0 is account creation)
 */
function getRequirementStep(requirementIndex: number): number {
  const isSameChain = tokensSpent.every(
    (token) => token.chain === outputToken.chain
  );

  if (isSameChain) {
    return requirementIndex;
  }

  // For cross-chain, step 0 is account creation, so requirement index 0 = step 1
  return requirementIndex + 1;
}

function handleRetry(): void {
  // Emit retry event to go back to quote step
  emit("retry");
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
