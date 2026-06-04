import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const SMART_ACCOUNT_RE = /^0x[a-fA-F0-9]{40}$/;
const SANDBOX_WIDGET_BASE_URL = "https://sandbox.swapped.com";
const CONNECT_BASE_URL = "https://connect.swapped.com";
const DEFAULT_CURRENCY_CODE = "ETH_ETHEREUM";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function signUrl(
  baseUrl: string,
  params: URLSearchParams,
  secretKey: string,
): string {
  const search = `?${params.toString()}`;
  const signature = createHmac("sha256", secretKey)
    .update(search)
    .digest("base64");
  return `${baseUrl}/${search}&signature=${encodeURIComponent(signature)}`;
}

function parseCurrencyCode(
  currencyCode: string,
): { asset: string; network: string } | null {
  const idx = currencyCode.indexOf("_");
  if (idx < 0 && currencyCode === "ETH") {
    return { asset: "ETH", network: "sepolia" };
  }
  if (idx <= 0 || idx === currencyCode.length - 1) return null;
  const asset = currencyCode.slice(0, idx);
  const networkRaw = currencyCode.slice(idx + 1).toLowerCase();
  const network = networkRaw === "ethereum" ? "ethereum" : networkRaw;
  return { asset, network };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const smartAccount =
    typeof body?.smartAccount === "string" ? body.smartAccount : null;
  const uuid = typeof body?.uuid === "string" ? body.uuid : null;
  const kind = body?.kind === "connect" ? "connect" : "widget";

  if (!smartAccount || !SMART_ACCOUNT_RE.test(smartAccount)) {
    return NextResponse.json({ error: "smartAccount is required" }, { status: 400 });
  }
  if (!uuid) {
    return NextResponse.json({ error: "uuid is required" }, { status: 400 });
  }

  const externalCustomerId = `${smartAccount.toLowerCase()}:${uuid}`;

  if (kind === "connect") {
    const apiKey = readEnv("SWAPPED_CONNECT_PUB_KEY") ?? readEnv("SWAPPED_API_KEY");
    const secretKey =
      readEnv("SWAPPED_CONNECT_SECRET") ?? readEnv("SWAPPED_SECRET_KEY");
    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Swapped sandbox Connect credentials are not configured" },
        { status: 503 },
      );
    }

    const currencyCode =
      readEnv("SWAPPED_CONNECT_DEFAULT_CURRENCY_CODE") ??
      readEnv("SWAPPED_DEFAULT_CURRENCY_CODE") ??
      DEFAULT_CURRENCY_CODE;
    const parsed = parseCurrencyCode(currencyCode);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid SWAPPED_CONNECT_DEFAULT_CURRENCY_CODE" },
        { status: 500 },
      );
    }

    const params = new URLSearchParams();
    params.set("apiKey", apiKey);
    params.set(
      "walletAddress",
      `${parsed.asset}:${parsed.network}:${smartAccount}`,
    );
    params.set("externalCustomerId", externalCustomerId);
    const connection =
      typeof body?.connection === "string" ? body.connection : undefined;
    if (connection) params.set("connection", connection);

    return NextResponse.json({
      ok: true,
      url: signUrl(CONNECT_BASE_URL, params, secretKey),
      currencyCode,
      sandbox: true,
      externalCustomerId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }

  const apiKey = readEnv("SWAPPED_API_KEY");
  const secretKey = readEnv("SWAPPED_SECRET_KEY");
  if (!apiKey || !secretKey) {
    return NextResponse.json(
      { error: "Swapped sandbox widget credentials are not configured" },
      { status: 503 },
    );
  }

  const currencyCode =
    readEnv("SWAPPED_DEFAULT_CURRENCY_CODE") ?? DEFAULT_CURRENCY_CODE;
  const params = new URLSearchParams();
  params.set("apiKey", apiKey);
  params.set("currencyCode", currencyCode);
  params.set("walletAddress", smartAccount);
  params.set("externalCustomerId", externalCustomerId);
  params.set("submerchant", request.headers.get("host") ?? "demo");

  const method = typeof body?.method === "string" ? body.method : undefined;
  if (method) params.set("method", method);

  return NextResponse.json({
    ok: true,
    url: signUrl(SANDBOX_WIDGET_BASE_URL, params, secretKey),
    currencyCode,
    sandbox: true,
    externalCustomerId,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}
