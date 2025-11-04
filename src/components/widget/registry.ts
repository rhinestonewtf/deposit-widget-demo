import { chains } from "@rhinestone/shared-configs";
import type { Chain } from "viem";

function getChain(chainId: string): Chain | null {
	return chains.find((c) => c.id.toString() === chainId) || null;
}

function getChainName(chainId: string): string {
	const chain = getChain(chainId);
	return chain?.name || `Chain ${chainId}`;
}

export { getChain, getChainName };
