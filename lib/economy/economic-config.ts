/**
 * NEXTGEN MINER — Frozen Economic Configuration v1.0
 * Client-safe constants only. Economic mutations MUST remain server-side.
 */
export const ECONOMIC_RULE_VERSION = "economic_v1_0" as const;

export const ECONOMY = {
  diamondPerUsd: 10_000,
  diamondWithdrawable: false,
  cryptoWithdrawable: true,
  settlementHours: 24,
  mergeMultiplier: 1.8,
  conversionFeeBps: 100,
  allocationBps: {
    mining: 5000,
    reserve: 3000,
    donation: 1000,
    ownerPlatform: 1000,
  },
  reserve: {
    greenMin: 1.5,
    healthyMin: 1.2,
    warningMin: 1.0,
    rsm: {
      green: 1.0,
      healthy: 0.85,
      warning: 0.7,
      critical: 0.7,
    },
  },
  miners: {
    levels: 10,
    mergeInputs: 2,
    rarity: ["Common", "Rare", "Epic", "Legendary", "Mythic"] as const,
    families: [
      { slug: "basic-cpu", name: "Basic CPU", priceDiamond: 500, level1Hashrate: 20 },
      { slug: "entry-gpu", name: "Entry GPU", priceDiamond: 1000, level1Hashrate: 60 },
      { slug: "mini-rig", name: "Mini Rig", priceDiamond: 2500, level1Hashrate: 150 },
      { slug: "gaming-pc", name: "Gaming PC", priceDiamond: 7500, level1Hashrate: 450 },
      { slug: "performance-rig", name: "Performance Rig", priceDiamond: 15000, level1Hashrate: 850 },
    ],
    efficiencyByLevel: {
      1: 1.0, 2: 1.02, 3: 1.04, 4: 1.06, 5: 1.08,
      6: 1.10, 7: 1.12, 8: 1.14, 9: 1.16, 10: 1.18,
    } as const,
    mergeFeeByTransition: {
      "1->2": 25, "2->3": 50, "3->4": 100, "4->5": 200,
      "5->6": 400, "6->7": 800, "7->8": 1600, "8->9": 3200, "9->10": 6400,
    } as const,
  },
} as const;

export type ReserveStatus = "green" | "healthy" | "warning" | "critical";

export function reserveStatus(coverage: number): ReserveStatus {
  if (coverage >= ECONOMY.reserve.greenMin) return "green";
  if (coverage >= ECONOMY.reserve.healthyMin) return "healthy";
  if (coverage >= ECONOMY.reserve.warningMin) return "warning";
  return "critical";
}

export function reserveSafetyMultiplier(coverage: number): number {
  if (coverage >= ECONOMY.reserve.greenMin) return ECONOMY.reserve.rsm.green;
  if (coverage >= ECONOMY.reserve.healthyMin) return ECONOMY.reserve.rsm.healthy;
  return ECONOMY.reserve.rsm.warning;
}

export function miningBudgetUsd(netRecognizedRevenueUsd: number, coverage: number): number {
  if (!Number.isFinite(netRecognizedRevenueUsd) || netRecognizedRevenueUsd <= 0) return 0;
  const rsm = Math.min(Math.max(reserveSafetyMultiplier(coverage), 0), 1);
  return netRecognizedRevenueUsd * (ECONOMY.allocationBps.mining / 10_000) * rsm;
}

/**
 * Never use this function to derive a public cash value for Diamond.
 * The $1 denomination is an internal reference unit only.
 */
export function diamondsForUsdReference(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd * ECONOMY.diamondPerUsd);
}
