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
  className: 'cyan' | 'violet';
};

const EARTH_TEXTURE = '/assets/landing/earth-equirectangular.webp';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const REGIONS: Region[] = [
  { lat: 30, lon: -88, label: 'AMERICAS', color: 0x45eaff, className: 'cyan' },
  { lat: 49, lon: 12, label: 'EUROPE', color: 0xa15fff, className: 'violet' },
  { lat: 23, lon: 103, label: 'ASIA', color: 0x45eaff, className: 'cyan' },
  { lat: -8, lon: 23, label: 'AFRICA', color: 0xa15fff, className: 'violet' },
  { lat: -28, lon: 134, label: 'AUSTRALIA', color: 0x45eaff, className: 'cyan' },
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
  const start = a.clone().normalize();
  const end = b.clone().normalize();
  const angle = start.angleTo(end);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    const p = start.clone().lerp(end, t).normalize();
    const lift = Math.sin(Math.PI * t) * (0.055 + angle * 0.045);
    points.push(p.multiplyScalar(radius + lift));
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

        float landSignal = max(
          tex.r - tex.b * 0.78,
          tex.g - tex.b * 0.66
        );

        float land = smoothstep(0.012, 0.092, landSignal);
        float coast = smoothstep(0.012, 0.030, landSignal) *
          (1.0 - smoothstep(0.050, 0.092, landSignal));

        vec3 ocean = mix(
          vec3(0.0015, 0.008, 0.025),
          vec3(0.010, 0.095, 0.195),
          smoothstep(0.06, 0.72, lum)
        );

        vec3 landColor = mix(
          vec3(0.018, 0.20, 0.46),
          vec3(0.12, 0.70, 0.98),
          smoothstep(0.16, 0.84, lum)
        );

        vec3 color = mix(ocean, landColor, land);
        color += vec3(0.08, 0.56, 1.0) * coast * 0.72;

        // Restrained warm city-light hint.
        float city = smoothstep(0.72, 0.95, lum) * land;
        color += vec3(0.92, 0.76, 0.36) * city * 0.14;

        // Scan shimmer.
        float scan = 0.972 + 0.028 * sin(vUv.y * 210.0 + uTime * 1.25);
        float sweep = 0.5 + 0.5 * sin(vUv.x * 6.28318 - uTime * 0.18);
        color *= scan;
        color += vec3(0.02, 0.16, 0.38) * sweep * 0.032;

        // Atmospheric rim.
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(
          1.0 - max(dot(normalize(vNormal), viewDir), 0.0),
          2.08
        );

        color += vec3(0.008, 0.43, 1.0) * rim * 1.22;

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
      uPower: { value: 2.1 },
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

        gl_FragColor = vec4(
          uColor,
          smoothstep(0.03, 0.92, rim) * uOpacity
        );
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeLine(
  points: THREE.Vector3[],
  color: number,
  opacity: number,
) {
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

function makeStars(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * TAU;
    const z = THREE.MathUtils.randFloatSpread(2);
    const xy = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = THREE.MathUtils.randFloat(5.0, 8.6);

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
      color: 0x238fff,
      size: 0.014,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.30,
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
  } else {
    material.dispose();
  }
}

export function HolographicEarth({
  metrics,
}: {
  metrics: HomeEarthMetrics;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const regionRefs = useRef<Array<HTMLDivElement | null>>([]);
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
      // Match the stable Landing renderer pattern: let Three own the context.
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
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        mobile ? 31 : 27,
        1,
        0.1,
        30,
      );
      camera.position.set(
        0,
        mobile ? 0.02 : 0.05,
        mobile ? 5.0 : 5.2,
      );

      const root = new THREE.Group();
      root.position.y = mobile ? 0.02 : 0.04;
      root.rotation.x = THREE.MathUtils.degToRad(-2.5);
      scene.add(root);

      scene.add(new THREE.AmbientLight(0x39c8ff, 1.20));

      const key = new THREE.DirectionalLight(0xcaf7ff, 2.35);
      key.position.set(-4, 4, 6);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0x7a4cff, 0.70);
      fill.position.set(3, -1, -3);
      scene.add(fill);

      const back = new THREE.PointLight(0x3ce7ff, 1.8, 11);
      back.position.set(0, 0.8, -2.0);
      root.add(back);

      const stars = makeStars(mobile ? 90 : 190);
      scene.add(stars);

      // The Earth, its atmosphere, nodes, routes and orbital rings are all
      // children of this same system. One rotation therefore keeps every
      // 3D ring/node/route element physically synchronized with the globe.
      const earthSystem = new THREE.Group();
      root.add(earthSystem);

      const earthMaterial = createEarthMaterial();
      const placeholderTexture = createFallbackTexture();
      earthMaterial.uniforms.uTexture.value = placeholderTexture;

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
            '[HomeEarth] Earth texture failed to load; placeholder retained.',
          );
        },
      );

      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(
          1,
          mobile ? 68 : 104,
          mobile ? 46 : 70,
        ),
        earthMaterial,
      );
      earthSystem.add(earth);

      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.0105,
          mobile ? 40 : 66,
          mobile ? 26 : 42,
        ),
        new THREE.MeshBasicMaterial({
          color: 0x52eaff,
          wireframe: true,
          transparent: true,
          opacity: 0.035,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      earthSystem.add(grid);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.072,
          mobile ? 48 : 74,
          mobile ? 32 : 50,
        ),
        createAtmosphereMaterial(0x36eaff, 0.50),
      );
      earthSystem.add(atmosphere);

      const violetAtmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(
          1.040,
          mobile ? 42 : 62,
          mobile ? 28 : 40,
        ),
        createAtmosphereMaterial(0x9a55ff, 0.10),
      );
      earthSystem.add(violetAtmosphere);

      // IMPORTANT: city/region connection lines are intentionally NOT drawn.
      // Nodes remain as points only, and their HUD labels are projected from
      // the same 3D coordinates so they follow the rotating Earth precisely.
      const nodePositions = REGIONS.map((region) =>
        latLonToVector3(region.lat, region.lon, 1.025),
      );

      const nodeGroup = new THREE.Group();
      earthSystem.add(nodeGroup);

      const nodes: THREE.Mesh[] = [];

      REGIONS.forEach((region, index) => {
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(
            index === 1 ? 0.035 : 0.028,
            mobile ? 8 : 11,
            mobile ? 8 : 11,
          ),
          new THREE.MeshBasicMaterial({
            color: region.color,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );

        node.position.copy(nodePositions[index]);
        nodeGroup.add(node);
        nodes.push(node);
      });

      // Orbital rings are CHILDREN of earthSystem, so the rings share the
      // exact Earth rotation and can never drift independently from it.
      const ringGroup = new THREE.Group();
      earthSystem.add(ringGroup);

      const ringOne = new THREE.Mesh(
        new THREE.TorusGeometry(1.33, 0.0065, 5, 160),
        new THREE.MeshBasicMaterial({
          color: 0x48eaff,
          transparent: true,
          opacity: 0.33,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ringOne.rotation.x = THREE.MathUtils.degToRad(64);
      ringOne.rotation.z = THREE.MathUtils.degToRad(9);
      ringOne.scale.y = 0.31;
      ringGroup.add(ringOne);

      const ringTwo = new THREE.Mesh(
        new THREE.TorusGeometry(1.46, 0.0055, 5, 160),
        new THREE.MeshBasicMaterial({
          color: 0xa35dff,
          transparent: true,
          opacity: 0.27,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ringTwo.rotation.x = THREE.MathUtils.degToRad(63);
      ringTwo.rotation.z = THREE.MathUtils.degToRad(-29);
      ringTwo.scale.y = 0.28;
      ringGroup.add(ringTwo);

      const ringThree = new THREE.Mesh(
        new THREE.TorusGeometry(1.16, 0.004, 4, 144),
        new THREE.MeshBasicMaterial({
          color: 0x2fdbff,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ringThree.rotation.x = THREE.MathUtils.degToRad(56);
      ringThree.rotation.z = THREE.MathUtils.degToRad(73);
      ringThree.scale.y = 0.20;
      ringGroup.add(ringThree);

      // Premium pedestal, also synchronized to the same earth system.
      const platform = new THREE.Group();
      platform.position.y = -1.12;
      earthSystem.add(platform);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.98, 1.08, 0.12, 80),
        new THREE.MeshStandardMaterial({
          color: 0x04101c,
          metalness: 0.90,
          roughness: 0.17,
          emissive: 0x07172b,
          emissiveIntensity: 0.34,
        }),
      );
      platform.add(base);

      const tier = new THREE.Mesh(
        new THREE.CylinderGeometry(0.80, 0.92, 0.095, 80),
        new THREE.MeshStandardMaterial({
          color: 0x071321,
          metalness: 0.94,
          roughness: 0.13,
          emissive: 0x100a30,
          emissiveIntensity: 0.28,
        }),
      );
      tier.position.y = 0.085;
      platform.add(tier);

      const baseRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.93, 0.009, 5, 136),
        new THREE.MeshBasicMaterial({
          color: 0x45eaff,
          transparent: true,
          opacity: 0.60,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      baseRing.position.y = 0.07;
      platform.add(baseRing);

      const violetRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.0055, 5, 120),
        new THREE.MeshBasicMaterial({
          color: 0xa65eff,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      violetRing.position.y = 0.135;
      platform.add(violetRing);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, mobile ? 20 : 28, mobile ? 20 : 28),
        new THREE.MeshBasicMaterial({
          color: 0x2fe5ff,
          transparent: true,
          opacity: 0.10,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      core.position.set(0, 0.05, 0.02);
      platform.add(core);

      const resize = () => {
        mobile = window.innerWidth < 760;

        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);

        camera.aspect = width / height;
        camera.fov = mobile ? 30.5 : 27;
        camera.position.set(
          0,
          mobile ? 0.01 : 0.04,
          mobile ? 5.0 : 5.2,
        );
        camera.updateProjectionMatrix();

        earthSystem.scale.setScalar(mobile ? 0.98 : 1.04);
        platform.scale.setScalar(mobile ? 0.78 : 0.92);
        root.position.y = mobile ? 0.015 : 0.05;

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

      const updateRegionLabels = () => {
        REGIONS.forEach((region, index) => {
          const element = regionRefs.current[index];
          const node = nodes[index];

          if (!element || !node) return;

          const world = new THREE.Vector3();
          node.getWorldPosition(world);

          const cameraDirection = world.clone().sub(camera.position).normalize();
          const cameraToSurface = world.clone().normalize();

          // Hide labels on the far side of the globe. This is what keeps
          // the HUD labels synchronized with the same 3D point.
          const frontFacing = cameraDirection.dot(camera.getWorldDirection(new THREE.Vector3())) > -0.45;
          const distanceFromCenter = world.length();
          const visibleByDepth = distanceFromCenter > 0.5;

          if (!frontFacing || !visibleByDepth) {
            element.style.opacity = '0';
            return;
          }

          const projected = world.clone().project(camera);

          if (
            projected.z < -1 ||
            projected.z > 1 ||
            projected.x < -1.22 ||
            projected.x > 1.22 ||
            projected.y < -1.22 ||
            projected.y > 1.22
          ) {
            element.style.opacity = '0';
            return;
          }

          const x = (projected.x * 0.5 + 0.5) * host.clientWidth;
          const y = (-projected.y * 0.5 + 0.5) * host.clientHeight;

          // Small outward offset so the label sits just beyond the node.
          const offset = cameraToSurface.multiplyScalar(12);
          const offsetScreen = offset.clone().project(camera);
          const ox = offsetScreen.x * host.clientWidth * 0.12;
          const oy = -offsetScreen.y * host.clientHeight * 0.12;

          element.style.opacity = '1';
          element.style.transform =
            `translate3d(${x + ox}px,${y + oy}px,0) translate(-50%,-50%)`;
        });
      };

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
            // SINGLE MASTER EARTH CLOCK:
            // Earth + surface nodes + synchronized orbital rings + platform
            // all move from this one system transform.
            earthSystem.rotation.y += delta * 0.080;

            stars.rotation.y += delta * 0.006;
            stars.rotation.x = Math.sin(elapsed * 0.11) * 0.010;

            ringGroup.rotation.y = Math.sin(elapsed * 0.22) * 0.025;
            ringGroup.rotation.z = Math.cos(elapsed * 0.19) * 0.018;

            platform.rotation.y = Math.sin(elapsed * 0.18) * 0.08;

            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.05);

            nodes.forEach((node, index) => {
              node.scale.setScalar(
                0.86 + pulse * 0.15 + (index === 1 ? 0.05 : 0),
              );

              (
                node.material as THREE.MeshBasicMaterial
              ).opacity = 0.62 + pulse * 0.30;
            });

            (
              atmosphere.material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.48 + pulse * 0.035;

            atmosphere.scale.setScalar(1 + pulse * 0.008);
            violetAtmosphere.scale.setScalar(1.002 + pulse * 0.010);

            (
              core.material as THREE.MeshBasicMaterial
            ).opacity = 0.075 + pulse * 0.055;

            root.rotation.y = THREE.MathUtils.lerp(
              root.rotation.y,
              pointerX * 0.038,
              0.045,
            );

            root.rotation.x = THREE.MathUtils.lerp(
              root.rotation.x,
              THREE.MathUtils.degToRad(-2.5) -
                pointerY * 0.024,
              0.045,
            );
          }

          earthMaterial.uniforms.uTime.value = elapsed;

          updateRegionLabels();
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
        placeholderTexture.dispose();
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
      aria-label="Interactive synchronized holographic Earth"
    >
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.hudGrid} aria-hidden="true" />
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

      {REGIONS.map((region, index) => (
        <div
          key={region.label}
          ref={(element) => {
            regionRefs.current[index] = element;
          }}
          className={`${styles.region} ${styles[region.className]}`}
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

      <div className={styles.asset} aria-hidden="true">
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
