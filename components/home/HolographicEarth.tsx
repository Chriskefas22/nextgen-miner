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
  { lat: 28, lon: -92, label: 'AMERICAS', color: 0x45eaff, className: 'cyan', left: '17%', top: '45%' },
  { lat: 48, lon: 10, label: 'EUROPE', color: 0x9e62ff, className: 'violet', left: '39%', top: '18%' },
  { lat: 23, lon: 102, label: 'ASIA', color: 0x45eaff, className: 'cyan', left: '78%', top: '39%' },
  { lat: -7, lon: 22, label: 'AFRICA', color: 0x9e62ff, className: 'violet', left: '68%', top: '66%' },
  { lat: -27, lon: 133, label: 'AUSTRALIA', color: 0x45eaff, className: 'cyan', left: '78%', top: '77%' },
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

function makeArcPoints(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const points: THREE.Vector3[] = [];
  const start = a.clone().normalize();
  const end = b.clone().normalize();
  const angle = start.angleTo(end);

  for (let i = 0; i <= 56; i += 1) {
    const t = i / 56;
    const point = start.clone().lerp(end, t).normalize();
    const lift = Math.sin(Math.PI * t) * (0.07 + angle * 0.055);
    points.push(point.multiplyScalar(radius + lift));
  }

  return points;
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

        // Earth land detection. The source image is reused directly from
        // the frozen Landing visual, then given the stronger holographic
        // treatment visible in the Home blueprint.
        float landSignal = max(
          tex.r - tex.b * 0.78,
          tex.g - tex.b * 0.68
        );

        float land = smoothstep(0.012, 0.095, landSignal);
        float coast = smoothstep(0.012, 0.030, landSignal) *
          (1.0 - smoothstep(0.052, 0.095, landSignal));

        vec3 ocean = mix(
          vec3(0.0015, 0.009, 0.026),
          vec3(0.012, 0.115, 0.225),
          smoothstep(0.08, 0.76, lum)
        );

        vec3 landColor = mix(
          vec3(0.025, 0.235, 0.50),
          vec3(0.18, 0.78, 1.00),
          smoothstep(0.16, 0.82, lum)
        );

        vec3 color = mix(ocean, landColor, land);

        // Electric coastal contour.
        color += vec3(0.10, 0.66, 1.0) * coast * 0.88;

        // Small warm city-light response, intentionally restrained.
        float city = smoothstep(0.70, 0.96, lum) * land;
        color += vec3(1.0, 0.76, 0.32) * city * 0.20;

        // Horizontal scan + moving holographic sweep.
        float scan = 0.965 + 0.035 * sin(vUv.y * 210.0 + uTime * 1.35);
        float sweep = 0.5 + 0.5 * sin(vUv.x * 6.28318 - uTime * 0.20);

        color *= scan;
        color += vec3(0.02, 0.18, 0.42) * sweep * 0.035;

        // Cyan atmospheric rim.
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(
          1.0 - max(dot(normalize(vNormal), viewDir), 0.0),
          2.05
        );

        color += vec3(0.012, 0.44, 1.0) * rim * 1.34;

        // Slight central energy bias.
        float centerGlow = exp(
          -length(vWorldPosition.xy) * 1.7
        );
        color += vec3(0.02, 0.14, 0.25) * centerGlow;

        gl_FragColor = vec4(color, 0.985);
      }
    `,
    side: THREE.FrontSide,
    depthWrite: true,
    transparent: false,
  });
}

function createAtmosphereMaterial(color: number, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: 2.10 },
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

        float shell = smoothstep(0.02, 0.92, rim);
        gl_FragColor = vec4(uColor, shell * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeLine(points: THREE.Vector3[], color: number, opacity: number) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeStarField(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * TAU;
    const z = THREE.MathUtils.randFloatSpread(2);
    const xy = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = THREE.MathUtils.randFloat(5.1, 9.0);

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
      color: 0x2379ff,
      size: 0.013,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function createFallbackTexture() {
  const data = new Uint8Array([6, 28, 54, 255]);
  const texture = new THREE.DataTexture(
    data,
    1,
    1,
    THREE.RGBAFormat,
  );

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
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
      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio || 1,
          mobile ? 1.25 : 1.55,
        ),
      );
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);

      const root = new THREE.Group();
      root.rotation.x = THREE.MathUtils.degToRad(-3);
      root.position.y = 0.04;
      scene.add(root);

      scene.add(new THREE.AmbientLight(0x39bfff, 1.28));

      const key = new THREE.DirectionalLight(0xc8f7ff, 2.45);
      key.position.set(-4, 4, 6);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0x7548ff, 0.74);
      fill.position.set(3, -2, -3);
      scene.add(fill);

      const back = new THREE.PointLight(0x27dcff, 1.95, 11);
      back.position.set(0, 0.7, -2.0);
      root.add(back);

      scene.add(makeStarField(mobile ? 100 : 220));

      const earthSystem = new THREE.Group();
      root.add(earthSystem);

      const earthMaterial = createEarthMaterial();
      const fallbackTexture = createFallbackTexture();
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
            '[HomeEarth] Earth texture failed to load; using fallback texture.',
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

      // Match the supplied blueprint orientation: Europe/Africa centered,
      // Americas on the left, Asia on the right.
      earth.rotation.y = 0;
      earthSystem.add(earth);

      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.012,
          mobile ? 44 : 72,
          mobile ? 28 : 46,
        ),
        new THREE.MeshBasicMaterial({
          color: 0x54eaff,
          wireframe: true,
          transparent: true,
          opacity: 0.052,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      earthSystem.add(grid);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.065,
          mobile ? 52 : 80,
          mobile ? 34 : 52,
        ),
        createAtmosphereMaterial(0x35e9ff, 0.54),
      );

      earthSystem.add(atmosphere);

      const violetAtmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.045,
          mobile ? 44 : 68,
          mobile ? 30 : 44,
        ),
        createAtmosphereMaterial(0x9858ff, 0.11),
      );

      earthSystem.add(violetAtmosphere);

      const nodeVectors = REGIONS.map((region) =>
        latLonToVector3(region.lat, region.lon, 1.026),
      );

      const nodeGroup = new THREE.Group();
      earthSystem.add(nodeGroup);

      const nodes: THREE.Mesh[] = [];

      REGIONS.forEach((region, index) => {
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(
            index === 1 ? 0.035 : 0.028,
            mobile ? 9 : 12,
            mobile ? 9 : 12,
          ),
          new THREE.MeshBasicMaterial({
            color: region.color,
            transparent: true,
            opacity: 0.96,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );

        node.position.copy(nodeVectors[index]);
        nodeGroup.add(node);
        nodes.push(node);
      });

      const routes = new THREE.Group();
      earthSystem.add(routes);

      const pairs: [number, number][] = [
        [0, 1],
        [1, 2],
        [2, 4],
        [4, 3],
        [3, 0],
        [1, 3],
        [0, 2],
      ];

      pairs.forEach(([a, b], index) => {
        routes.add(
          makeLine(
            makeArcPoints(nodeVectors[a], nodeVectors[b], 1.037),
            index % 3 === 0 ? 0x49eaff : 0x9661ff,
            index % 3 === 0 ? 0.28 : 0.18,
          ),
        );
      });

      const orbitalGroup = new THREE.Group();
      root.add(orbitalGroup);

      const orbitOne = new THREE.Mesh(
        new THREE.TorusGeometry(1.37, 0.007, 5, 168),
        new THREE.MeshBasicMaterial({
          color: 0x46eaff,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      orbitOne.scale.y = 0.33;
      orbitOne.rotation.x = THREE.MathUtils.degToRad(64);
      orbitOne.rotation.z = THREE.MathUtils.degToRad(11);
      orbitalGroup.add(orbitOne);

      const orbitTwo = new THREE.Mesh(
        new THREE.TorusGeometry(1.49, 0.0055, 5, 168),
        new THREE.MeshBasicMaterial({
          color: 0xa25aff,
          transparent: true,
          opacity: 0.29,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      orbitTwo.scale.y = 0.28;
      orbitTwo.rotation.x = THREE.MathUtils.degToRad(63);
      orbitTwo.rotation.z = THREE.MathUtils.degToRad(-30);
      orbitalGroup.add(orbitTwo);

      const orbitThree = new THREE.Mesh(
        new THREE.TorusGeometry(1.18, 0.004, 4, 150),
        new THREE.MeshBasicMaterial({
          color: 0x24d9ff,
          transparent: true,
          opacity: 0.20,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      orbitThree.scale.y = 0.19;
      orbitThree.rotation.x = THREE.MathUtils.degToRad(56);
      orbitThree.rotation.z = THREE.MathUtils.degToRad(71);
      orbitalGroup.add(orbitThree);

      const platform = new THREE.Group();
      platform.position.y = -1.15;
      platform.scale.setScalar(mobile ? 0.76 : 0.92);
      root.add(platform);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.11, 0.12, 80),
        new THREE.MeshStandardMaterial({
          color: 0x04101b,
          metalness: 0.92,
          roughness: 0.17,
          emissive: 0x07182c,
          emissiveIntensity: 0.40,
        }),
      );
      platform.add(base);

      const tierOne = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 0.94, 0.105, 80),
        new THREE.MeshStandardMaterial({
          color: 0x071321,
          metalness: 0.94,
          roughness: 0.13,
          emissive: 0x100b30,
          emissiveIntensity: 0.34,
        }),
      );
      tierOne.position.y = 0.088;
      platform.add(tierOne);

      const tierTwo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.77, 0.07, 80),
        new THREE.MeshStandardMaterial({
          color: 0x081523,
          metalness: 0.96,
          roughness: 0.12,
          emissive: 0x071c38,
          emissiveIntensity: 0.30,
        }),
      );
      tierTwo.position.y = 0.16;
      platform.add(tierTwo);

      const platformRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.94, 0.009, 5, 144),
        new THREE.MeshBasicMaterial({
          color: 0x48eaff,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      platformRing.position.y = 0.075;
      platform.add(platformRing);

      const platformViolet = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.006, 5, 132),
        new THREE.MeshBasicMaterial({
          color: 0xa35aff,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      platformViolet.position.y = 0.155;
      platform.add(platformViolet);

      const resize = () => {
        mobile = window.innerWidth < 760;

        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);

        camera.aspect = width / height;
        camera.fov = mobile ? 30 : 27;
        camera.position.set(
          0,
          mobile ? 0.02 : 0.04,
          mobile ? 5.00 : 5.18,
        );
        camera.updateProjectionMatrix();

        earthSystem.scale.setScalar(mobile ? 0.95 : 1.06);
        root.position.y = mobile ? 0.02 : 0.05;
        platform.position.y = mobile ? -1.13 : -1.15;
        platform.scale.setScalar(mobile ? 0.73 : 0.92);

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
          mobile ||
          reduced ||
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
            earthSystem.rotation.y += delta * 0.080;
            orbitalGroup.rotation.y -= delta * 0.045;
            orbitalGroup.rotation.z += delta * 0.016;

            const stars = scene.children.find(
              (child) => child instanceof THREE.Points,
            );
            if (stars) {
              stars.rotation.y += delta * 0.007;
              stars.rotation.x = Math.sin(elapsed * 0.12) * 0.012;
            }

            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.15);

            nodes.forEach((node, index) => {
              node.scale.setScalar(
                0.86 + pulse * 0.18 + (index === 1 ? 0.06 : 0),
              );

              (
                node.material as THREE.MeshBasicMaterial
              ).opacity = 0.62 + pulse * 0.34;
            });

            routes.children.forEach((child, index) => {
              if (
                child instanceof THREE.Line &&
                !Array.isArray(child.material)
              ) {
                (
                  child.material as THREE.LineBasicMaterial
                ).opacity =
                  index % 3 === 0
                    ? 0.18 + pulse * 0.10
                    : 0.11 + pulse * 0.07;
              }
            });

            platform.rotation.y += delta * 0.009;
            orbitOne.rotation.z += delta * 0.042;
            orbitTwo.rotation.z -= delta * 0.031;
            orbitThree.rotation.z += delta * 0.027;

            (
              atmosphere.material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.51 + pulse * 0.045;

            atmosphere.scale.setScalar(1 + pulse * 0.010);
            violetAtmosphere.scale.setScalar(1.002 + pulse * 0.010);

            root.rotation.y = THREE.MathUtils.lerp(
              root.rotation.y,
              pointerX * 0.040,
              0.045,
            );

            root.rotation.x = THREE.MathUtils.lerp(
              root.rotation.x,
              THREE.MathUtils.degToRad(-3) - pointerY * 0.028,
              0.045,
            );
          }

          earthMaterial.uniforms.uTime.value = elapsed;

          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        } catch (error) {
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

        scene.traverse((object) => {
          const item = object as THREE.Mesh | THREE.Line | THREE.Points;

          if ('geometry' in item && item.geometry) {
            item.geometry.dispose();
          }

          if ('material' in item && item.material) {
            disposeMaterial(item.material);
          }
        });

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
      aria-label="Interactive holographic Earth"
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
        <small>REAL-TIME NETWORK</small>
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

      <div
        className={`${styles.metric} ${styles.miners}`}
        aria-hidden="true"
      >
        <span>ACTIVE MINERS</span>
        <strong>{metrics.activeMiners}</strong>
      </div>

      <div
        className={`${styles.metric} ${styles.output}`}
        aria-hidden="true"
      >
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

      <div className={styles.asset} aria-hidden="true">
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
