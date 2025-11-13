import type { SupportedChain } from "@rhinestone/shared-configs";
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

type SupportedTokenSymbol = "ETH" | "WETH" | "USDC" | "USDT";
type SupportedToken = SupportedTokenSymbol | Address;

type AccountAccessListLegacy = {
	chainId: number;
	tokenAddress: Address;
}[];

type MappedChainTokenAccessList = {
	chainTokens?: {
		[chainId in SupportedChain]?: SupportedToken[];
	};
};

type UnmappedChainTokenAccessList = {
	chainIds?: SupportedChain[];
	tokens?: SupportedToken[];
};

type AccountAccessList =
	| AccountAccessListLegacy
	| MappedChainTokenAccessList
	| UnmappedChainTokenAccessList;

interface IntentInput {
	account: Account;
	destinationChainId: number;
	destinationExecutions: Execution[];
	destinationGasUnits?: bigint;
	tokenRequests: {
		tokenAddress: Address;
		amount?: bigint;
	}[];
	recipient?: Account;
	accountAccessList?: AccountAccessList;
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
	intentOp?: IntentOp;
	intentCost?: IntentCost;
	tokenRequirements?:
		| Record<string, Record<Address, TokenRequirement>>
		| undefined;
	error?: ApiError;
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

interface ApiErrorContext {
	hasFulfilledAll?: boolean;
	tokenShortfall?: Array<{
		tokenAddress: Address;
		destinationAmount: string;
		amountSpent: string;
		fee: string;
		tokenSymbol: string;
		tokenDecimals: number;
	}>;
	sponsorFee?: {
		relayer: number;
		protocol: number;
	};
	totalTokenShortfallInUSD?: number;
	[key: string]: unknown;
}

interface ApiError {
	message: string;
	context?: ApiErrorContext;
}

type AccountType = "GENERIC" | "ERC7579" | "EOA";

type IntentStatus =
	| "PENDING"
	| "PRECONFIRMED"
	| "COMPLETED"
	| "FAILED"
	| "EXPIRED"
	| "FILLED"
	| "PARTIALLY_COMPLETED"
	| "UNKNOWN";

interface Claim {
	claimId: string;
	status: string;
	// Add other claim fields as needed
}

interface IntentOpStatus {
	status: IntentStatus;
	claims: Claim[];
	destinationChainId: number;
	userAddress: Address;
	fillTimestamp?: number;
	fillTransactionHash?: Hex;
}

interface IntentResult {
	result: {
		id: string;
		status: IntentStatus;
	};
}

type SignedIntentOp = IntentOp & {
	originSignatures: Hex[];
	destinationSignature: Hex;
};

interface PortfolioResponse {
	tokenName: string;
	tokenDecimals: number;
	balance: {
		locked: string;
		unlocked: string;
	};
	tokenChainBalance: {
		isAccountDeployed: boolean;
		chainId: number;
		tokenAddress: Address;
		balance: {
			locked: string;
			unlocked: string;
		};
	}[];
}

interface Portfolio {
	symbol: string;
	decimals: number;
	balances: {
		locked: bigint;
		unlocked: bigint;
	};
	chains: {
		isAccountDeployed: boolean;
		chain: number;
		address: Address;
		locked: bigint;
		unlocked: bigint;
	}[];
}

class Service {
	private readonly baseUrl: string;

	constructor() {
		// Use local proxy endpoints (Vercel Functions)
		// In production, this will be the deployed URL
		// In development, it will be localhost
		const appBaseUrl = import.meta.env.VITE_PUBLIC_APP_BASE_URL;
		if (!appBaseUrl) {
			throw new Error("VITE_PUBLIC_APP_BASE_URL is not set");
		}
		this.baseUrl = `${appBaseUrl}/api`;
	}

	async getQuote(
		account: Address,
		chain: Chain,
		token: Address,
		amount: bigint,
		recipient: Address,
		inputChain?: Chain,
		inputToken?: Address,
	): Promise<Intent> {
		const intentInput: IntentInput = {
			account: {
				address: account,
				accountType: "EOA",
				setupOps: [],
			},
			recipient: {
				address: recipient,
				accountType: "EOA",
				setupOps: [],
			},
			destinationChainId: chain.id,
			destinationExecutions: [],
			tokenRequests: [{ tokenAddress: token, amount }],
			options: {
				topupCompact: false,
			},
		};

		// If custom input chain and token are provided, add them to accountAccessList
		if (inputChain && inputToken) {
			intentInput.accountAccessList = {
				chainTokens: {
					[inputChain.id as SupportedChain]: [inputToken],
				},
			};
		}

		const response = await fetch(`${this.baseUrl}/intents/route`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(intentInput, (_, value) =>
				typeof value === "bigint" ? value.toString() : value,
			),
		});
		const data = await response.json();

		// Check if the response contains errors
		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			return {
				error: data.errors[0], // Return the first error for now
			};
		}

		return data;
	}

	async submitIntent(
		signedIntentOp: SignedIntentOp,
		dryRun = false,
	): Promise<IntentResult> {
		const payload: Record<string, unknown> = {
			signedIntentOp,
		};
		if (dryRun) {
			(
				payload.signedIntentOp as SignedIntentOp & { options?: unknown }
			).options = {
				dryRun: true,
			};
		}
		const response = await fetch(`${this.baseUrl}/intent-operations`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload, (_, value) =>
				typeof value === "bigint" ? value.toString() : value,
			),
		});
		const result = await response.json();
		return result;
	}

	async getIntentStatus(intentId: bigint): Promise<IntentOpStatus> {
		const response = await fetch(
			`${this.baseUrl}/intent-operation/${intentId.toString()}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
		return response.json();
	}

	async getPortfolio(
		userAddress: Address,
		filter?: {
			chainIds?: number[];
			tokens?: {
				[chainId: number]: Address[];
			};
		},
	): Promise<Portfolio[]> {
		const params = new URLSearchParams();
		if (filter?.chainIds) {
			params.set("chainIds", filter.chainIds.join(","));
		}
		if (filter?.tokens) {
			params.set(
				"tokens",
				Object.entries(filter.tokens)
					.flatMap(([chainId, tokens]) =>
						tokens.map((token) => `${chainId}:${token}`),
					)
					.join(","),
			);
		}
		const url = new URL(`${this.baseUrl}/accounts/${userAddress}/portfolio`);
		url.search = params.toString();
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});
		const json = await response.json();
		const portfolioResponse = json.portfolio as PortfolioResponse[];
		const portfolio: Portfolio[] = portfolioResponse.map((tokenResponse) => ({
			symbol: tokenResponse.tokenName,
			decimals: tokenResponse.tokenDecimals,
			balances: {
				locked: BigInt(tokenResponse.balance.locked),
				unlocked: BigInt(tokenResponse.balance.unlocked),
			},
			chains: tokenResponse.tokenChainBalance.map((chainBalance) => ({
				isAccountDeployed: chainBalance.isAccountDeployed,
				chain: chainBalance.chainId,
				address: chainBalance.tokenAddress,
				locked: BigInt(chainBalance.balance.locked),
				unlocked: BigInt(chainBalance.balance.unlocked),
			})),
		}));

		return portfolio;
	}
}

export type {
	IntentStatus,
	IntentOpStatus,
	IntentResult,
	SignedIntentOp,
	Claim,
	Portfolio,
	ApiError,
	ApiErrorContext,
};
export default Service;
