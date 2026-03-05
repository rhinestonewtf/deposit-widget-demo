import { NextRequest, NextResponse } from "next/server";

const HELIUS_RPC_URL = process.env.HELIUS_SOLANA_RPC_URL;

export async function POST(request: NextRequest) {
  if (!HELIUS_RPC_URL) {
    return NextResponse.json(
      { error: "Solana RPC not configured" },
      { status: 503 },
    );
  }

  const body = await request.json();

  const response = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
