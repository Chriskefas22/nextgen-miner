export function HologramCore() {
  return (
    <section
      className="ng-hologram"
      aria-label="NextGen Miner holographic mining core"
    >
      <div className="ng-holo-grid" aria-hidden="true" />
      <div className="ng-holo-scan" aria-hidden="true" />

      <div className="ng-holo-orbit ng-orbit-a" aria-hidden="true">
        <span className="ng-orbit-dot" />
      </div>
      <div className="ng-holo-orbit ng-orbit-b" aria-hidden="true">
        <span className="ng-orbit-dot" />
      </div>
      <div className="ng-holo-orbit ng-orbit-c" aria-hidden="true">
        <span className="ng-orbit-dot" />
      </div>

      <div className="ng-holo-core" aria-hidden="true">
        <div className="ng-core-halo" />
        <img
          src="/assets/hologram/core.svg"
          alt=""
          className="ng-core-art"
        />
        <div className="ng-core-pulse" />
        <div className="ng-core-beam ng-beam-a" />
        <div className="ng-core-beam ng-beam-b" />
      </div>

      <div className="ng-holo-particles" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i />
      </div>

      <div className="ng-holo-hud" aria-hidden="true">
        <span>NEXTGEN MINER</span>
        <b>MINING CORE</b>
        <small><em /> NETWORK ONLINE</small>
      </div>

      <div className="ng-holo-caption">
        <span>HOLOGRAPHIC CORE</span>
        <b>MINING NETWORK ONLINE</b>
      </div>
    </section>
  )
}
