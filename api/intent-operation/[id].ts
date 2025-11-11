import {
	buildEndpoints,
	createApiKeyMissingResponse,
	createMethodNotAllowedResponse,
	createProxyErrorResponse,
	getApiKey,
	handleCorsPreflight,
	proxyRequest,
} from "../utils.js";

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
			const endpoints = buildEndpoints(`/intent-operation/${id}`, null);

			// Proxy the request
			return await proxyRequest({
				endpoints,
				method: "GET",
				apiKey,
				methods,
				shouldRetry: (response) => {
					// If 404, try next endpoint
					if (response.status === 404) {
						return true;
					}
					// For other responses (including success), return immediately
					return false;
				},
			});
		} catch (error) {
			return createProxyErrorResponse(error, methods);
		}
	},
};
