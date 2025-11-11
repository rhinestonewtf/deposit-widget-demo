import type { HeadersInit } from "undici-types";

// Testnet chain IDs
export const TESTNET_CHAIN_IDS = new Set([
	11155111, // sepolia
	421614, // arbitrumSepolia
	84532, // baseSepolia
	11155420, // optimismSepolia
]);

export function isTestnetChain(chainId: number): boolean {
	return TESTNET_CHAIN_IDS.has(chainId);
}

export function detectEnvironmentFromChainIds(
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

// Base URLs
export const PROD_BASE_URL = "https://v1.orchestrator.rhinestone.dev";
export const STAGING_BASE_URL =
	"https://staging.v1.orchestrator.rhinestone.dev";

// CORS headers
export function getCorsHeaders(methods = "GET, POST, OPTIONS"): HeadersInit {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": methods,
		"Access-Control-Allow-Headers": "Content-Type",
	};
}

// API key validation
export function getApiKey(): string | null {
	return process.env.RHINESTONE_API_KEY || null;
}

// Error responses
export function createErrorResponse(
	error: string,
	status = 500,
	methods = "GET, POST, OPTIONS",
): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: {
			"Content-Type": "application/json",
			...getCorsHeaders(methods),
		},
	});
}

export function createMethodNotAllowedResponse(
	allowedMethod: "GET" | "POST",
): Response {
	return createErrorResponse("Method not allowed", 405, allowedMethod);
}

export function createApiKeyMissingResponse(methods: string): Response {
	return createErrorResponse("API key not configured", 500, methods);
}

export function createProxyErrorResponse(
	error: unknown,
	methods: string,
): Response {
	return new Response(
		JSON.stringify({
			error: "Failed to proxy request",
			details: error instanceof Error ? error.message : "Unknown error",
		}),
		{
			status: 500,
			headers: {
				"Content-Type": "application/json",
				...getCorsHeaders(methods),
			},
		},
	);
}

// CORS preflight handler
export function handleCorsPreflight(methods = "GET, POST, OPTIONS"): Response {
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(methods),
	});
}

// Build endpoint URLs
export function buildEndpoints(
	path: string,
	env: "prod" | "staging" | null,
): string[] {
	if (env === "prod") {
		return [`${PROD_BASE_URL}${path}`];
	}
	if (env === "staging") {
		return [`${STAGING_BASE_URL}${path}`];
	}
	// Try both if can't detect
	return [`${PROD_BASE_URL}${path}`, `${STAGING_BASE_URL}${path}`];
}

// Proxy response handler
export function createProxyResponse(
	data: string,
	status: number,
	methods: string,
): Response {
	return new Response(data, {
		status,
		headers: {
			"Content-Type": "application/json",
			...getCorsHeaders(methods),
		},
	});
}

// Generic proxy function
export interface ProxyOptions {
	endpoints: string[];
	method: "GET" | "POST";
	apiKey: string;
	body?: string;
	methods: string;
	shouldRetry?: (response: Response) => boolean;
}

export async function proxyRequest(options: ProxyOptions): Promise<Response> {
	const { endpoints, method, apiKey, body, methods, shouldRetry } = options;

	let lastError: Error | null = null;
	let lastResponse: Response | null = null;

	for (const endpoint of endpoints) {
		try {
			console.log(
				`[${new Date().toISOString()}] [api] proxyRequest: ${endpoint}`,
			);
			const response = await fetch(endpoint, {
				method,
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				...(body && { body }),
			});
			console.log(
				`[${new Date().toISOString()}] [api] proxyResponse ${endpoint}`,
			);

			// Check if we should retry with next endpoint
			if (shouldRetry?.(response)) {
				lastResponse = response;
				continue;
			}

			// Return the response
			const data = await response.text();
			return createProxyResponse(data, response.status, methods);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (endpoints.indexOf(endpoint) === endpoints.length - 1) {
				// Last endpoint, throw error
				throw lastError;
			}
			// Try next endpoint
		}
	}

	// If we got here and have a last response, return it
	if (lastResponse) {
		const data = await lastResponse.text();
		return createProxyResponse(data, lastResponse.status, methods);
	}

	throw lastError || new Error("Failed to proxy request");
}
