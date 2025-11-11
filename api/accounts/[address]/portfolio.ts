import {
	buildEndpoints,
	createApiKeyMissingResponse,
	createMethodNotAllowedResponse,
	createProxyErrorResponse,
	detectEnvironmentFromChainIds,
	generateRequestId,
	getApiKey,
	handleCorsPreflight,
	proxyRequest,
} from "../../utils.js";

export const maxDuration = 60;

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
		const methods = "GET, OPTIONS";

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return handleCorsPreflight(methods);
		}

		// Only allow GET requests
		if (request.method !== "GET") {
			return createMethodNotAllowedResponse("GET");
		}

		// Get API key from environment variable
		const apiKey = getApiKey();
		if (!apiKey) {
			return createApiKeyMissingResponse(methods);
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

			// Build the target path with query parameters
			const targetPath = `/accounts/${address}/portfolio`;
			const targetUrl = new URL(url.origin + targetPath);
			for (const [key, value] of url.searchParams.entries()) {
				targetUrl.searchParams.set(key, value);
			}

			// Build endpoints based on detected environment
			const baseEndpoints = buildEndpoints(targetPath, env);
			const endpoints = baseEndpoints.map((baseUrl) => {
				const endpointUrl = new URL(baseUrl);
				for (const [key, value] of url.searchParams.entries()) {
					endpointUrl.searchParams.set(key, value);
				}
				return endpointUrl.toString();
			});

			// Generate request ID for logging
			const requestId = generateRequestId();

			// Proxy the request
			return await proxyRequest({
				endpoints,
				method: "GET",
				apiKey,
				methods,
				requestId,
				shouldRetry: (response) => {
					// Retry on server errors (500+) if we have multiple endpoints
					// Otherwise return successful responses (200-299) or 404
					return (
						endpoints.length > 1 &&
						response.status >= 500 &&
						response.status < 600
					);
				},
			});
		} catch (error) {
			return createProxyErrorResponse(error, methods);
		}
	},
};
