import { type Address, type Hex, keccak256 } from "viem";

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

interface TokenPermissions {
	token: Address;
	amount: bigint;
}

interface Execution {
	to: Address;
	value: string;
	data: Hex;
}

interface IntentOpElementMandate {
	recipient: Address;
	tokenOut: [[string, string]];
	destinationChainId: string;
	fillDeadline: string;
	destinationOps: Execution[];
	preClaimOps: Execution[];
	qualifier: {
		settlementContext: {
			settlementLayer: string;
			usingJIT: boolean;
			using7579: boolean;
		};
		encodedVal: string;
	};
	v: number;
	minGas: string;
}

export interface IntentOpElement {
	arbiter: Address;
	chainId: string;
	idsAndAmounts: [[string, string]];
	spendTokens: [[string, string]];
	beforeFill: boolean;
	smartAccountStatus: {
		accountType: string;
		isDeployed: boolean;
		isERC7579: boolean;
		erc7579AccountType: string;
		erc7579AccountVersion: string;
	};
	mandate: IntentOpElementMandate;
}

export interface IntentOp {
	sponsor: Address;
	nonce: string;
	expires: string;
	elements: IntentOpElement[];
	serverSignature: string;
	signedMetadata: Record<string, unknown>;
}

function toToken(id: bigint): Address {
	return `0x${(id & ((1n << 160n) - 1n)).toString(16).padStart(40, "0")}`;
}

export function getTypedData(
	element: IntentOpElement,
	nonce: bigint,
	expires: bigint,
) {
	const tokens = element.idsAndAmounts.map(
		([id, amount]) => [BigInt(id), BigInt(amount)] as const,
	);
	const tokenPermissions = tokens.reduce<TokenPermissions[]>(
		(permissions, [id, amountIn]) => {
			const token = toToken(id);
			const amount = amountIn;
			const permission: TokenPermissions = { token, amount };
			permissions.push(permission);
			return permissions;
		},
		[],
	);
	const spender = element.arbiter;
	const mandate = element.mandate;

	// Pre-process ops to ensure proper typing
	const originOps = mandate.preClaimOps.map((op) => ({
		to: op.to as Address,
		value: BigInt(op.value),
		data: op.data as Hex,
	}));

	const destOps = mandate.destinationOps.map((op) => ({
		to: op.to as Address,
		value: BigInt(op.value),
		data: op.data as Hex,
	}));

	const typedData = {
		domain: {
			name: "Permit2",
			chainId: Number(element.chainId),
			verifyingContract: PERMIT2_ADDRESS as Hex,
		},
		types: {
			TokenPermissions: [
				{ name: "token", type: "address" },
				{ name: "amount", type: "uint256" },
			],
			Token: [
				{ name: "token", type: "address" },
				{ name: "amount", type: "uint256" },
			],
			Target: [
				{ name: "recipient", type: "address" },
				{ name: "tokenOut", type: "Token[]" },
				{ name: "targetChain", type: "uint256" },
				{ name: "fillExpiry", type: "uint256" },
			],
			Op: [
				{ name: "to", type: "address" },
				{ name: "value", type: "uint256" },
				{ name: "data", type: "bytes" },
			],
			Mandate: [
				{ name: "target", type: "Target" },
				{ name: "v", type: "uint8" },
				{ name: "minGas", type: "uint128" },
				{ name: "originOps", type: "Op[]" },
				{ name: "destOps", type: "Op[]" },
				{ name: "q", type: "bytes32" },
			],
			PermitBatchWitnessTransferFrom: [
				{ name: "permitted", type: "TokenPermissions[]" },
				{ name: "spender", type: "address" },
				{ name: "nonce", type: "uint256" },
				{ name: "deadline", type: "uint256" },
				{ name: "mandate", type: "Mandate" },
			],
		},
		primaryType: "PermitBatchWitnessTransferFrom" as const,
		message: {
			permitted: tokenPermissions,
			spender: spender,
			nonce: nonce,
			deadline: expires,
			mandate: {
				target: {
					recipient: mandate.recipient,
					tokenOut: mandate.tokenOut.map((token) => ({
						token: toToken(BigInt(token[0])),
						amount: BigInt(token[1]),
					})),
					targetChain: BigInt(mandate.destinationChainId),
					fillExpiry: BigInt(mandate.fillDeadline),
				},
				v: mandate.v || 0,
				minGas: BigInt(mandate.minGas || "0"),
				originOps,
				destOps,
				q: keccak256(mandate.qualifier.encodedVal as Hex),
			},
		},
	};

	return typedData;
}
