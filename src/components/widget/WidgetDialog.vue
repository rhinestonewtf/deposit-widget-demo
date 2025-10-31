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
          <div class="header">
            <button
              v-if="step.type === 'requirements'"
              class="back-button"
              @click="handleBack"
              aria-label="Go back"
            >
              <IconCaretLeft />
            </button>
            <div v-else class="header-spacer"></div>
            <div class="header-title">{{ headerTitle }}</div>
            <Dialog.Close as-child>
              <button class="close-button" aria-label="Close">
                <IconX />
              </button>
            </Dialog.Close>
          </div>
          <WidgetDialogQuote
            v-if="step.type === 'quote'"
            :token="token"
            :chain="chain"
            :user-address="account"
            :recipient="recipient"
            @next="handleQuoteNext"
          />
          <WidgetDialogTokens
            v-if="step.type === 'requirements'"
            :requirements="step.requirements"
            :intent-op="step.intentOp"
            :output-token="step.outputToken"
            :user-address="account"
            :recipient="recipient"
            :input-chain="step.inputChain"
            :input-token="step.inputToken"
            @next="handleRequirementsNext"
            @retry="handleRetry"
          />
          <WidgetDialogSubmit
            v-if="step.type === 'deposit'"
            :signature="step.signature"
            :intent-op="step.intentOp"
            :user-address="account"
            :recipient="recipient"
            @next="handleSubmitNext"
          />
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</template>

<script setup lang="ts">
import { VisuallyHidden } from "reka-ui";
import { Dialog } from "reka-ui/namespaced";
import type { Address, Chain, Hex } from "viem";
import { computed, ref } from "vue";
import IconCaretLeft from "../icon/IconCaretLeft.vue";
import IconX from "../icon/IconX.vue";
import WidgetDialogQuote from "./WidgetDialogQuote.vue";
import WidgetDialogTokens from "./WidgetDialogRequirements.vue";
import WidgetDialogSubmit from "./WidgetDialogSubmit.vue";
import type { IntentOp, Token, TokenRequirement } from "./common";

type Step =
  | {
      type: "quote";
    }
  | {
      type: "requirements";
      requirements: TokenRequirement[];
      intentOp: IntentOp;
      outputToken: Token;
      inputChain?: Chain | null;
      inputToken?: Address | null;
    }
  | {
      type: "deposit";
      intentOp: IntentOp;
      signature: Hex;
    };

const open = defineModel<boolean>("open", {
  required: true,
});

const step = ref<Step>({ type: "quote" });
const { token, chain, account, recipient } = defineProps<{
  token: Address;
  chain: Chain;
  account: Address;
  recipient: Address;
}>();

const headerTitle = computed(() => {
  switch (step.value.type) {
    case "quote":
      return "Deposit";
    case "requirements":
      return "Deposit";
    case "deposit":
      return "Deposit";
    default:
      return "Deposit";
  }
});

function handleOpen(value: boolean): void {
  if (!value) {
    open.value = false;
    resetState();
  }
}

function handleBack(): void {
  step.value = { type: "quote" };
}

function handleQuoteNext(
  requirements: TokenRequirement[],
  intentOp: IntentOp,
  outputToken: Token,
  inputChain?: Chain | null,
  inputToken?: Address | null
): void {
  step.value = {
    type: "requirements",
    requirements,
    intentOp,
    outputToken,
    inputChain,
    inputToken,
  };
}

function handleRequirementsNext(intentOp: IntentOp, signature: Hex): void {
  if (step.value.type === "requirements") {
    step.value = {
      type: "deposit",
      intentOp,
      signature,
    };
  }
}

function handleRetry(): void {
  step.value = { type: "quote" };
}

function handleSubmitNext(): void {
  open.value = false;
  resetState();
}

function resetState(): void {
  step.value = { type: "quote" };
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  position: relative;
  background-color: #fff;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #ebebeb;
}

.header-spacer {
  width: 32px;
  height: 32px;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #000;
}

.back-button,
.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgb(0 0 0 / 10%);
  background-color: transparent;
  color: rgb(0 0 0 / 60%);
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
  padding: 8px;

  svg {
    width: 20px;
    height: 20px;
  }
}

.back-button:hover,
.close-button:hover {
  border-color: rgb(0 0 0 / 20%);
  color: rgb(0 0 0 / 80%);
}

.back-button:active,
.close-button:active {
  transform: scale(0.95);
}
</style>
