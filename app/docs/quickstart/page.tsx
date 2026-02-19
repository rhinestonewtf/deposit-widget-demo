import {
  CodeBlock,
  Lead,
  Mono,
  P,
  PageIndex,
  PageTitle,
  Subheading,
} from "../_components/DocsPrimitives";

export default function DocsQuickstartPage() {
  return (
    <article>
      <PageIndex>02</PageIndex>
      <PageTitle>Quickstart</PageTitle>

      <Lead>
        Minimal integration for both deposit and withdraw using the Reown export
        from <Mono>@rhinestone/deposit-modal</Mono>.
      </Lead>

      <Subheading>1) Install + styles</Subheading>
      <CodeBlock lang="bash">{`bun add @rhinestone/deposit-modal`}</CodeBlock>
      <CodeBlock lang="tsx">{`import "@rhinestone/deposit-modal/styles.css";`}</CodeBlock>

      <Subheading>2) Deposit</Subheading>
      <CodeBlock lang="tsx">{`import { DepositModal } from "@rhinestone/deposit-modal/reown";

<DepositModal
  isOpen={isDepositOpen}
  onClose={() => setDepositOpen(false)}
  reownAppId={process.env.NEXT_PUBLIC_REOWN_PROJECT_ID!}
  targetChain={8453}
  targetToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  recipient="0xYourRecipient"
  onDepositComplete={(data) => console.log("deposit complete", data)}
  onDepositFailed={(data) => console.log("deposit failed", data)}
/>`}</CodeBlock>

      <Subheading>3) Withdraw</Subheading>
      <CodeBlock lang="tsx">{`import { WithdrawModal } from "@rhinestone/deposit-modal/reown";

<WithdrawModal
  isOpen={isWithdrawOpen}
  onClose={() => setWithdrawOpen(false)}
  reownAppId={process.env.NEXT_PUBLIC_REOWN_PROJECT_ID!}
  safeAddress="0xYourSafe"
  sourceChain={8453}
  sourceToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  targetChain={42161}
  targetToken="0xaf88d065e77c8cC2239327C5EDb3A432268e5831" // USDC on Arbitrum
  recipient="0xYourRecipient"
  onWithdrawComplete={(data) => console.log("withdraw complete", data)}
  onWithdrawFailed={(data) => console.log("withdraw failed", data)}
/>`}</CodeBlock>

      <Subheading>4) Embedded wallet / host-managed owner</Subheading>
      <P>
        If your app already manages wallet auth, pass
        <Mono> dappAddress </Mono> to skip wallet connect in the modal and keep
        using the same deposit/withdraw flow.
      </P>
      <CodeBlock lang="tsx">{`<DepositModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  dappAddress={embeddedOwnerAddress}
  targetChain={8453}
  targetToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  recipient="0xYourRecipient"
/>`}</CodeBlock>

      <Subheading>5) Runtime behavior</Subheading>
      <P>
        The modal calls backend endpoints for account setup/registration,
        processing, and status. The processing step polls
        <Mono> GET /status/:address?txHash=... </Mono> with backoff and resolves
        on <Mono>bridge-complete</Mono> (or earlier on
        <Mono>bridge-started</Mono> if <Mono>waitForFinalTx</Mono> is false).
      </P>
    </article>
  );
}
