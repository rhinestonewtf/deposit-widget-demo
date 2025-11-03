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

function extractChainIdFromIntentOpStatus(body: unknown): number | null {
	try {
		const status = body as {
			destinationChainId?: number | string;
		};

		if (status?.destinationChainId) {
			const chainId =
				typeof status.destinationChainId === "string"
					? Number.parseInt(status.destinationChainId, 10)
					: status.destinationChainId;
			if (!Number.isNaN(chainId)) return chainId;
		}
	} catch {
		// Ignore parsing errors
	}
	return null;
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
			// Extract id from URL path parameter
			const url = new URL(request.url);
			const pathParts = url.pathname.split("/").filter(Boolean);
			// Get the last part of the path as the id
			const id = pathParts[pathParts.length - 1];

			if (!id) {
				return new Response(
					JSON.stringify({ error: "Missing id path parameter" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Try both endpoints since we can't detect env from GET request params
			const endpoints = [
				`https://v1.orchestrator.rhinestone.dev/intent-operation/${id}`,
				`https://staging.v1.orchestrator.rhinestone.dev/intent-operation/${id}`,
			];

			let lastError: Error | null = null;
			let lastResponse: Response | null = null;

			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: "GET",
						headers: {
							"Content-Type": "application/json",
							"x-api-key": apiKey,
						},
					});

					// If successful (200-299), return immediately
					if (response.status >= 200 && response.status < 300) {
						const data = await response.text();
						// Try to detect environment from response for future requests
						try {
							const responseJson = JSON.parse(data);
							const chainId = extractChainIdFromIntentOpStatus(responseJson);
							// Environment detection is informational only for GET requests
						} catch {
							// Ignore parsing errors
						}

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

					// If 404, try next endpoint
					if (response.status === 404) {
						lastResponse = response;
						continue;
					}

					// For other errors, return immediately
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

			// If we got here, both endpoints returned 404
			if (lastResponse) {
				const data = await lastResponse.text();
				return new Response(data, {
					status: lastResponse.status,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, OPTIONS",
						"Access-Control-Allow-Headers": "Content-Type",
					},
				});
			}

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
