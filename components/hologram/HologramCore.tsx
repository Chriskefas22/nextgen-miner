export function HologramCore() {
  return (
    <section className="ng-hologram" aria-label="NextGen Miner live holographic diamond">
      <picture className="ng-holo-scene-picture" aria-hidden="true">
        <source srcSet="/assets/hologram/scene-base.avif" type="image/avif" />
        <source srcSet="/assets/hologram/scene-base.webp" type="image/webp" />
        <img src="/assets/hologram/scene-base.png" alt="" className="ng-holo-scene" />
      </picture>

      <div className="ng-holo-atmosphere" aria-hidden="true" />

      <div className="ng-live-platform-ring live-ring-a" aria-hidden="true"><span /></div>
      <div className="ng-live-platform-ring live-ring-b" aria-hidden="true"><span /></div>
      <div className="ng-live-platform-ring live-ring-c" aria-hidden="true"><span /></div>

      <div className="ng-live-diamond-shell" aria-hidden="true">
        <div className="ng-live-diamond-glow" />
        <img src="/assets/hologram/diamond.webp" alt="" className="ng-live-diamond" />
        <img src="/assets/hologram/core.svg" alt="" className="ng-live-wireframe" />
        <span className="ng-live-highlight" />
      </div>

      <div className="ng-live-beam" aria-hidden="true" />

      <div className="ng-live-particles" aria-hidden="true">
        <i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/>
      </div>

      <div className="ng-holo-live-status" aria-hidden="true">
        <span>NEXTGEN MINER</span>
        <b>HOLOGRAPHIC DIAMOND</b>
        <small><em /> LIVE CORE // ROTATING</small>
      </div>

      <div className="ng-holo-caption">
        <span>HOLOGRAPHIC CORE</span>
        <b>MINING NETWORK ONLINE</b>
      </div>
    </section>
  )
}
