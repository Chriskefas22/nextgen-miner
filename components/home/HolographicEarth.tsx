'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import styles from './HolographicEarth.module.css';

export type HomeEarthMetrics = {
  asset: string;
  status: 'LIVE' | 'PAUSED';
  activeHashrate: string;
  activeMiners: string;
  dailyOutputUsd: string;
};

type Region = {
  lat: number;
  lon: number;
  label: string;
  color: number;
  className: string;
  left: string;
  top: string;
};

const EARTH_TEXTURE = '/assets/landing/earth-equirectangular.webp';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const REGIONS: Region[] = [
  { lat: 28, lon: -94, label: 'AMERICAS', color: 0x47eaff, className: 'cyan', left: '13%', top: '48%' },
  { lat: 48, lon: 10, label: 'EUROPE', color: 0xa763ff, className: 'violet', left: '34%', top: '25%' },
  { lat: 24, lon: 105, label: 'ASIA', color: 0x47eaff, className: 'cyan', left: '83%', top: '39%' },
  { lat: -7, lon: 23, label: 'AFRICA', color: 0xa763ff, className: 'violet', left: '70%', top: '67%' },
  { lat: -28, lon: 134, label: 'AUSTRALIA', color: 0x47eaff, className: 'cyan', left: '82%', top: '80%' },
];

function latLonToVector3(latitude: number, longitude: number, radius: number) {
  const phi = (90 - latitude) * DEG;
  const theta = (longitude + 180) * DEG;

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createEarthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);

        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D uTexture;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 tex = texture2D(uTexture, vUv).rgb;
        float lum = dot(tex, vec3(0.299, 0.587, 0.114));

        float landSignal = max(
          tex.r - tex.b * 0.78,
          tex.g - tex.b * 0.68
        );

        float land = smoothstep(0.012, 0.095, landSignal);
        float coast = smoothstep(0.012, 0.030, landSignal) *
          (1.0 - smoothstep(0.052, 0.095, landSignal));

        // Deep navy ocean like the supplied blueprint.
        vec3 ocean = mix(
          vec3(0.001, 0.008, 0.022),
          vec3(0.010, 0.090, 0.190),
          smoothstep(0.05, 0.74, lum)
        );

        // Bright but not blown-out electric land.
        vec3 landColor = mix(
          vec3(0.025, 0.28, 0.56),
          vec3(0.12, 0.78, 0.98),
          smoothstep(0.18, 0.84, lum)
        );

        vec3 color = mix(ocean, landColor, land);
        color += vec3(0.09, 0.58, 1.0) * coast * 0.72;

        // Restrained city-light response from bright map pixels.
        float city = smoothstep(0.72, 0.96, lum) * land;
        color += vec3(0.82, 0.78, 0.46) * city * 0.16;

        // Fine scan modulation.
        color *= 0.968 + 0.032 * sin(vUv.y * 190.0 + uTime * 1.35);

        // Stronger holographic rim.
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(
          1.0 - max(dot(normalize(vNormal), viewDir), 0.0),
          2.15
        );

        color += vec3(0.012, 0.44, 1.0) * rim * 1.28;

        gl_FragColor = vec4(color, 0.985);
      }
    `,
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
  });
}

function createAtmosphereMaterial(color: number, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: 2.12 },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform vec3 uColor;
      uniform float uPower;
      uniform float uOpacity;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        float rim = pow(
          1.0 - max(dot(normal, viewDir), 0.0),
          uPower
        );

        float shell = smoothstep(0.02, 0.95, rim);
        gl_FragColor = vec4(uColor, shell * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeStarField(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * TAU;
    const z = THREE.MathUtils.randFloatSpread(2);
    const xy = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = THREE.MathUtils.randFloat(5.2, 8.6);

    positions[i * 3] = radius * xy * Math.cos(theta);
    positions[i * 3 + 1] = radius * z;
    positions[i * 3 + 2] = radius * xy * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x2a8fff,
      size: 0.012,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.33,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeSurfaceNetwork(count: number, mobile: boolean) {
  const group = new THREE.Group();
  const nodes: THREE.Mesh[] = [];
  const total = mobile ? Math.floor(count * 0.62) : count;

  for (let i = 0; i < total; i += 1) {
    const latitude = THREE.MathUtils.randFloat(-58, 62);
    const longitude = THREE.MathUtils.randFloat(-175, 175);
    const position = latLonToVector3(latitude, longitude, 1.022);

    const accent = i % 5 === 0 ? 0xa56aff : 0x53eaff;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        i % 5 === 0 ? 0.020 : 0.014,
        mobile ? 5 : 6,
        mobile ? 5 : 6,
      ),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: i % 5 === 0 ? 0.64 : 0.38,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    mesh.position.copy(position);
    nodes.push(mesh);
    group.add(mesh);
  }

  return { group, nodes };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const resource = child as THREE.Mesh | THREE.Line | THREE.Points;

    if ('geometry' in resource && resource.geometry) {
      resource.geometry.dispose();
    }

    if ('material' in resource && resource.material) {
      if (Array.isArray(resource.material)) {
        resource.material.forEach((material) => material.dispose());
      } else {
        resource.material.dispose();
      }
    }
  });
}

export function HolographicEarth({
  metrics,
}: {
  metrics: HomeEarthMetrics;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef(metrics);

  metricsRef.current = metrics;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frame = 0;
    let disposed = false;
    let reduced = false;
    let mobile = window.innerWidth < 760;
    let pointerX = 0;
    let pointerY = 0;
    let last = performance.now();
    let started = performance.now();

    const motionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    reduced = motionQuery.matches;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });

      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.10;
      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio || 1,
          mobile ? 1.25 : 1.55,
        ),
      );

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);

      // One master transform keeps Earth, orbital rings and surface nodes coherent.
      const commandRoot = new THREE.Group();
      commandRoot.rotation.x = THREE.MathUtils.degToRad(-3);
      scene.add(commandRoot);

      const key = new THREE.DirectionalLight(0xc9f7ff, 2.55);
      key.position.set(-4, 4, 6);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0x6c48ff, 0.68);
      fill.position.set(3, -2, -3);
      scene.add(fill);

      scene.add(new THREE.AmbientLight(0x38bfff, 1.18));

      const rearGlow = new THREE.PointLight(0x32e7ff, 1.65, 10);
      rearGlow.position.set(0, 0.55, -2.2);
      commandRoot.add(rearGlow);

      const stars = makeStarField(mobile ? 95 : 190);
      scene.add(stars);

      const synchronizedSystem = new THREE.Group();
      commandRoot.add(synchronizedSystem);

      const earthMaterial = createEarthMaterial();

      const fallbackTexture = new THREE.DataTexture(
        new Uint8Array([4, 19, 42, 255]),
        1,
        1,
        THREE.RGBAFormat,
      );
      fallbackTexture.colorSpace = THREE.SRGBColorSpace;
      fallbackTexture.needsUpdate = true;
      earthMaterial.uniforms.uTexture.value = fallbackTexture;

      const loader = new THREE.TextureLoader();
      const earthTexture = loader.load(
        EARTH_TEXTURE,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(
            renderer?.capabilities.getMaxAnisotropy() ?? 1,
            4,
          );
          earthMaterial.uniforms.uTexture.value = texture;
          texture.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(
            '[HomeEarth] Earth texture failed to load; retained safe placeholder.',
          );
        },
      );

      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(
          1,
          mobile ? 72 : 112,
          mobile ? 48 : 76,
        ),
        earthMaterial,
      );

      // Use the same Earth orientation as the supplied blueprint:
      // Europe/Africa central, Americas left, Asia right.
      earth.rotation.y = THREE.MathUtils.degToRad(100);
      earth.position.y = 0.16;
      synchronizedSystem.add(earth);

      // Very restrained longitude/latitude lattice — no city/route lines.
      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.010,
          mobile ? 40 : 66,
          mobile ? 26 : 42,
        ),
        new THREE.MeshBasicMaterial({
          color: 0x5eeaff,
          wireframe: true,
          transparent: true,
          opacity: 0.026,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      grid.position.y = 0.16;
      synchronizedSystem.add(grid);

      const earthGlow = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.045,
          mobile ? 44 : 72,
          mobile ? 30 : 48,
        ),
        new THREE.MeshBasicMaterial({
          color: 0x18cfff,
          transparent: true,
          opacity: 0.075,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      earthGlow.position.y = 0.16;
      synchronizedSystem.add(earthGlow);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.070,
          mobile ? 48 : 76,
          mobile ? 32 : 50,
        ),
        createAtmosphereMaterial(0x35e9ff, 0.55),
      );
      atmosphere.position.y = 0.16;
      synchronizedSystem.add(atmosphere);

      const violetAtmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.044,
          mobile ? 42 : 64,
          mobile ? 28 : 42,
        ),
        createAtmosphereMaterial(0x9557ff, 0.105),
      );
      violetAtmosphere.position.y = 0.16;
      synchronizedSystem.add(violetAtmosphere);

      const surfaceNetwork = makeSurfaceNetwork(28, mobile);
      surfaceNetwork.group.position.y = 0.16;
      synchronizedSystem.add(surfaceNetwork.group);

      // The rings are children of the SAME master transform as Earth.
      // No independent orbiting group: no drift, no desynchronization.
      const rings = new THREE.Group();
      rings.position.y = -0.78;
      synchronizedSystem.add(rings);

      // CP20.10: rings are deliberately BELOW the Earth.
      // They are horizontal platform/orbit rings, not tilted hoops that slice
      // through the globe. They remain children of the same master transform.
      const ringDefinitions = [
        { radius: 1.18, tube: 0.006, y: 0.22, rx: 0, rz: 0, color: 0x45eaff, opacity: 0.46 },
        { radius: 1.39, tube: 0.005, y: 0.19, rx: 0, rz: 0, color: 0x45eaff, opacity: 0.32 },
        { radius: 1.60, tube: 0.004, y: 0.16, rx: 0, rz: 0, color: 0xa45aff, opacity: 0.24 },
        { radius: 1.82, tube: 0.003, y: 0.13, rx: 0, rz: 0, color: 0x37dfff, opacity: 0.17 },
      ];

      const ringMeshes = ringDefinitions.map((definition) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(
            definition.radius,
            definition.tube,
            5,
            mobile ? 128 : 180,
          ),
          new THREE.MeshBasicMaterial({
            color: definition.color,
            transparent: true,
            opacity: definition.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );

        ring.scale.y = definition.y;
        ring.rotation.x = THREE.MathUtils.degToRad(definition.rx);
        ring.rotation.z = THREE.MathUtils.degToRad(definition.rz);
        rings.add(ring);
        return ring;
      });

      // A separate low-profile pedestal is positioned underneath the synchronized
      // system; its glow is synchronized by the same master clock, but it does
      // not rotate independently around the Earth.
      const pedestal = new THREE.Group();
      pedestal.position.y = -1.18;
      commandRoot.add(pedestal);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.92, 1.04, 0.10, 80),
        new THREE.MeshStandardMaterial({
          color: 0x030b14,
          metalness: 0.94,
          roughness: 0.15,
          emissive: 0x06182b,
          emissiveIntensity: 0.30,
        }),
      );
      pedestal.add(base);

      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.70, 0.82, 0.07, 80),
        new THREE.MeshStandardMaterial({
          color: 0x05101b,
          metalness: 0.96,
          roughness: 0.13,
          emissive: 0x110b31,
          emissiveIntensity: 0.33,
        }),
      );
      upper.position.y = 0.075;
      pedestal.add(upper);

      const cyanPedestalRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.86, 0.008, 5, 140),
        new THREE.MeshBasicMaterial({
          color: 0x45eaff,
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      cyanPedestalRing.position.y = 0.055;
      pedestal.add(cyanPedestalRing);

      const violetPedestalRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.005, 5, 120),
        new THREE.MeshBasicMaterial({
          color: 0x9c58ff,
          transparent: true,
          opacity: 0.50,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      violetPedestalRing.position.y = 0.12;
      pedestal.add(violetPedestalRing);

      const resize = () => {
        mobile = window.innerWidth < 760;

        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);

        camera.aspect = width / height;
        camera.fov = mobile ? 31 : 28;
        camera.position.set(
          0,
          mobile ? 0.02 : 0.04,
          mobile ? 5.45 : 5.20,
        );
        camera.updateProjectionMatrix();

        // Keep the globe visually inside the stage rather than oversized.
        synchronizedSystem.scale.setScalar(mobile ? 0.91 : 1.02);
        pedestal.position.y = mobile ? -1.14 : -1.18;

        renderer?.setPixelRatio(
          Math.min(
            window.devicePixelRatio || 1,
            mobile ? 1.25 : 1.55,
          ),
        );

        renderer?.setSize(width, height, false);
      };

      const onMotion = () => {
        reduced = motionQuery.matches;
        started = performance.now();
      };

      const onPointerMove = (event: PointerEvent) => {
        if (
          reduced ||
          mobile ||
          !window.matchMedia('(pointer: fine)').matches
        ) {
          return;
        }

        const rect = host.getBoundingClientRect();
        pointerX = THREE.MathUtils.clamp(
          (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5,
          -0.5,
          0.5,
        );
        pointerY = THREE.MathUtils.clamp(
          (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5,
          -0.5,
          0.5,
        );
      };

      const onPointerLeave = () => {
        pointerX = 0;
        pointerY = 0;
      };

      resize();

      const observer = new ResizeObserver(resize);
      observer.observe(host);

      motionQuery.addEventListener?.('change', onMotion);
      host.addEventListener('pointermove', onPointerMove);
      host.addEventListener('pointerleave', onPointerLeave);

      const render = (now: number) => {
        if (disposed || !renderer) return;

        try {
          const delta = Math.min(0.05, (now - last) / 1000);
          last = now;
          const elapsed = (now - started) * 0.001;
          const current = metricsRef.current;

          host.dataset.status = current.status.toLowerCase();
          host.dataset.asset = current.asset.toUpperCase();

          if (!reduced) {
            // ONE animation source.
            synchronizedSystem.rotation.y += delta * 0.070;

            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.05);

            surfaceNetwork.nodes.forEach((node, index) => {
              const base = index % 5 === 0 ? 1.18 : 1.0;
              node.scale.setScalar(
                base * (0.82 + pulse * 0.18),
              );

              const material =
                node.material as THREE.MeshBasicMaterial;
              material.opacity =
                index % 5 === 0
                  ? 0.48 + pulse * 0.28
                  : 0.25 + pulse * 0.20;
            });

            ringMeshes.forEach((ring, index) => {
              ring.rotation.z +=
                delta * (index === 0 ? 0.034 : index === 1 ? -0.024 : 0.018);

              const material = ring.material as THREE.MeshBasicMaterial;
              material.opacity =
                ringDefinitions[index].opacity *
                (0.86 + pulse * 0.20);
            });

            stars.rotation.y += delta * 0.006;

            atmosphere.scale.setScalar(1 + pulse * 0.008);
            violetAtmosphere.scale.setScalar(1.003 + pulse * 0.010);

            (
              atmosphere.material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.50 + pulse * 0.035;

            commandRoot.rotation.y = THREE.MathUtils.lerp(
              commandRoot.rotation.y,
              pointerX * 0.035,
              0.045,
            );

            commandRoot.rotation.x = THREE.MathUtils.lerp(
              commandRoot.rotation.x,
              THREE.MathUtils.degToRad(-3) - pointerY * 0.025,
              0.045,
            );
          }

          earthMaterial.uniforms.uTime.value = elapsed;
          renderer.render(scene, camera);

          frame = window.requestAnimationFrame(render);
        } catch (error) {
          // Presentation layer fails closed without breaking Home.
          console.error('[HomeEarth render]', error);
          window.cancelAnimationFrame(frame);
        }
      };

      frame = window.requestAnimationFrame(render);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        observer.disconnect();

        motionQuery.removeEventListener?.('change', onMotion);
        host.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerleave', onPointerLeave);

        disposeObject(scene);

        earthTexture.dispose();
        fallbackTexture.dispose();
        renderer?.dispose();
      };
    } catch (error) {
      console.error('[HomeEarth init]', error);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
      };
    }
  }, []);

  const live = metrics.status === 'LIVE';

  return (
    <div
      ref={hostRef}
      className={styles.root}
      data-live={live ? 'true' : 'false'}
      aria-label="Interactive holographic Earth command center"
    >
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.gridGlow} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-hidden="true"
      />

      <div className={styles.topRail} aria-hidden="true">
        <span>GLOBAL MINING NETWORK</span>
        <b>
          <i />
          {live ? 'LIVE' : 'PAUSED'}
        </b>
      </div>

      <div className={styles.centerTitle} aria-hidden="true">
        <span>NEXTGEN CORE</span>
        <small>GLOBAL NETWORK</small>
      </div>

      <div className={styles.livePanel} aria-hidden="true">
        <strong>NETWORK {live ? 'LIVE' : 'PAUSED'}</strong>
        <small>{metrics.asset.toUpperCase()} · HOME CORE</small>
      </div>

      <div className={`${styles.metric} ${styles.hash}`} aria-hidden="true">
        <span>GLOBAL HASHRATE</span>
        <strong>
          {metrics.activeHashrate}
          <em> H/s</em>
        </strong>
      </div>

      <div className={`${styles.metric} ${styles.miners}`} aria-hidden="true">
        <span>ACTIVE MINERS</span>
        <strong>{metrics.activeMiners}</strong>
      </div>

      <div className={`${styles.metric} ${styles.output}`} aria-hidden="true">
        <span>LIVE MINING OUTPUT</span>
        <strong>${metrics.dailyOutputUsd}</strong>
      </div>

      {REGIONS.map((region) => (
        <div
          key={region.label}
          className={`${styles.region} ${styles[region.className]}`}
          style={{
            left: region.left,
            top: region.top,
          }}
          aria-hidden="true"
        >
          <i
            style={{
              backgroundColor: `#${region.color
                .toString(16)
                .padStart(6, '0')}`,
            }}
          />
          <b>{region.label}</b>
          <small>NETWORK NODE</small>
        </div>
      ))}

      <div className={styles.coreBadge} aria-hidden="true">
        <span>N</span>
      </div>

      <div className={styles.assetBadge} aria-hidden="true">
        <span>MINING ASSET</span>
        <b>{metrics.asset.toUpperCase()}</b>
      </div>

      <div className={styles.bottomRail} aria-hidden="true">
        <span>REAL-TIME CORE VISUAL</span>
        <b>360° / SYNCHRONIZED</b>
      </div>

      <div className={styles.cornerTL} aria-hidden="true" />
      <div className={styles.cornerTR} aria-hidden="true" />
      <div className={styles.cornerBL} aria-hidden="true" />
      <div className={styles.cornerBR} aria-hidden="true" />
    </div>
  );
}
