'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

/**
 * Isolated Network Core visual.
 *
 * The Earth asset is transparent and lives only inside this component.
 * The three orbital planes, nodes, scan and aura run continuously so the
 * visual reads as a 360° holographic network without changing page layout.
 */
export default function NetworkCore() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      root.dataset.reducedMotion = media.matches ? 'true' : 'false';
    };

    update();
    media.addEventListener?.('change', update);

    return () => media.removeEventListener?.('change', update);
  }, []);

  return (
    <div
      ref={rootRef}
      className="network-core-3d"
      data-reduced-motion="false"
      aria-hidden="true"
    >
      <div className="network-core-3d__aura" />

      <div className="network-core-3d__earth">
        <Image
          src="/assets/landing/hologram-earth-360.png"
          alt=""
          fill
          priority
          sizes="(max-width: 560px) 270px, 330px"
          className="network-core-3d__earth-image"
        />
      </div>

      <div className="network-core-3d__orbit network-core-3d__orbit--x" />
      <div className="network-core-3d__orbit network-core-3d__orbit--y" />
      <div className="network-core-3d__orbit network-core-3d__orbit--z" />

      <div className="network-core-3d__axis network-core-3d__axis--v" />
      <div className="network-core-3d__axis network-core-3d__axis--h" />

      <span className="network-core-3d__node node-1" />
      <span className="network-core-3d__node node-2" />
      <span className="network-core-3d__node node-3" />
      <span className="network-core-3d__node node-4" />
      <span className="network-core-3d__node node-5" />
      <span className="network-core-3d__node node-6" />

      <div className="network-core-3d__scan" />
      <div className="network-core-3d__reflection" />
    </div>
  );
}
