const HEALTH_URL =
  "https://v1.orchestrator.rhinestone.dev/deposit-processor/health/status";

export async function GET() {
  const res = await fetch(HEALTH_URL, { next: { revalidate: 0 } });
  const data = await res.json();
  return Response.json(data);
}
