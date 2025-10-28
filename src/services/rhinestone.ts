import type { Address, Chain, Hex } from "viem";
import type { IntentOp } from "../components/widget/permit2";

interface IntentOptions {
	topupCompact: boolean;
	feeToken?: Address;
	sponsorSettings?: {
		gasSponsored: boolean;
		bridgeFeesSponsored: boolean;
		swapFeesSponsored: boolean;
	};
	settlementLayers?: string[];
}

interface IntentInput {
	account: Account;
	destinationChainId: number;
	destinationExecutions: Execution[];
	destinationGasUnits?: bigint;
	tokenTransfers: {
		tokenAddress: Address;
		amount?: bigint;
	}[];
	// recipient?: Account;
	// accountAccessList?: AccountAccessList;
	options: IntentOptions;
}

interface Account {
	address: Address;
	accountType: AccountType;
	setupOps: Pick<Execution, "to" | "data">[];
}

interface Execution {
	to: Address;
	value: string;
	data: Hex;
}

interface Intent {
	intentOp: IntentOp;
	intentCost: IntentCost;
	tokenRequirements: Record<string, Record<Address, TokenRequirement>>;
}

type TokenRequirement =
	| {
			type: "approval";
			amount: string;
			spender: Address;
	  }
	| {
			type: "wrap";
			amount: string;
	  };

interface IntentCost {
	hasFulfilledAll: boolean;
	tokensReceived: [
		{
			tokenAddress: Address;
			hasFulfilled: boolean;
			amountSpent: string;
			destinationAmount: string;
			fee: string;
		},
	];
	sponsoredFee: {
		relayer: number;
		protocol: number;
	};
	tokensSpent: {
		[chainId: string]: {
			[tokenAddress: Address]: {
				locked: string;
				unlocked: string;
				version: number;
			};
		};
	};
}

type AccountType = "GENERIC" | "ERC7579" | "EOA";

class Service {
	private readonly baseUrl = "https://dev.v1.orchestrator.rhinestone.dev";
	private readonly apiKey;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async getQuote(
		account: Address,
		chain: Chain,
		token: Address,
		amount: bigint,
	): Promise<Intent> {
		const intentInput: IntentInput = {
			account: {
				address: account,
				accountType: "EOA",
				setupOps: [],
			},
			destinationChainId: chain.id,
			destinationExecutions: [],
			tokenTransfers: [{ tokenAddress: token, amount }],
			options: {
				topupCompact: false,
			},
		};
		const response = await fetch(`${this.baseUrl}/intents/route`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
			},
			body: JSON.stringify(intentInput, (_, value) =>
				typeof value === "bigint" ? value.toString() : value,
			),
		});
		return response.json();
	}
}

export default Service;
