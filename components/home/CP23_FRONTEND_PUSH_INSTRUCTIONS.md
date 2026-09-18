# CP23 frontend push

Apply these patches to `main`:

1. `CP23.6_EARTH_LIVE_STATE.patch`
2. `CP23.8_HOME_POOL_TRANSPARENCY.patch`

Files changed:
- `components/home/HolographicEarth.tsx`
- `components/home/HolographicEarth.module.css`
- `components/home/HomeCommandCenter.tsx`
- `components/home/HomeCommandCenter.module.css`

Expected UI result:
- LIVE Earth is visibly brighter/greener, has faster live signal animation and shows Hashrate / Miners / Today's output.
- PAUSED Earth is deliberately dimmer, desaturated and non-animated.
- Home explicitly explains the shared USDT pool: deposits fund the pool; hashrate determines share; unused Diamond is not counted as fresh funding twice.
- Home shows today's pool budget, allocated, remaining and rolling 10-day revenue.
