import type { Address } from "viem";

type TokenRequirement =
	| {
			chain: string;
			address: Address;
			type: "approval";
			amount: bigint;
			spender: Address;
	  }
	| {
			chain: string;
			address: Address;
			type: "wrap";
			amount: bigint;
	  };

export type { TokenRequirement };
export type { IntentOp, IntentOpElement } from "./permit2";
