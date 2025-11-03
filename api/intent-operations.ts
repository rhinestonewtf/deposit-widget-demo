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

function extractChainIdsFromSignedIntentOp(body: unknown): number[] {
	const chainIds: number[] = [];
	try {
		const payload = body as {
			signedIntentOp?: {
				elements?: Array<{
					chainId?: string | number;
					mandate?: {
						destinationChainId?: string | number;
					};
				}>;
			};
		};

		if (payload?.signedIntentOp?.elements) {
			for (const element of payload.signedIntentOp.elements) {
				if (element.chainId) {
					const chainId =
						typeof element.chainId === "string"
							? Number.parseInt(element.chainId, 10)
							: element.chainId;
					if (!Number.isNaN(chainId)) chainIds.push(chainId);
				}
				if (element.mandate?.destinationChainId) {
					const chainId =
						typeof element.mandate.destinationChainId === "string"
							? Number.parseInt(element.mandate.destinationChainId, 10)
							: element.mandate.destinationChainId;
					if (!Number.isNaN(chainId)) chainIds.push(chainId);
				}
			}
		}
	} catch {
		// Ignore parsing errors
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
					"Access-Control-Allow-Methods": "POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
		}

		// Only allow POST requests
		if (request.method !== "POST") {
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
			// Get the request body
			const bodyText = await request.text();
			const bodyJson = JSON.parse(bodyText);

			// Extract chain IDs from the request
			const chainIds = extractChainIdsFromSignedIntentOp(bodyJson);
			const env = detectEnvironmentFromChainIds(chainIds);

			// Try endpoints based on detected environment
			const endpoints: string[] = [];
			if (env === "prod") {
				endpoints.push(
					"https://v1.orchestrator.rhinestone.dev/intent-operations",
				);
			} else if (env === "staging") {
				endpoints.push(
					"https://staging.v1.orchestrator.rhinestone.dev/intent-operations",
				);
			} else {
				// Try both if can't detect
				endpoints.push(
					"https://v1.orchestrator.rhinestone.dev/intent-operations",
					"https://staging.v1.orchestrator.rhinestone.dev/intent-operations",
				);
			}

			let lastError: Error | null = null;
			for (const endpoint of endpoints) {
				try {
					const response = await fetch(endpoint, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"x-api-key": apiKey,
						},
						body: bodyText,
					});

					// If successful or not found (404), return the response
					if (
						response.status !== 500 &&
						response.status !== 502 &&
						response.status !== 503
					) {
						const data = await response.text();
						return new Response(data, {
							status: response.status,
							headers: {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*",
								"Access-Control-Allow-Methods": "POST, OPTIONS",
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
							"Access-Control-Allow-Methods": "POST, OPTIONS",
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
