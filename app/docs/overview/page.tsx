import { Callout, Lead, Mono, P, PageIndex, PageTitle, Subheading } from "../_components/DocsPrimitives";

export default function DocsOverviewPage() {
  return (
    <article>
      <PageIndex>01</PageIndex>
      <PageTitle>Overview</PageTitle>

      <Lead>
        <Mono>@rhinestone/deposit-modal</Mono> provides a production flow for
        deposit and withdraw into a Rhinestone smart account, with backend
        orchestration for bridging and status tracking.
      </Lead>

      <P>
        User can either connect an EOA wallet directly or your app can pass an
        owner address (<Mono>dappAddress</Mono>) from an embedded/auth-managed
        wallet. The modal then creates or reuses a browser session owner key,
        sets up a deterministic smart account, enables sessions, and routes the
        transfer lifecycle through backend + processor.
      </P>

      <Subheading>What this docs section covers</Subheading>
      <P>
        1. Quickstart integration for both deposit and withdraw.
      </P>
      <P>
        2. End-to-end architecture after the user transfer: backend validation,
        dedupe, processor intent execution, webhook storage, and status polling.
      </P>
      <P>
        3. Failure/stuck handling paths: processor retries, failure events,
        modal timeout, and retry behavior.
      </P>

      <Callout>
        Flow summary: wallet owner to local browser signer to smart account +
        session authorization to user transfer to backend/processor orchestration
        to webhook events to modal polling.
      </Callout>
    </article>
  );
}
