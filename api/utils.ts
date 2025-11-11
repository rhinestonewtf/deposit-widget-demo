import type { Dispatcher } from "undici";
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

// Fetch wrapper with timing instrumentation
export interface FetchTimingResult {
	ttfbMs: number;
	totalMs: number;
	status: number;
	body: string;
}

export interface FetchWrapperOptions {
	url: string;
	init?: RequestInit;
	timeoutMs?: number;
	dispatcher?: Dispatcher;
}

export async function fetchWithTiming(
	options: FetchWrapperOptions,
): Promise<FetchTimingResult> {
	const { url, init = {}, timeoutMs = 30000, dispatcher } = options;
	const t0 = performance.now();

	// Create AbortController for overall timeout
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, timeoutMs);

	try {
		// Merge abort signal
		const signal = abortController.signal;
		const mergedInit: RequestInit = {
			...init,
			signal,
		};

		// Add dispatcher for Node runtime (Undici)
		if (dispatcher && typeof globalThis.fetch !== "undefined") {
			// @ts-expect-error - dispatcher is a Node.js/Undici feature
			mergedInit.dispatcher = dispatcher;
		}

		// Make the request
		const response = await fetch(url, mergedInit);
		const ttfbMs = performance.now() - t0;

		// Read the body
		const body = await response.text();
		const totalMs = performance.now() - t0;

		clearTimeout(timeoutId);

		return {
			ttfbMs: Math.round(ttfbMs * 100) / 100,
			totalMs: Math.round(totalMs * 100) / 100,
			status: response.status,
			body,
		};
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			const elapsedMs = performance.now() - t0;
			throw new Error(
				`Request timeout after ${Math.round(elapsedMs)}ms: ${url}`,
			);
		}
		throw error;
	}
}

// Create Undici dispatcher with explicit timeouts (for Node runtime)
export async function createUndiciDispatcher(): Promise<
	Dispatcher | undefined
> {
	try {
		// Dynamic import to avoid issues in Bun/Edge runtimes
		const { Agent } = await import("undici");
		return new Agent({
			connect: {
				timeout: 3000, // 3s connection timeout
			},
			headersTimeout: 10000, // 10s headers timeout
			bodyTimeout: 20000, // 20s body timeout
			keepAliveTimeout: 4000,
		});
	} catch {
		return undefined;
	}
}

// Generate request ID
export function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Generic proxy function
export interface ProxyOptions {
	endpoints: string[];
	method: "GET" | "POST";
	apiKey: string;
	body?: string;
	methods: string;
	shouldRetry?: (response: Response) => boolean;
	maxRetries?: number;
	requestId?: string;
}

export async function proxyRequest(options: ProxyOptions): Promise<Response> {
	const {
		endpoints,
		method,
		apiKey,
		body,
		methods,
		shouldRetry,
		maxRetries = 2,
		requestId = generateRequestId(),
	} = options;

	// Create dispatcher for Node runtime (will be undefined in Bun/Edge)
	const dispatcher = await createUndiciDispatcher();

	const isIdempotent = method === "GET";
	const totalAttempts = endpoints.length * (isIdempotent ? maxRetries + 1 : 1);
	let attemptNumber = 0;
	let lastError: Error | null = null;
	let lastResponse: Response | null = null;

	// Try each endpoint with retries
	for (const endpoint of endpoints) {
		for (let retry = 0; retry <= (isIdempotent ? maxRetries : 0); retry++) {
			attemptNumber++;
			const attemptStart = performance.now();

			try {
				// Log attempt start
				console.log(
					JSON.stringify({
						type: "proxy_attempt_start",
						requestId,
						endpoint,
						attempt: attemptNumber,
						retry,
						method,
						timestamp: new Date().toISOString(),
					}),
				);

				// Make request with timing
				const result = await fetchWithTiming({
					url: endpoint,
					init: {
						method,
						headers: {
							"Content-Type": "application/json",
							"x-api-key": apiKey,
						},
						...(body && { body }),
					},
					timeoutMs: 30000, // 30s overall timeout
					dispatcher,
				});

				const elapsedMs = performance.now() - attemptStart;

				// Log successful response
				console.log(
					JSON.stringify({
						type: "proxy_attempt_success",
						requestId,
						endpoint,
						attempt: attemptNumber,
						retry,
						ttfbMs: result.ttfbMs,
						totalMs: result.totalMs,
						status: result.status,
						elapsedMs: Math.round(elapsedMs * 100) / 100,
						timestamp: new Date().toISOString(),
					}),
				);

				// Create a Response-like object for shouldRetry callback
				const mockResponse = new Response(result.body, {
					status: result.status,
					statusText:
						result.status >= 200 && result.status < 300 ? "OK" : "Error",
				});

				// Check if we should retry
				if (shouldRetry?.(mockResponse)) {
					lastResponse = mockResponse;
					// Continue to next retry or endpoint
					if (retry < maxRetries) {
						// Exponential backoff with jitter
						const backoffMs = Math.min(
							1000 * 2 ** retry + Math.random() * 1000,
							5000,
						);
						await new Promise((resolve) => setTimeout(resolve, backoffMs));
						continue;
					}
					continue;
				}

				// Success - return immediately
				return createProxyResponse(result.body, result.status, methods);
			} catch (error) {
				const elapsedMs = performance.now() - attemptStart;
				const errorName =
					error instanceof Error ? error.constructor.name : "UnknownError";
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				lastError = error instanceof Error ? error : new Error(String(error));

				// Log error
				console.log(
					JSON.stringify({
						type: "proxy_attempt_error",
						requestId,
						endpoint,
						attempt: attemptNumber,
						retry,
						errorName,
						errorMessage: errorMessage.substring(0, 200), // Limit message length
						elapsedMs: Math.round(elapsedMs * 100) / 100,
						timestamp: new Date().toISOString(),
					}),
				);

				// If this is the last attempt, throw
				if (attemptNumber >= totalAttempts) {
					throw lastError;
				}

				// Exponential backoff with jitter before retry
				if (retry < maxRetries) {
					const backoffMs = Math.min(
						1000 * 2 ** retry + Math.random() * 1000,
						5000,
					);
					await new Promise((resolve) => setTimeout(resolve, backoffMs));
				}
			}
		}
	}

	// If we got here and have a last response, return it
	if (lastResponse) {
		const bodyText = await lastResponse.text();
		return createProxyResponse(bodyText, lastResponse.status, methods);
	}

	throw lastError || new Error("Failed to proxy request");
}
