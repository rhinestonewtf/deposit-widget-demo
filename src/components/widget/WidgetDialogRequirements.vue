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
import { switchChain, writeContract } from "@wagmi/core";
import {
  type Address,
  type Chain,
  type Hex,
  erc20Abi,
  formatUnits,
  parseEther,
  parseUnits,
} from "viem";
import { generatePrivateKey } from "viem/accounts";
import { onMounted, ref } from "vue";
import { wagmiConfig } from "../../config/appkit";
import TokenIcon from "../TokenIcon.vue";
import { createAccount, getSignerAccount } from "./account";
import type { IntentOp, Token } from "./common";
import { getChain, getChainName, getToken } from "./registry";

const signerPk = useStorage<Hex>(
  "rhinestone:temporary-signer-key",
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

/**
 * Transfers tokens to the companion account with a 10% buffer for gas
 */
async function transferTokensToAccount(
  companionAccountAddress: Address,
  tokens: Token[],
  isAccountDeployed: boolean
): Promise<void> {
  for (const token of tokens) {
    // Switch to the required chain
    await switchChain(wagmiConfig, { chainId: Number(token.chain) });
    // Add a 5% buffer (to account for price fluctuations)
    const priceImpactBuffer = token.amount / 20n;
    const tokenEntry = getToken(token.chain, token.address);
    // Add a fixed buffer to account for deployment costs
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
    // Make the transfer
    await writeContract(wagmiConfig, {
      address: token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [companionAccountAddress, tokenAmount],
    });
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
 */
async function executeDirectTransfer(): Promise<void> {
  const chain = getChain(outputToken.chain);
  if (!chain) {
    throw new Error(`Unsupported chain: ${outputToken.chain}`);
  }

  // Switch to the required chain
  await switchChain(wagmiConfig, { chainId: Number(outputToken.chain) });

  // Execute the transfer
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
}

/**
 * Executes the full deposit flow: create account, transfer tokens, prepare and sign transaction
 */
async function executeDepositFlow(): Promise<void> {
  // Check if this is a same-chain transfer by verifying all tokens spent are on the same chain as the output
  const isSameChain = tokensSpent.every(
    (token) => token.chain === outputToken.chain
  );

  if (isSameChain) {
    // Execute direct transfer for same-chain deposits
    await executeDirectTransfer();
    return;
  }

  // Spin up a smart account
  const companionAccount = await createAccount(userAddress, signerPk.value);

  const outputChain = getChain(outputToken.chain);
  if (!outputChain) {
    throw new Error(`Unsupported chain: ${outputToken.chain}`);
  }
  const isDeployed = await companionAccount.isDeployed(outputChain);

  // Send the tokens spent to the smart account (+ 10% buffer for gas)
  await transferTokensToAccount(
    companionAccount.getAddress(),
    tokensSpent,
    isDeployed
  );

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
}

// Start auto-execution when component mounts
onMounted(async () => {
  await executeDepositFlow();
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

function handleRetry(): void {
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
