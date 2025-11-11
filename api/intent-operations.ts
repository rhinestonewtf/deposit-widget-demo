import {
	buildEndpoints,
	createApiKeyMissingResponse,
	createMethodNotAllowedResponse,
	createProxyErrorResponse,
	detectEnvironmentFromChainIds,
	getApiKey,
	handleCorsPreflight,
	proxyRequest,
} from "./utils.js";

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
			const chainIds = extractChainIdsFromSignedIntentOp(bodyJson);
			const env = detectEnvironmentFromChainIds(chainIds);

			// Build endpoints based on detected environment
			const endpoints = buildEndpoints("/intent-operations", env);

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
