import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PublicPage } from '@/components/public/PublicPage';
import styles from '../catalog.module.css';

type CatalogRow = {
  id: number;
  slug: string;
  name: string;
  tier: string | null;
  base_hashrate: number | string;
  base_price_diamond: number | string;
  image_path: string | null;
  enabled: boolean;
};

type LevelRow = { level: number; hashrate: number | string };

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('nextgen_miner_catalog')
    .select('name,tier,base_hashrate,base_price_diamond')
    .eq('slug', slug)
    .eq('enabled', true)
    .maybeSingle();

  if (!data) return { title: 'Miner Not Found', robots: { index: false, follow: true } };

  const description = `${data.name} virtual miner — ${hashrate(data.base_hashrate)}, starting at ${diamonds(data.base_price_diamond)} Diamond. Explore its public profile before registering.`;
  return {
    title: data.name,
    description,
    alternates: { canonical: `/miner-catalog/${encodeURIComponent(slug)}` },
    openGraph: {
      title: `${data.name} | NextGen Miner`,
      description,
      url: `/miner-catalog/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function MinerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: minerData } = await supabase
    .from('nextgen_miner_catalog')
    .select('id,slug,name,tier,base_hashrate,base_price_diamond,image_path,enabled')
    .eq('slug', slug)
    .eq('enabled', true)
    .maybeSingle();

  if (!minerData) notFound();

  const miner = minerData as CatalogRow;
  const { data: levelData } = await supabase
    .from('nextgen_miner_levels')
    .select('level,hashrate')
    .eq('miner_id', miner.id)
    .order('level', { ascending: true });

  const levels = (levelData ?? []) as LevelRow[];
  const maxLevel = levels.length ? Math.max(...levels.map((level) => Number(level.level))) : 10;
  const maxHashrate = levels.length ? hashrate(levels[levels.length - 1].hashrate) : '—';

  return (
    <PublicPage
      eyebrow={`MINER PROFILE · ${miner.tier || 'MINER'}`}
      title={miner.name}
      description="A public miner profile with live catalog values. Register only when you are ready to continue into the authenticated ownership experience."
    >
      <section className="public-card public-hero">
        <div className={styles.detailShell}>
          <div className={styles.detailImageFrame}>
            <Image
              src={imagePath(miner.image_path, miner.slug)}
              alt={`${miner.name} virtual miner`}
              fill
              priority
              sizes="(max-width: 760px) 92vw, 56vw"
              className={styles.detailImage}
            />
            <div className={styles.scanline} aria-hidden="true" />
          </div>

          <div className={styles.detailBody}>
            <div className={styles.detailTop}>
              <span className={styles.tier}>{miner.tier || 'Miner'}</span>
              <span className={styles.levels}>LEVELS 1–{maxLevel}</span>
            </div>
            <p className={styles.kicker}>VIRTUAL MINER PROFILE</p>
            <h2>{miner.name}</h2>
            <p className={styles.detailLead}>Explore the current public configuration before entering the authenticated experience. Values shown here are driven by the enabled catalog and level records.</p>

            <dl className={styles.detailStats}>
              <div><dt>BASE HASHRATE</dt><dd>{hashrate(miner.base_hashrate)}</dd></div>
              <div><dt>STARTING PRICE</dt><dd>{diamonds(miner.base_price_diamond)} 💎</dd></div>
              <div><dt>MAX CONFIGURED HASHRATE</dt><dd>{maxHashrate}</dd></div>
            </dl>

            <div className={styles.detailActions}>
              <Link className="public-button-primary" href={`/auth/register?miner=${encodeURIComponent(miner.slug)}`}>Register for this miner →</Link>
              <Link className="public-button" href="/miner-catalog">Back to Miner Catalog</Link>
            </div>
          </div>
        </div>

        <div className={styles.levelPanel}>
          <div>
            <p className={styles.kicker}>LEVEL PROGRESSION</p>
            <h3>Configured miner levels</h3>
            <p>Available progression comes from the active platform level configuration. Ownership and upgrades are authenticated actions.</p>
          </div>
          <div className={styles.levelGrid}>
            {levels.map((level) => (
              <div key={level.level} className={styles.levelCell}>
                <span>LV {level.level}</span>
                <strong>{hashrate(level.hashrate)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
