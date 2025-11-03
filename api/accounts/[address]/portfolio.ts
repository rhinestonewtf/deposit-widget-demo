// Testnet chain IDs
const TESTNET_CHAIN_IDS = new Set([
	11155111, // sepolia
	421614, // arbitrumSepolia
	84532, // baseSepolia
	11155420, // optimismSepolia
]);

function isTestnetChain(chainId: number): boolean {
	return TESTNET_CHAIN_IDS.has(chainId);
}

function detectEnvironmentFromChainIds(
	chainIds: number[],
): "prod" | "staging" | null {
	if (chainIds.length === 0) return null;

	const hasTestnet = chainIds.some((id) => isTestnetChain(id));
	const hasMainnet = chainIds.some((id) => !isTestnetChain(id));

	// If only testnet chains, use staging
	if (hasTestnet && !hasMainnet) return "staging";
	// If only mainnet chains, use prod
	if (hasMainnet && !hasTestnet) return "prod";
	// Mixed or unknown chains - return null to try both
	return null;
}

function extractChainIdsFromQueryParams(url: URL): number[] {
	const chainIds: number[] = [];

	// Extract chainIds from query param
	const chainIdsParam = url.searchParams.get("chainIds");
	if (chainIdsParam) {
		for (const chainIdStr of chainIdsParam.split(",")) {
			const chainId = Number.parseInt(chainIdStr.trim(), 10);
			if (!Number.isNaN(chainId)) chainIds.push(chainId);
		}
	}

	// Extract chain IDs from tokens query param (format: "chainId:tokenAddress")
	const tokensParam = url.searchParams.get("tokens");
	if (tokensParam) {
		for (const tokenEntry of tokensParam.split(",")) {
			const [chainIdStr] = tokenEntry.split(":");
			if (chainIdStr) {
				const chainId = Number.parseInt(chainIdStr.trim(), 10);
				if (!Number.isNaN(chainId)) chainIds.push(chainId);
			}
		}
	}

	return chainIds;
}

export default {
	async fetch(request: Request) {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
		}

		// Only allow GET requests
		if (request.method !== "GET") {
			return new Response(JSON.stringify({ error: "Method not allowed" }), {
				status: 405,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get API key from environment variable
		const apiKey = process.env.RHINESTONE_API_KEY;
		if (!apiKey) {
			return new Response(JSON.stringify({ error: "API key not configured" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		try {
			// Extract address from URL path
			const url = new URL(request.url);
			const pathParts = url.pathname.split("/");
			const addressIndex = pathParts.indexOf("accounts") + 1;
			const address = pathParts[addressIndex];

			if (!address) {
				return new Response(
					JSON.stringify({ error: "Missing address parameter" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Extract chain IDs from query parameters
			const chainIds = extractChainIdsFromQueryParams(url);
			const env = detectEnvironmentFromChainIds(chainIds);

			// Determine base URL
			const baseUrl =
				env === "staging"
					? "https://staging.v1.orchestrator.rhinestone.dev"
					: "https://v1.orchestrator.rhinestone.dev";

			// Build the target URL with the address in the path
			const targetUrl = new URL(`${baseUrl}/accounts/${address}/portfolio`);

			// Copy all query parameters
			for (const [key, value] of url.searchParams.entries()) {
				targetUrl.searchParams.set(key, value);
			}

			// Try endpoints based on detected environment
			const endpoints: string[] = [];
			if (env === "prod") {
				endpoints.push(targetUrl.toString());
			} else if (env === "staging") {
				endpoints.push(targetUrl.toString());
			} else {
				// Try both if can't detect
				const prodUrl = new URL(
					`https://v1.orchestrator.rhinestone.dev/accounts/${address}/portfolio`,
				);
				const stagingUrl = new URL(
					`https://staging.v1.orchestrator.rhinestone.dev/accounts/${address}/portfolio`,
				);
				// Copy query params to both
				for (const [key, value] of url.searchParams.entries()) {
					prodUrl.searchParams.set(key, value);
					stagingUrl.searchParams.set(key, value);
				}
				endpoints.push(prodUrl.toString(), stagingUrl.toString());
			}

			let lastError: Error | null = null;
			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: "GET",
						headers: {
							"Content-Type": "application/json",
							"x-api-key": apiKey,
						},
					});

					// If successful (200-299) or not found (404), return the response
					if (
						response.status === 404 ||
						(response.status >= 200 && response.status < 300)
					) {
						const data = await response.text();
						return new Response(data, {
							status: response.status,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
								"Access-Control-Allow-Methods": "GET, OPTIONS",
								"Access-Control-Allow-Headers": "Content-Type",
							},
						});
					}

					// If server error, try next endpoint
					if (endpoints.length > 1) {
						lastError = new Error(`Server error from ${endpoint}`);
						continue;
					}

					// If only one endpoint, return error
					const data = await response.text();
					return new Response(data, {
						status: response.status,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "GET, OPTIONS",
							"Access-Control-Allow-Headers": "Content-Type",
						},
					});
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));
					if (endpoints.indexOf(endpoint) === endpoints.length - 1) {
						// Last endpoint, throw error
						throw lastError;
					}
					// Try next endpoint
				}
			}

			// Should not reach here, but handle just in case
			throw lastError || new Error("Failed to proxy request");
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: "Failed to proxy request",
					details: error instanceof Error ? error.message : "Unknown error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	},
};
