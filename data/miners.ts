export type MinerTier =
  | 'COMMON'
  | 'UNCOMMON'
  | 'RARE'
  | 'EPIC'
  | 'LEGENDARY'
  | 'MYTHIC'
  | 'PREMIUM'
  | 'OMEGA+';

export type MinerCatalogItem = {
  id: string;
  slug: string;
  name: string;
  rarity: MinerTier;
  description: string;
  imageUrl?: string | null;
  baseHashrate?: number | null;
  basePrice?: number | null;
  sortOrder: number;
  level?: number;
  currentHashrate?: number | null;
  nextHashrate?: number | null;
  purchasePrice?: number | null;
};

// Visual mapping only. Economics remains sourced from Supabase.
// Starter Keyboard is intentionally absent.
export const minerVisuals = [
  ['basic-cpu', 'Basic CPU', 'COMMON'],
  ['entry-gpu', 'Entry GPU', 'UNCOMMON'],
  ['gaming-pc', 'Gaming PC', 'RARE'],
  ['mini-rig', 'Mini Rig', 'UNCOMMON'],
  ['performance-rig', 'Performance Rig', 'RARE'],
  ['hydro-rig', 'Hydro Rig', 'EPIC'],
  ['titan-rig', 'Titan Rig', 'EPIC'],
  ['nebula-station', 'Nebula Station', 'LEGENDARY'],
  ['nuclear-reactor', 'Nuclear Reactor', 'LEGENDARY'],
  ['orion-core', 'Orion Core', 'MYTHIC'],
  ['quantum-rig', 'Quantum Rig', 'MYTHIC'],
  ['dark-matter-engine', 'Dark Matter Engine', 'OMEGA+'],
  ['solaris-array', 'Solaris Array', 'OMEGA+'],
  ['chrono-nexus', 'Chrono Nexus', 'OMEGA+'],
  ['galactic-core', 'Galactic Core', 'PREMIUM'],
  ['infinity-nexus', 'Infinity Nexus', 'PREMIUM'],
] as const;

export const minerVisualMap: Record<string, { slug: string; name: string; rarity: MinerTier }> =
  Object.fromEntries(
    minerVisuals.map(([slug, name, rarity]) => [slug, { slug, name, rarity }]),
  );

export function normalizeMinerSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function localMinerAsset(slug: string): string | null {
  const key = normalizeMinerSlug(slug);
  return minerVisualMap[key] ? `/assets/miners/${key}.svg` : null;
}

export function formatHashrate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MH/s`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} KH/s`;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} H/s`;
}

export function formatDiamonds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
}
