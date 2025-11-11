import {
	buildEndpoints,
	createApiKeyMissingResponse,
	createMethodNotAllowedResponse,
	createProxyErrorResponse,
	detectEnvironmentFromChainIds,
	getApiKey,
	handleCorsPreflight,
	proxyRequest,
} from "../utils.js";

export const maxDuration = 60;

function extractChainIdsFromIntentInput(body: unknown): number[] {
	const chainIds: number[] = [];
	try {
		const intentInput = body as {
			destinationChainId?: number | string;
			accountAccessList?: {
				chainIds?: number[];
				chainTokens?: Record<string, unknown>;
			};
		};

		// Extract destinationChainId
		if (intentInput.destinationChainId) {
			const chainId =
				typeof intentInput.destinationChainId === "string"
					? Number.parseInt(intentInput.destinationChainId, 10)
					: intentInput.destinationChainId;
			if (!Number.isNaN(chainId)) chainIds.push(chainId);
		}

		// Extract chainIds from accountAccessList
		if (intentInput.accountAccessList?.chainIds) {
			chainIds.push(...intentInput.accountAccessList.chainIds);
		}

		// Extract chain IDs from chainTokens object keys
		if (intentInput.accountAccessList?.chainTokens) {
			for (const chainIdStr of Object.keys(
				intentInput.accountAccessList.chainTokens,
			)) {
				const chainId = Number.parseInt(chainIdStr, 10);
				if (!Number.isNaN(chainId)) chainIds.push(chainId);
			}
		}
	} catch {
		// Ignore parsing errors
	}
	return chainIds;
}

export default {
	async fetch(request: Request) {
		const methods = "POST, OPTIONS";

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return handleCorsPreflight(methods);
		}

		// Only allow POST requests
		if (request.method !== "POST") {
			return createMethodNotAllowedResponse("POST");
		}

		// Get API key from environment variable
		const apiKey = getApiKey();
		if (!apiKey) {
			return createApiKeyMissingResponse(methods);
		}

		try {
			// Get the request body
			const bodyText = await request.text();
			const bodyJson = JSON.parse(bodyText);

			// Extract chain IDs from the request
			const chainIds = extractChainIdsFromIntentInput(bodyJson);
			const env = detectEnvironmentFromChainIds(chainIds);

			// Build endpoints based on detected environment
			const endpoints = buildEndpoints("/intents/route", env);

			// Proxy the request
			return await proxyRequest({
				endpoints,
				method: "POST",
				apiKey,
				body: bodyText,
				methods,
				shouldRetry: (response) => {
					// Retry on server errors (500, 502, 503) if we have multiple endpoints
					return (
						endpoints.length > 1 &&
						(response.status === 500 ||
							response.status === 502 ||
							response.status === 503)
					);
				},
			});
		} catch (error) {
			return createProxyErrorResponse(error, methods);
		}
	},
};
