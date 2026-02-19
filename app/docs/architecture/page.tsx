import {
  Callout,
  Lead,
  Mono,
  NumberedList,
  P,
  PageIndex,
  PageTitle,
  Subheading,
} from "../_components/DocsPrimitives";
import { MermaidDiagram } from "../_components/MermaidDiagram";

const ARCHITECTURE_MERMAID = `flowchart TB
  subgraph Client["Client (deposit-modal / host app)"]
    A1["User connects EOA or host app passes owner address"]
    A2["Create/load local browser session owner key"]
    A3["POST /setup-account to backend"]
    A4{"needsRegistration?"}
    A5["Sign EIP-712 session typed data"]
    A6["POST /register to backend"]
    A7["User transfer to smart account"]
    A8["POST /process/:address with deposit txHash"]
    A9["Poll GET /status/:address?txHash=..."]
    A10{"Terminal event received?"}
    A11["bridge-complete => success"]
    A12["bridge-failed or error => fail state"]
    A13["No terminal event for 10m => timeout UI"]
  end

  subgraph Backend["deposit-widget-backend"]
    B1["Validate transfer (native ETH direct or Safe execTransaction)"]
    B2["Dedupe key: deposit-processed:<chainId>:<txHash>"]
    B3["Proxy /process to deposit-service-processor"]
    B4["Receive processor webhook at POST /notify"]
    B5["Store webhook payload in Redis (tx + last)"]
    B6["Update dedupe state: submitted / processed / failed"]
  end

  subgraph Processor["deposit-service-processor"]
    C1["Dedupe key: deposit-dedupe:<chainId>:<txHash>"]
    C2{"sameChain && sameToken?"}
    C3["Emit deposit-received + bridge-complete (short-circuit)"]
    C4["Emit deposit-received"]
    C5["Enable source/target sessions when needed"]
    C6["Build + submit intent with Rhinestone SDK"]
    C7["waitForExecution => bridge-complete"]
    C8["Retry up to 10 attempts with 1.2^n backoff"]
    C9["Emit bridge-failed (DEP-1/2/3) or error"]
  end

  subgraph Orchestrator["Rhinestone Orchestrator"]
    D1["Route swaps + bridge + settlement"]
    D2["Return execution/claim/fill tx hashes"]
  end

  A3 --> B1
  A4 -- yes --> A5 --> A6
  A4 -- no --> A7
  A6 --> A7
  A7 --> A8
  A8 --> B1
  B1 --> B2 --> B3 --> C1 --> C2
  C2 -- yes --> C3 --> B4
  C2 -- no --> C4 --> C5 --> C6 --> D1 --> D2 --> C7 --> B4
  C6 --> C8
  C8 --> C6
  C8 --> C9 --> B4
  B4 --> B5 --> B6
  B5 --> A9 --> A10
  A10 -- bridge-complete --> A11
  A10 -- bridge-failed or error --> A12
  A10 -- no event yet --> A13`;

export default function DocsArchitecturePage() {
  return (
    <article>
      <PageIndex>03</PageIndex>
      <PageTitle>Architecture</PageTitle>

      <Lead>
        This reflects actual runtime behavior in
        <Mono> deposit-widget-backend </Mono> and
        <Mono> deposit-service-processor </Mono>, including retries,
        short-circuit paths, dedupe keys, and failure semantics.
      </Lead>

      <MermaidDiagram chart={ARCHITECTURE_MERMAID} />

      <Subheading>End-to-end sequence (after transfer)</Subheading>
      <NumberedList
        items={[
          {
            title: "Account + session setup",
            body: "Client calls /setup-account. If registration is needed, it signs session typed data and calls /register.",
          },
          {
            title: "Deposit submission",
            body: "After user transfer, client calls /process/:address with chainId/token/amount/txHash/sender.",
          },
          {
            title: "Backend validation + dedupe",
            body: "Backend validates native ETH transfers via RPC (including Safe forwarding path), acquires dedupe lock, and forwards to processor.",
          },
          {
            title: "Processor execution",
            body: "Processor dedupes again, emits deposit-received, optionally enables sessions, and submits bridging intent through Rhinestone SDK.",
          },
          {
            title: "Webhook + status",
            body: "Processor emits events to backend /notify. Backend stores them in Redis and modal polls /status by txHash until terminal event.",
          },
        ]}
      />

      <Subheading>Failure and stuck-transfer handling</Subheading>
      <P>
        Processor retry loop: bridge submission and enable-session steps retry up
        to 10 attempts with exponential backoff (<Mono>1.2^attempt</Mono>).
      </P>
      <P>
        Processor failure events:
        <Mono> bridge-failed </Mono> is emitted with error codes
        <Mono> DEP-1 </Mono> (insufficient route value),
        <Mono> DEP-2 </Mono> (session/bridge failure), or
        <Mono> DEP-3 </Mono> (missing session details). Unknown exceptions emit
        <Mono> error </Mono>.
      </P>
      <P>
        Backend dedupe state transitions:
        <Mono>{"processing -> submitted -> processed/failed"}</Mono>.
        Failed state uses short retry TTL so the same tx can be retried.
      </P>
      <P>
        Modal behavior: polling uses backoff up to 30s interval. If no terminal
        event is found in 10 minutes, modal enters timeout state and surfaces a
        support message.
      </P>

      <Callout>
        Important edge case: if source and target already match
        (<Mono>{"sameChain && sameToken"}</Mono>), processor short-circuits by
        emitting <Mono>deposit-received</Mono> then
        <Mono>bridge-complete</Mono> without launching a bridge intent.
      </Callout>
    </article>
  );
}
