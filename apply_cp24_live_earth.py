from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"[CP24] Missing marker: {label}")
    return text.replace(old, new, 1)

# 1) Holographic Earth
p = "components/home/HolographicEarth.tsx"
s = read(p)

s = replace_once(
    s,
    """export type HomeEarthMetrics = {
  asset: string;
  status: 'LIVE' | 'PAUSED';
  activeHashrate: string;
  activeMiners: string;
  dailyOutputUsd: string;
};""",
    """export type HomeEarthMetrics = {
  asset: string;
  status: 'LIVE' | 'PAUSED';
  activeHashrate: string;
  activeMiners: string;
  dailyOutputUsd: string;
  networkUserLights?: Array<{
    lat: number;
    lon: number;
    intensity: number;
    country_code?: string;
  }>;
};""",
    "HomeEarthMetrics",
)

s = replace_once(
    s,
    """  const cityLightsRef =
    useRef<
      THREE.Group
    >(
      new THREE.Group(),
    );""",
    """  const cityLightsRef =
    useRef<
      THREE.Group
    >(
      new THREE.Group(),
    );

  const networkUserLightsRef =
    useRef<
      THREE.Group
    >(
      new THREE.Group(),
    );""",
    "networkUserLightsRef",
)

s = replace_once(
    s,
    """function createCityLightGroup(
  mobile: boolean,
  glowTexture: THREE.Texture | null,
  sampler: LandSampler | null,
) {""",
    """function createNetworkUserLightGroup(
  glowTexture: THREE.Texture | null,
) {
  const group = new THREE.Group();
  group.userData.networkUserLights = true;
  return group;
}

function createCityLightGroup(
  mobile: boolean,
  glowTexture: THREE.Texture | null,
  sampler: LandSampler | null,
) {""",
    "createNetworkUserLightGroup",
)

s = s.replace(
"""            cityLightsRef.current =
              cityLights;
          },""",
"""            cityLightsRef.current =
              cityLights;

            const networkUserLights =
              createNetworkUserLightGroup(
                glowTexture,
              );

            synchronizedSystem.add(
              networkUserLights,
            );

            networkUserLightsRef.current =
              networkUserLights;
          },""",
1,
)

# Apply same group setup to texture failure path.
s = s.replace(
"""            cityLightsRef.current =
              cityLights;
          },
        );""",
"""            cityLightsRef.current =
              cityLights;

            const networkUserLights =
              createNetworkUserLightGroup(
                glowTexture,
              );

            synchronizedSystem.add(
              networkUserLights,
            );

            networkUserLightsRef.current =
              networkUserLights;
          },
        );""",
1,
)

s = replace_once(
    s,
    """            color:
              0xffe5a0,
            transparent:
              true,
            opacity:
              0.22 +
              city.intensity *
                0.34,""",
    """            color:
              0xffd46a,
            transparent:
              true,
            opacity:
              0.30 +
              city.intensity *
                0.36,""",
    "city light color",
)

s = replace_once(
    s,
    """      const size =
        city.size *
        (mobile
          ? 1.55
          : 1.82);""",
    """      const size =
        city.size *
        (mobile
          ? 1.72
          : 2.02);""",
    "city light size",
)

s = replace_once(
    s,
    """        baseOpacity:
          0.22 +
          city.intensity *
            0.34,""",
    """        baseOpacity:
          0.30 +
          city.intensity *
            0.36,""",
    "city light base opacity",
)

s = replace_once(
    s,
    """              const individualPulse =
                isNetworkLive
                  ? 0.84 +
                    0.16 *
""",
    """              const individualPulse =
                isNetworkLive
                  ? 0.955 +
                    0.045 *
""",
    "subtle individual pulse",
)

s = replace_once(
    s,
    """                            now *
                              0.0019 +
                              phase,""",
    """                            now *
                              0.00105 +
                              phase * 2.31,""",
    "subtle pulse frequency",
)

s = replace_once(
    s,
    """              const regionalPulse =
                isNetworkLive
                  ? 0.89 +
                    0.11 *
""",
    """              const regionalPulse =
                isNetworkLive
                  ? 0.975 +
                    0.025 *
""",
    "subtle regional pulse",
)

s = replace_once(
    s,
    """                            now *
                              0.00072 +
                              regionPhase,""",
    """                            now *
                              0.00041 +
                              regionPhase * 1.37,""",
    "regional pulse frequency",
)

s = replace_once(
    s,
    """              const networkActivity =
                isNetworkLive
                  ? 1
                  : 0.72;""",
    """              const networkActivity =
                isNetworkLive
                  ? 1.0
                  : 0.28;""",
    "live network activity",
)

animate_marker = """      const animateLights =
        (now: number) => {"""
s = replace_once(
    s,
    animate_marker,
    """      let networkLightSignature = '';

      const syncNetworkUserLights =
        () => {
          const items =
            metricsRef.current.networkUserLights ??
            [];

          const signature =
            items
              .map(
                (item, index) =>
                  [
                    item.country_code ?? '',
                    Number(item.lat).toFixed(4),
                    Number(item.lon).toFixed(4),
                    Number(item.intensity).toFixed(3),
                    index,
                  ].join(':'),
              )
              .join('|');

          if (
            signature === networkLightSignature
          ) {
            return;
          }

          networkLightSignature =
            signature;

          const group =
            networkUserLightsRef.current;

          group.children
            .slice()
            .forEach(
              (child) => {
                const sprite =
                  child as THREE.Sprite;

                const material =
                  sprite.material as
                    THREE.SpriteMaterial;

                material.dispose();
                group.remove(
                  child,
                );
              },
            );

          if (
            !items.length ||
            !glowTexture
          ) {
            return;
          }

          items.forEach(
            (item, index) => {
              const intensity =
                THREE.MathUtils.clamp(
                  Number(
                    item.intensity ??
                      0.72,
                  ),
                  0.45,
                  1,
                );

              const sprite =
                new THREE.Sprite(
                  new THREE.SpriteMaterial({
                    map:
                      glowTexture,
                    color:
                      0xffd05c,
                    transparent:
                      true,
                    opacity:
                      0.22 +
                      intensity *
                        0.12,
                    depthWrite:
                      false,
                    depthTest:
                      true,
                    blending:
                      THREE.AdditiveBlending,
                  }),
                );

              const position =
                latLonToVector3(
                  Number(item.lat),
                  Number(item.lon),
                  1.020,
                );

              const size =
                (0.016 +
                  intensity *
                    0.012) *
                (
                  window.innerWidth <
                  760
                    ? 1.18
                    : 1
                );

              sprite.scale.set(
                size,
                size,
                1,
              );

              sprite.position.copy(
                position,
              );

              sprite.userData = {
                baseOpacity:
                  0.22 +
                  intensity *
                    0.12,
                intensity,
                phase:
                  index * 2.417 +
                  Number(item.lat) *
                    0.071 +
                  Number(item.lon) *
                    0.013,
                userNode:
                  true,
              };

              group.add(
                sprite,
              );
            },
          );
        };

      const animateUserLights =
        (now: number) => {
          const live =
            metricsRef.current.status ===
            'LIVE';

          networkUserLightsRef.current.children.forEach(
            (child) => {
              const sprite =
                child as THREE.Sprite;

              const material =
                sprite.material as
                  THREE.SpriteMaterial;

              const base =
                Number(
                  sprite.userData
                    .baseOpacity ??
                    0.26,
                );

              const phase =
                Number(
                  sprite.userData
                    .phase ??
                    0,
                );

              const intensity =
                Number(
                  sprite.userData
                    .intensity ??
                    0.7,
                );

              const pulse =
                live
                  ? 0.955 +
                    0.045 *
                      (
                        0.5 +
                        0.5 *
                          Math.sin(
                            now *
                              0.00103 +
                              phase,
                          )
                      ) +
                    0.012 *
                      Math.sin(
                        now *
                          0.00031 +
                          phase *
                            1.73,
                      )
                  : 0.18;

              material.opacity =
                base *
                pulse *
                (
                  live
                    ? 0.94 +
                      intensity *
                        0.06
                    : 0.16
                );
            },
          );
        };

      const animateLights =
        (now: number) => {""",
    "network light sync/animation",
)

s = replace_once(
    s,
    """          animateLights(
            now,
          );""",
    """          syncNetworkUserLights();

          animateLights(
            now,
          );

          animateUserLights(
            now,
          );""",
    "network light render hook",
)

s = replace_once(
    s,
    """        <span
          className={
            styles.liveSubline
          }
        >
          {networkBadgeSubline}
        </span>""",
    """        <span
          className={
            styles.liveSubline
          }
        >
          {networkBadgeSubline}
        </span>

        <span className={styles.liveUsers}>
          {(metrics.networkUserLights ?? []).length.toLocaleString('en-US')} NETWORK LIGHTS
        </span>""",
    "network light count HUD",
)

write(p, s)

# 2) Earth CSS
p = "components/home/HolographicEarth.module.css"
s = read(p)
s += r"""

/* CP24 — live Earth gold lighting: warm, visible and deliberately subtle in motion. */
.host[data-live="true"] {
  border-color: rgba(71, 234, 255, 0.30);
  box-shadow:
    inset 0 0 64px rgba(28, 179, 255, 0.055),
    0 0 34px rgba(50, 192, 255, 0.08),
    0 18px 52px rgba(0, 0, 0, 0.24);
}

.host[data-live="true"] .canvas {
  filter: saturate(1.20) contrast(1.08) brightness(1.09);
  transition: filter .45s ease;
}

.host[data-live="true"] .liveBadge {
  border-color: rgba(255, 210, 112, 0.34);
  background:
    linear-gradient(145deg, rgba(24, 23, 24, 0.70), rgba(3, 16, 34, 0.58));
  box-shadow:
    inset 0 0 18px rgba(255, 211, 103, 0.035),
    0 0 22px rgba(255, 196, 85, 0.07);
}

.liveUsers {
  display: block;
  margin-top: 6px;
  color: #e9c779;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.09em;
  opacity: 0.82;
}

.host[data-live="false"] .canvas {
  filter: saturate(.52) contrast(.90) brightness(.74);
  transition: filter .45s ease;
}

@media (max-width: 760px) {
  .liveUsers {
    font-size: 6.5px;
  }

  .host[data-live="true"] .canvas {
    filter: saturate(1.22) contrast(1.08) brightness(1.10);
  }
}
"""
write(p, s)

# 3) Home command center
p = "components/home/HomeCommandCenter.tsx"
s = read(p)

s = replace_once(
    s,
    """  const [clock, setClock] = useState(Date.now());""",
    """  const [clock, setClock] = useState(Date.now());

  type NetworkUserLight = {
    lat: number;
    lon: number;
    intensity: number;
    country_code?: string;
  };

  const [networkUserLights, setNetworkUserLights] =
    useState<NetworkUserLight[]>([]);""",
    "networkUserLights state",
)

s = replace_once(
    s,
    """      const [a, c] = await Promise.all([
        sb.rpc('nextgen_farm_snapshot', { p_asset: nextAsset }),
        sb.rpc('nextgen_farm_claim_status', { p_asset: nextAsset }),
      ]);""",
    """      const [a, c, n] = await Promise.all([
        sb.rpc('nextgen_farm_snapshot', { p_asset: nextAsset }),
        sb.rpc('nextgen_farm_claim_status', { p_asset: nextAsset }),
        sb.rpc('nextgen_home_network_lights'),
      ]);""",
    "network light RPC",
)

s = replace_once(
    s,
    """      if (c.error) throw c.error;
      setData(a.data as HomeSnapshot);""",
    """      if (c.error) throw c.error;
      if (n.error) throw n.error;
      setData(a.data as HomeSnapshot);
      setNetworkUserLights(
        Array.isArray(n.data)
          ? (n.data as NetworkUserLight[])
          : [],
      );""",
    "network light state update",
)

old_effect = """  useEffect(() => { void load(asset, true); const t = window.setInterval(() => void load(asset, true), 15000); return () => window.clearInterval(t); }, [asset, load]);"""
new_effect = """  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const sb = createClient();
        const { data: { user } } =
          await sb.auth.getUser();

        if (
          user &&
          !user.user_metadata?.country_code
        ) {
          const timezone =
            Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';

          const language =
            navigator.language ?? '';

          const response =
            await fetch(
              `/api/network/country?timezone=${encodeURIComponent(timezone)}&language=${encodeURIComponent(language)}`,
              { cache: 'no-store' },
            );

          const payload =
            await response.json();

          const code =
            typeof payload?.country_code ===
              'string'
              ? payload.country_code.toUpperCase()
              : '';

          if (
            !cancelled &&
            /^[A-Z]{2}$/.test(code)
          ) {
            await sb.auth.updateUser({
              data: {
                country_code: code,
              },
            });
          }
        }
      } catch {
        // Decorative map metadata must never block dashboard use.
      }

      if (!cancelled) {
        await load(asset, true);
      }
    })();

    const t =
      window.setInterval(
        () => void load(asset, true),
        15000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [asset, load]);"""
s = replace_once(s, old_effect, new_effect, "country metadata effect")

s = replace_once(
    s,
    """            dailyOutputUsd: money(data.live_earnings.daily_usd),
          }} />""",
    """            dailyOutputUsd: money(data.live_earnings.daily_usd),
            networkUserLights,
          }} />""",
    "Earth props",
)

s = replace_once(
    s,
    """      <section className={styles.assetPanel}>""",
    """      <section className={styles.poolPanel} aria-label="USDT mining pool economics">
        <div className={styles.poolPanelHead}>
          <div>
            <div className={styles.sectionKicker}>ECONOMIC POOL</div>
            <h2>Today's USDT Mining Budget</h2>
            <p>Verified deposits fund the shared pool. Miner hashrate determines each active user's share.</p>
          </div>
          <span className={styles.poolState}>{data.pool?.reserve_status ?? 'SYNCING'}</span>
        </div>
        <div className={styles.poolMetrics}>
          <div><small>POOL BUDGET</small><b>${money(data.pool?.mining_budget_usd)}</b></div>
          <div><small>ALLOCATED</small><b>${money(data.pool?.allocated_usd)}</b></div>
          <div><small>REMAINING</small><b>${money(Math.max(poolBudget - poolAllocated, 0))}</b></div>
          <div><small>10D REVENUE</small><b>${money(data.pool?.rolling_10d_net_revenue_usd)}</b></div>
        </div>
        <div className={styles.poolNote}>
          <span>Funding is counted once.</span>
          <span>Unused Diamond does not create another revenue source.</span>
          <span>New deposits join the rolling pool according to the daily accounting window.</span>
        </div>
      </section>

      <section className={styles.assetPanel}>""",
    "economic pool panel",
)

# pool values belong immediately before use; keep them near the other derived values.
s = replace_once(
    s,
    """  const dailyClaim = data.streak.days.find((d) => d.status === 'ready');""",
    """  const poolBudget = Number(data.pool?.mining_budget_usd ?? 0);
  const poolAllocated = Number(data.pool?.allocated_usd ?? 0);
  const dailyClaim = data.streak.days.find((d) => d.status === 'ready');""",
    "pool derived values",
)

write(p, s)

# 4) Home CSS for pool panel
p = "components/home/HomeCommandCenter.module.css"
s = read(p)
s += r"""

/* CP24 — transparent shared-pool explanation. */
.poolPanel {
  min-width: 0;
  padding: 15px;
  background:
    radial-gradient(circle at 92% 15%, rgba(139,61,255,.10), transparent 25%),
    linear-gradient(145deg, rgba(7,20,35,.96), rgba(3,11,20,.98));
  border: 1px solid rgba(39,121,170,.22);
  border-radius: 17px;
  box-shadow: inset 0 0 25px rgba(31,173,234,.018), 0 14px 30px rgba(0,0,0,.18);
}

.poolPanelHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.poolPanelHead h2 {
  margin: 4px 0 3px;
  font: 700 15px Orbitron;
}

.poolPanelHead p {
  margin: 0;
  max-width: 760px;
  color: #7c98ab;
  font-size: 10px;
  line-height: 1.45;
}

.poolState {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid rgba(81,242,189,.22);
  border-radius: 999px;
  color: #55efba;
  background: rgba(53,243,180,.05);
  font-size: 7px;
  font-weight: 900;
  letter-spacing: .12em;
}

.poolMetrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 7px;
  margin-top: 12px;
}

.poolMetrics > div {
  padding: 10px;
  border-radius: 11px;
  border: 1px solid rgba(46,113,151,.18);
  background: rgba(5,16,28,.72);
}

.poolMetrics small,
.poolMetrics b {
  display: block;
}

.poolMetrics small {
  color: #66869b;
  font-size: 7px;
  letter-spacing: .12em;
}

.poolMetrics b {
  margin-top: 5px;
  color: #ebfbff;
  font: 800 14px/1.1 Rajdhani, sans-serif;
}

.poolNote {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 14px;
  margin-top: 9px;
  color: #6f8ca0;
  font-size: 8px;
  line-height: 1.45;
}

.poolNote span::before {
  content: '•';
  margin-right: 5px;
  color: #41eaff;
}

@media (max-width: 760px) {
  .poolPanel {
    padding: 13px;
    border-radius: 15px;
  }

  .poolPanelHead {
    display: block;
  }

  .poolState {
    display: inline-block;
    margin-top: 8px;
  }

  .poolMetrics {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }
}
"""
write(p, s)

# 5) Registration: capture country metadata once, server-side country preferred.
p = "app/auth/register/page.tsx"
s = read(p)

s = replace_once(
    s,
    """      const metadata: Record<string, string> = { username: cleanUsername };
      if (referralCode) metadata.referral_code = referralCode;""",
    """      const metadata: Record<string, string> = { username: cleanUsername };

      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';

        const language =
          navigator.language ?? '';

        const countryResponse =
          await fetch(
            `/api/network/country?timezone=${encodeURIComponent(timezone)}&language=${encodeURIComponent(language)}`,
            { cache: 'no-store' },
          );

        const countryPayload =
          await countryResponse.json();

        const countryCode =
          typeof countryPayload?.country_code === 'string'
            ? countryPayload.country_code.toUpperCase()
            : '';

        if (/^[A-Z]{2}$/.test(countryCode)) {
          metadata.country_code = countryCode;
        }
      } catch {
        // Decorative network metadata must never block registration.
      }

      if (referralCode) metadata.referral_code = referralCode;""",
    "registration country metadata",
)

write(p, s)

print("[CP24] Frontend changes applied successfully.")
print("[CP24] Added/updated:")
for item in [
    "components/home/HolographicEarth.tsx",
    "components/home/HolographicEarth.module.css",
    "components/home/HomeCommandCenter.tsx",
    "components/home/HomeCommandCenter.module.css",
    "app/auth/register/page.tsx",
    "app/api/network/country/route.ts",
    "supabase/migrations/20260918_cp24_network_country_lights.sql",
]:
    print(" -", item)
