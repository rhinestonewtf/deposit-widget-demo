import type { Address } from "viem";

interface Token {
	chain: string;
	address: Address;
	amount: bigint;
}

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

export type { Token, TokenRequirement };
export type { IntentOp } from "./permit2";
