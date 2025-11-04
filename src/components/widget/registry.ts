import {
	type ChainEntry,
	chainRegistry,
	chains,
} from "@rhinestone/shared-configs";
import type { Address, Chain } from "viem";

function getChain(chainId: string): Chain | null {
	return chains.find((c) => c.id.toString() === chainId) || null;
}

function getChainName(chainId: string): string {
	const chain = getChain(chainId);
	return chain?.name || `Chain ${chainId}`;
}

type TokenEntry = ChainEntry["tokens"][number];

/**
 * Returns TokenEntry from chainRegistry for the specified chainId and address,
 * or null if not found.
 */
function getToken(chainId: string, tokenAddress: Address): TokenEntry | null {
	const chainEntry = chainRegistry[chainId];
	if (!chainEntry) return null;

	const token = chainEntry.tokens.find(
		(t) => t.address.toLowerCase() === tokenAddress.toLowerCase(),
	);

	return token || null;
}

export { getChain, getChainName, getToken };
