export function HologramCore() {
  return (
    <section className="ng-hologram" aria-label="NextGen Miner holographic diamond">
      <picture className="ng-holo-scene-picture" aria-hidden="true">
        <source srcSet="/assets/hologram/scene.avif" type="image/avif" />
        <source srcSet="/assets/hologram/scene.webp" type="image/webp" />
        <img
          src="/assets/hologram/scene.png"
          alt=""
          className="ng-holo-scene"
        />
      </picture>

      <div className="ng-holo-atmosphere" aria-hidden="true" />
      <div className="ng-holo-grid" aria-hidden="true" />
      <div className="ng-holo-scan" aria-hidden="true" />

      <div className="ng-holo-ring ring-a" aria-hidden="true"><span /></div>
      <div className="ng-holo-ring ring-b" aria-hidden="true"><span /></div>
      <div className="ng-holo-ring ring-c" aria-hidden="true"><span /></div>
      <div className="ng-holo-ring ring-d" aria-hidden="true"><span /></div>

      <div className="ng-holo-diamond" aria-hidden="true">
        <div className="ng-diamond-glow" />
        <img src="/assets/hologram/core.svg" alt="" className="ng-diamond-art" />
        <div className="ng-diamond-beam" />
      </div>

      <div className="ng-holo-node node-left" aria-hidden="true">
        <i /><span>CORE POWER</span><b>ACTIVE</b>
      </div>
      <div className="ng-holo-node node-right" aria-hidden="true">
        <i /><span>NETWORK</span><b>ONLINE</b>
      </div>

      <div className="ng-holo-hud" aria-hidden="true">
        <span>NEXTGEN MINER</span>
        <b>HOLOGRAPHIC CORE</b>
        <small><em /> MINING NETWORK ONLINE</small>
      </div>

      <div className="ng-holo-particles" aria-hidden="true">
        <i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/>
      </div>

      <div className="ng-holo-caption">
        <span>HOLOGRAPHIC CORE</span>
        <b>MINING NETWORK ONLINE</b>
      </div>
    </section>
  )
}
