import { NextResponse } from "next/server";

export const revalidate = 3600;

const QUOTES = [
  "IDR","CNY","EUR","GBP","JPY","KRW","SGD","MYR","AUD","CAD","HKD",
].join(",");

export async function GET() {
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rates?base=USD&quotes=${QUOTES}`,
      { next: { revalidate: 3600 } },
    );

    if (!response.ok) {
      return NextResponse.json({ rates: { USD: 1 } }, { status: 200 });
    }

    const rows = await response.json();
    const rates: Record<string, number> = { USD: 1 };

    for (const row of Array.isArray(rows) ? rows : []) {
      if (row?.quote && Number.isFinite(Number(row.rate))) {
        rates[String(row.quote).toUpperCase()] = Number(row.rate);
      }
    }

    return NextResponse.json({ rates, date: rows?.[0]?.date ?? null });
  } catch {
    return NextResponse.json({ rates: { USD: 1 } }, { status: 200 });
  }
}
