import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicPage } from '@/components/public/PublicPage';
import styles from './catalog.module.css';

type CatalogRow = {
  id: number;
  slug: string;
  name: string;
  tier: string | null;
  base_hashrate: number | string;
  base_price_diamond: number | string;
  image_path: string | null;
  enabled: boolean;
  sort_order: number;
};

type LevelRow = { miner_id: number; level: number; hashrate: number | string };

function imagePath(value: string | null | undefined, slug: string) {
  if (!value) return `/assets/miners/${slug}.svg`;
  const cleaned = String(value).trim().replace(/^\/+/, '');
  if (cleaned.startsWith('assets/')) return `/${cleaned}`;
  if (cleaned.startsWith('miners/')) return `/assets/${cleaned}`;
  if (/\.(webp|png|jpg|jpeg|svg|avif)$/i.test(cleaned)) return `/assets/miners/${cleaned}`;
  return `/assets/miners/${slug}.svg`;
}

function hashrate(value: number | string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MH/s`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} KH/s`;
  return `${n.toLocaleString('en-US')} H/s`;
}

function diamonds(value: number | string) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

export const metadata = {
  title: 'Miner Catalog',
  description: 'Explore the public NextGen Miner catalog before signing in or registering.',
};

export default async function MinerCatalogPage() {
  const supabase = await createClient();
  const [catalogResult, levelsResult] = await Promise.all([
    supabase
      .from('nextgen_miner_catalog')
      .select('id,slug,name,tier,base_hashrate,base_price_diamond,image_path,enabled,sort_order')
      .eq('enabled', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('nextgen_miner_levels')
      .select('miner_id,level,hashrate')
      .order('miner_id', { ascending: true })
      .order('level', { ascending: true }),
  ]);

  const catalog = (catalogResult.data ?? []) as CatalogRow[];
  const levels = (levelsResult.data ?? []) as LevelRow[];
  const maxByMiner = new Map<number, number>();
  for (const level of levels) {
    const current = maxByMiner.get(Number(level.miner_id)) ?? 0;
    maxByMiner.set(Number(level.miner_id), Math.max(current, Number(level.level)));
  }

  return (
    <PublicPage
      eyebrow="PUBLIC MINER CATALOG"
      title="Explore the rigs before you join."
      description="Browse the live-enabled miner catalog, compare tiers and starting hashrate, then register when you are ready. Purchasing and ownership controls remain behind authentication."
    >
      <section className="public-card public-hero">
        <div className={styles.toolbar}>
          <div>
            <span className={styles.liveDot} /> LIVE CATALOG
            <strong>{catalog.length} enabled miners</strong>
          </div>
          <div className={styles.toolbarActions}>
            <Link className="public-button" href="/how-it-works">How it works</Link>
            <Link className="public-button-primary" href="/auth/register">Create Free Account →</Link>
          </div>
        </div>

        {catalog.length ? (
          <div className={styles.grid}>
            {catalog.map((miner) => {
              const maxLevel = maxByMiner.get(Number(miner.id)) ?? 10;
              return (
                <article className={styles.card} key={miner.id}>
                  <div className={styles.cardGlow} aria-hidden="true" />
                  <div className={styles.cardTop}>
                    <span className={styles.tier}>{miner.tier || 'Miner'}</span>
                    <span className={styles.levels}>LEVELS 1–{maxLevel}</span>
                  </div>
                  <div className={styles.imageFrame}>
                    <Image
                      src={imagePath(miner.image_path, miner.slug)}
                      alt={`${miner.name} virtual miner`}
                      fill
                      sizes="(max-width: 760px) 86vw, (max-width: 1050px) 42vw, 29vw"
                      className={styles.image}
                    />
                    <div className={styles.scanline} aria-hidden="true" />
                  </div>
                  <div className={styles.cardBody}>
                    <div>
                      <p className={styles.kicker}>VIRTUAL MINER</p>
                      <h2>{miner.name}</h2>
                    </div>
                    <dl className={styles.stats}>
                      <div><dt>BASE HASHRATE</dt><dd>{hashrate(miner.base_hashrate)}</dd></div>
                      <div><dt>STARTING PRICE</dt><dd>{diamonds(miner.base_price_diamond)} 💎</dd></div>
                    </dl>
                    <Link className={styles.explore} href="/auth/register">
                      Start with this rig <span>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="public-note">The catalog is temporarily unavailable. Please check again shortly.</div>
        )}
      </section>
    </PublicPage>
  );
}
