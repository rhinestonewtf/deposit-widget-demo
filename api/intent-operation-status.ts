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
			// Extract intentId from URL query parameter
			const url = new URL(request.url);
			const intentId = url.searchParams.get("id");

			if (!intentId) {
				return new Response(
					JSON.stringify({ error: "Missing intentId parameter" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Proxy the request to Rhinestone API
			const response = await fetch(
				`https://dev.v1.orchestrator.rhinestone.dev/intent-operation/${intentId}`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": apiKey,
					},
				},
			);

			// Get the response data
			const data = await response.text();

			// Return the response with the same status code
			return new Response(data, {
				status: response.status,
				headers: {
					"Content-Type": "application/json",
					// Add CORS headers for local development
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
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
