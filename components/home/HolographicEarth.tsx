'use client';

import { useEffect, useRef, useState } from 'react';
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
};

const EARTH_TEXTURE = '/assets/landing/earth-equirectangular.webp';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const REGIONS: Region[] = [
  { lat: 45, lon: -102, label: 'AMERICAS', color: 0x43eaff, className: 'cyan' },
  { lat: 49, lon: 14, label: 'EUROPE', color: 0x9b63ff, className: 'violet' },
  { lat: 19, lon: 104, label: 'ASIA', color: 0x43eaff, className: 'cyan' },
  { lat: -6, lon: 24, label: 'AFRICA', color: 0x9b63ff, className: 'violet' },
  { lat: -29, lon: 135, label: 'AUSTRALIA', color: 0x43eaff, className: 'cyan' },
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
        float luminance = dot(tex, vec3(0.299, 0.587, 0.114));

        float landSignal = max(
          tex.r - tex.b * 0.76,
          tex.g - tex.b * 0.64
        );
        float land = smoothstep(0.018, 0.105, landSignal);

        vec3 ocean = mix(
          vec3(0.003, 0.018, 0.040),
          vec3(0.014, 0.105, 0.18),
          smoothstep(0.08, 0.70, luminance)
        );

        vec3 landColor = mix(
          vec3(0.035, 0.25, 0.46),
          vec3(0.18, 0.70, 0.92),
          smoothstep(0.24, 0.86, luminance)
        );

        vec3 color = mix(ocean, landColor, land);

        float coast = smoothstep(0.018, 0.032, landSignal) *
          (1.0 - smoothstep(0.060, 0.105, landSignal));
        color += vec3(0.10, 0.56, 0.96) * coast * 0.62;

        // Subtle city-light emphasis without washing the land cyan.
        float city = smoothstep(0.67, 0.92, luminance) * land;
        color += vec3(0.82, 0.88, 0.62) * city * 0.18;

        float scan = 0.972 + 0.028 * sin(vUv.y * 170.0 + uTime * 1.35);
        color *= scan;

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(
          1.0 - max(dot(normalize(vNormal), viewDir), 0.0),
          2.35
        );
        color += vec3(0.015, 0.38, 0.92) * rim * 1.10;

        float shimmer = 0.5 + 0.5 * sin(vUv.x * 6.28318 - uTime * 0.24);
        color += vec3(0.02, 0.17, 0.38) * shimmer * 0.045;

        gl_FragColor = vec4(color, 0.98);
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
      uPower: { value: 2.15 },
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
        float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), uPower);
        gl_FragColor = vec4(uColor, smoothstep(0.06, 0.95, rim) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeArc(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const start = a.clone().normalize();
  const end = b.clone().normalize();
  const angle = start.angleTo(end);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= 40; i += 1) {
    const t = i / 40;
    const point = start.clone().lerp(end, t).normalize();
    const lift = Math.sin(Math.PI * t) * (0.045 + angle * 0.05);
    points.push(point.multiplyScalar(radius + lift));
  }
  return points;
}

function makeStarField(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * TAU;
    const z = THREE.MathUtils.randFloatSpread(2);
    const xy = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = THREE.MathUtils.randFloat(4.8, 8.0);
    positions[i * 3] = radius * xy * Math.cos(theta);
    positions[i * 3 + 1] = radius * z;
    positions[i * 3 + 2] = radius * xy * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x318dff,
      size: 0.018,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.40,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
  } else {
    material.dispose();
  }
}

export function HolographicEarth({ metrics }: { metrics: HomeEarthMetrics }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef(metrics);
  const [fallback, setFallback] = useState(false);

  metricsRef.current = metrics;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let disposed = false;
    let frame = 0;
    let last = performance.now();
    let started = performance.now();
    let reduced = false;
    let mobile = window.innerWidth < 760;
    let pointerX = 0;
    let pointerY = 0;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced = motionQuery.matches;

    try {
      const gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });

      if (!gl) {
        setFallback(true);
        return;
      }

      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });

      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.55),
      );
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(mobile ? 32 : 29, 1, 0.1, 30);
      camera.position.set(0, 0.06, mobile ? 5.05 : 5.30);

      const root = new THREE.Group();
      root.rotation.x = THREE.MathUtils.degToRad(-4);
      root.position.y = mobile ? 0.02 : 0.12;
      scene.add(root);

      scene.add(new THREE.AmbientLight(0x3ac7ff, 1.18));

      const key = new THREE.DirectionalLight(0xbceeff, 2.15);
      key.position.set(-4, 3, 5);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0x7048ff, 0.78);
      fill.position.set(3, -1, -3);
      scene.add(fill);

      const back = new THREE.PointLight(0x45eaff, 1.7, 10);
      back.position.set(0, 1, -2);
      root.add(back);

      const starField = makeStarField(mobile ? 90 : 180);
      scene.add(starField);

      const earthSystem = new THREE.Group();
      earthSystem.scale.setScalar(mobile ? 0.92 : 0.98);
      root.add(earthSystem);

      const earthMaterial = createEarthMaterial();
      const loader = new THREE.TextureLoader();
      const texture = loader.load(
        EARTH_TEXTURE,
        (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.anisotropy = Math.min(
            renderer?.capabilities.getMaxAnisotropy() ?? 1,
            4,
          );
          earthMaterial.uniforms.uTexture.value = loaded;
          loaded.needsUpdate = true;
        },
        undefined,
        () => {
          setFallback(true);
        },
      );
      earthMaterial.uniforms.uTexture.value = texture;

      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(
          1,
          mobile ? 56 : 80,
          mobile ? 36 : 54,
        ),
        earthMaterial,
      );
      earth.rotation.y = Math.PI;
      earthSystem.add(earth);

      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.012,
          mobile ? 38 : 56,
          mobile ? 24 : 34,
        ),
        new THREE.MeshBasicMaterial({
          color: 0x55eaff,
          wireframe: true,
          transparent: true,
          opacity: 0.055,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      earthSystem.add(grid);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.07,
          mobile ? 42 : 64,
          mobile ? 28 : 40,
        ),
        createAtmosphereMaterial(0x39eaff, 0.52),
      );
      earthSystem.add(atmosphere);

      const violetAtmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.035,
          mobile ? 36 : 52,
          mobile ? 24 : 34,
        ),
        createAtmosphereMaterial(0x8651ff, 0.10),
      );
      earthSystem.add(violetAtmosphere);

      const nodePositions = REGIONS.map((region) =>
        latLonToVector3(region.lat, region.lon, 1.026),
      );

      const nodeGroup = new THREE.Group();
      earthSystem.add(nodeGroup);

      const nodeMeshes: THREE.Mesh[] = [];
      REGIONS.forEach((region, index) => {
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(
            index === 2 ? 0.036 : 0.028,
            mobile ? 8 : 10,
            mobile ? 8 : 10,
          ),
          new THREE.MeshBasicMaterial({
            color: region.color,
            transparent: true,
            opacity: 0.94,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        node.position.copy(nodePositions[index]);
        nodeGroup.add(node);
        nodeMeshes.push(node);
      });

      const routes = new THREE.Group();
      earthSystem.add(routes);

      const routePairs = [
        [0, 1],
        [1, 2],
        [2, 4],
        [4, 3],
        [3, 0],
        [1, 3],
      ];

      routePairs.forEach(([a, b], index) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          makeArc(nodePositions[a], nodePositions[b], 1.034),
        );
        routes.add(
          new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({
              color: index % 2 === 0 ? 0x45eaff : 0x9458ff,
              transparent: true,
              opacity: index % 2 === 0 ? 0.24 : 0.16,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            }),
          ),
        );
      });

      const orbitalGroup = new THREE.Group();
      root.add(orbitalGroup);

      const orbitOne = new THREE.Mesh(
        new THREE.TorusGeometry(1.39, 0.007, 5, 144),
        new THREE.MeshBasicMaterial({
          color: 0x45eaff,
          transparent: true,
          opacity: 0.30,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      orbitOne.scale.y = 0.34;
      orbitOne.rotation.x = THREE.MathUtils.degToRad(65);
      orbitOne.rotation.z = THREE.MathUtils.degToRad(12);
      orbitalGroup.add(orbitOne);

      const orbitTwo = new THREE.Mesh(
        new THREE.TorusGeometry(1.51, 0.006, 5, 144),
        new THREE.MeshBasicMaterial({
          color: 0x9956ff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      orbitTwo.scale.y = 0.29;
      orbitTwo.rotation.x = THREE.MathUtils.degToRad(63);
      orbitTwo.rotation.z = THREE.MathUtils.degToRad(-31);
      orbitalGroup.add(orbitTwo);

      const orbitThree = new THREE.Mesh(
        new THREE.TorusGeometry(1.19, 0.004, 4, 128),
        new THREE.MeshBasicMaterial({
          color: 0x31d9ff,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      orbitThree.scale.y = 0.20;
      orbitThree.rotation.x = THREE.MathUtils.degToRad(57);
      orbitThree.rotation.z = THREE.MathUtils.degToRad(74);
      orbitalGroup.add(orbitThree);

      const platform = new THREE.Group();
      platform.position.y = -1.18;
      root.add(platform);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.02, 1.10, 0.14, 72),
        new THREE.MeshStandardMaterial({
          color: 0x06101c,
          metalness: 0.82,
          roughness: 0.20,
          emissive: 0x031425,
          emissiveIntensity: 0.32,
        }),
      );
      platform.add(base);

      const tier = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 0.94, 0.11, 72),
        new THREE.MeshStandardMaterial({
          color: 0x071323,
          metalness: 0.90,
          roughness: 0.16,
          emissive: 0x0c0b2a,
          emissiveIntensity: 0.36,
        }),
      );
      tier.position.y = 0.10;
      platform.add(tier);

      const platformRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.010, 5, 128),
        new THREE.MeshBasicMaterial({
          color: 0x43eaff,
          transparent: true,
          opacity: 0.60,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      platformRing.position.y = 0.08;
      platform.add(platformRing);

      const violetRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.70, 0.006, 5, 112),
        new THREE.MeshBasicMaterial({
          color: 0x9c58ff,
          transparent: true,
          opacity: 0.54,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      violetRing.position.y = 0.14;
      platform.add(violetRing);

      const resize = () => {
        mobile = window.innerWidth < 760;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height;
        camera.fov = mobile ? 32 : 29;
        camera.position.z = mobile ? 5.05 : 5.30;
        camera.updateProjectionMatrix();
        renderer?.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.55),
        );
        renderer?.setSize(width, height, false);
      };

      const onMotion = () => {
        reduced = motionQuery.matches;
        started = performance.now();
      };

      const onPointerMove = (event: PointerEvent) => {
        if (mobile || reduced || !window.matchMedia('(pointer: fine)').matches) {
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
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
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
            earthSystem.rotation.y += delta * 0.20;
            orbitalGroup.rotation.y -= delta * 0.065;
            orbitalGroup.rotation.z += delta * 0.020;
            starField.rotation.y += delta * 0.010;
            starField.rotation.x = Math.sin(elapsed * 0.10) * 0.014;

            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.05);
            nodeMeshes.forEach((node, index) => {
              node.scale.setScalar(
                0.86 + pulse * 0.16 + (index === 2 ? 0.05 : 0),
              );
              const material = node.material as THREE.MeshBasicMaterial;
              material.opacity = 0.60 + pulse * 0.30;
            });

            routes.children.forEach((child, index) => {
              const line = child as THREE.Line;
              if (line.material && !Array.isArray(line.material)) {
                (line.material as THREE.LineBasicMaterial).opacity =
                  index % 2 === 0
                    ? 0.18 + pulse * 0.08
                    : 0.12 + pulse * 0.06;
              }
            });

            platform.rotation.y += delta * 0.018;
            orbitOne.rotation.z += delta * 0.075;
            orbitTwo.rotation.z -= delta * 0.050;
            orbitThree.rotation.z += delta * 0.040;

            atmosphere.scale.setScalar(1 + pulse * 0.010);
            violetAtmosphere.scale.setScalar(1.002 + pulse * 0.014);

            root.rotation.y = THREE.MathUtils.lerp(
              root.rotation.y,
              pointerX * 0.04,
              0.05,
            );
            root.rotation.x = THREE.MathUtils.lerp(
              root.rotation.x,
              THREE.MathUtils.degToRad(-4) - pointerY * 0.028,
              0.05,
            );
          }

          earthMaterial.uniforms.uTime.value = elapsed;
          (atmosphere.material as THREE.ShaderMaterial).uniforms.uOpacity.value =
            0.49 + Math.sin(elapsed * 1.12) * 0.035;

          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        } catch {
          setFallback(true);
          window.cancelAnimationFrame(frame);
        }
      };

      frame = window.requestAnimationFrame(render);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        motionQuery.removeEventListener?.('change', onMotion);
        host.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerleave', onPointerLeave);

        scene.traverse((object) => {
          const item = object as THREE.Mesh | THREE.Line | THREE.Points;
          if ('geometry' in item && item.geometry) item.geometry.dispose();
          if ('material' in item && item.material) disposeMaterial(item.material);
        });

        texture.dispose();
        earthMaterial.dispose();
        renderer?.dispose();
      };
    } catch {
      setFallback(true);
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
      data-fallback={fallback ? 'true' : 'false'}
      aria-label="Interactive holographic Earth"
    >
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      {fallback && (
        <div className={styles.fallbackEarth} aria-hidden="true">
          <div className={styles.fallbackGrid} />
          <div className={styles.fallbackAtmosphere} />
          <div className={styles.fallbackN}>N</div>
        </div>
      )}

      <div className={styles.nCore} aria-hidden="true">
        <span>N</span>
      </div>

      <div className={styles.topRail} aria-hidden="true">
        <span>GLOBAL MINING NETWORK</span>
        <b><i />{live ? 'LIVE' : 'PAUSED'}</b>
      </div>

      <div className={styles.heroTitle} aria-hidden="true">
        <span>NEXTGEN CORE</span>
        <small>REAL-TIME NETWORK</small>
      </div>

      <div className={styles.livePanel} aria-hidden="true">
        <strong>NETWORK {live ? 'LIVE' : 'PAUSED'}</strong>
        <small>{metrics.asset.toUpperCase()} · HOME CORE</small>
      </div>

      <div className={`${styles.metric} ${styles.hashMetric}`} aria-hidden="true">
        <span>GLOBAL HASHRATE</span>
        <strong>{metrics.activeHashrate}<em> H/s</em></strong>
      </div>

      <div className={`${styles.metric} ${styles.minerMetric}`} aria-hidden="true">
        <span>ACTIVE MINERS</span>
        <strong>{metrics.activeMiners}</strong>
      </div>

      <div className={`${styles.metric} ${styles.outputMetric}`} aria-hidden="true">
        <span>LIVE OUTPUT</span>
        <strong>${metrics.dailyOutputUsd}</strong>
      </div>

      {REGIONS.map((region, index) => (
        <div
          key={region.label}
          className={`${styles.region} ${styles[region.className]}`}
          style={{
            '--region-index': index,
          } as React.CSSProperties}
          aria-hidden="true"
        >
          <i />
          <b>{region.label}</b>
          <small>NETWORK NODE</small>
        </div>
      ))}

      <div className={styles.assetBadge} aria-hidden="true">
        <span>MINING ASSET</span>
        <b>{metrics.asset.toUpperCase()}</b>
      </div>

      <div className={styles.bottomRail} aria-hidden="true">
        <span>REAL-TIME CORE VISUAL</span>
        <b>360° / LIVE</b>
      </div>

      <div className={styles.cornerTL} aria-hidden="true" />
      <div className={styles.cornerTR} aria-hidden="true" />
      <div className={styles.cornerBL} aria-hidden="true" />
      <div className={styles.cornerBR} aria-hidden="true" />
    </div>
  );
}
