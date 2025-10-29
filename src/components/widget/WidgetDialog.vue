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
            @next="handleRequirementsNext"
          />
          <WidgetDialogSubmit
            v-if="step.type === 'deposit'"
            :signatures="step.signatures"
            :intent-op="step.intentOp"
            :user-address="account"
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
import { ref } from "vue";
import WidgetDialogQuote from "./WidgetDialogQuote.vue";
import WidgetDialogTokens from "./WidgetDialogRequirements.vue";
import WidgetDialogSubmit from "./WidgetDialogSubmit.vue";
import type { IntentOp, TokenRequirement } from "./common";

type Step =
  | {
      type: "quote";
    }
  | {
      type: "requirements";
      requirements: TokenRequirement[];
      intentOp: IntentOp;
    }
  | {
      type: "signing";
      requirements: TokenRequirement[];
      intentOp: IntentOp;
      signatures: Hex[];
    }
  | {
      type: "deposit";
      intentOp: IntentOp;
      signatures: Hex[];
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

function handleOpen(value: boolean): void {
  if (!value) {
    open.value = false;
  }
}

function handleQuoteNext(
  requirements: TokenRequirement[],
  intentOp: IntentOp
): void {
  step.value = { type: "requirements", requirements, intentOp };
}

function handleRequirementsNext(signatures: Hex[]): void {
  if (step.value.type === "requirements") {
    step.value = {
      type: "deposit",
      intentOp: step.value.intentOp,
      signatures,
    };
  }
}

function handleSubmitNext(): void {
  open.value = false;
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
</style>
