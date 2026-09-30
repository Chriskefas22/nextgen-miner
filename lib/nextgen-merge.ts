export type MergeRpcResult = {
  success?: boolean;
  message?: string;
  merge_fee_diamond?: number;
  miner_name?: string;
  [key: string]: unknown;
};

/**
 * Small adapter for wiring the MergeEnhancement component to
 * an existing NextGenMiner API route.
 *
 * Keep the route string in one place so the existing website
 * structure does not need to be changed.
 */

export async function fetchMinerMergeFee(
  endpoint: string,
  args: { minerId: string | number; fromLevel: number }
): Promise<number> {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("miner_id", String(args.minerId));
  url.searchParams.set("from_level", String(args.fromLevel));

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.message || body?.error || "Unable to load merge fee."
    );
  }

  const fee = Number(body?.fee_diamond ?? body?.merge_fee_diamond);

  if (!Number.isFinite(fee)) {
    throw new Error("The merge-fee response is invalid.");
  }

  return fee;
}

export async function executeMinerMerge(
  endpoint: string,
  args: {
    firstMinerId: string | number;
    secondMinerId: string | number;
    expectedFeeDiamond: number;
  }
): Promise<MergeRpcResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      first_miner_id: args.firstMinerId,
      second_miner_id: args.secondMinerId,
      expected_fee_diamond: args.expectedFeeDiamond,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || body?.error || "Merge failed.");
  }

  if (body?.success === false) {
    throw new Error(body?.message || "Merge failed.");
  }

  return body ?? { success: true };
}
