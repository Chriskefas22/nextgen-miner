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

type RegionNode = {
  lat: number;
  lon: number;
  label: string;
  accent: 'cyan' | 'violet';
};

type AnimationState = {
  frame: number;
  last: number;
  started: number;
  reduced: boolean;
  mobile: boolean;
  pointerX: number;
  pointerY: number;
};

const EARTH_TEXTURE = '/assets/landing/earth-equirectangular.webp';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const REGION_NODES: RegionNode[] = [
  { lat: 45, lon: -102, label: 'AMERICAS', accent: 'cyan' },
  { lat: 49, lon: 14, label: 'EUROPE', accent: 'violet' },
  { lat: 19, lon: 104, label: 'ASIA', accent: 'cyan' },
  { lat: -6, lon: 24, label: 'AFRICA', accent: 'violet' },
  { lat: -29, lon: 135, label: 'AUSTRALIA', accent: 'cyan' },
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
  const steps = 48;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = start.clone().lerp(end, t).normalize();
    const lift = Math.sin(Math.PI * t) * (0.05 + angle * 0.05);
    points.push(point.multiplyScalar(radius + lift));
  }
  return points;
}

function createHologramEarthMaterial() {
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
        gl_Position = projectionMatrix * viewMatrix * world;
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
        float landSignal = max(tex.r - tex.b * 0.78, tex.g - tex.b * 0.68);
        float land = smoothstep(0.018, 0.105, landSignal);
        float coast = smoothstep(0.018, 0.032, landSignal) *
          (1.0 - smoothstep(0.060, 0.105, landSignal));

        vec3 ocean = mix(
          vec3(0.004, 0.024, 0.052),
          vec3(0.012, 0.105, 0.185),
          smoothstep(0.08, 0.72, luminance)
        );

        vec3 landColor = mix(
          vec3(0.045, 0.39, 0.64),
          vec3(0.24, 0.86, 0.97),
          smoothstep(0.24, 0.82, luminance)
        );

        vec3 color = mix(ocean, landColor, land);
        color += vec3(0.14, 0.65, 0.98) * coast * 0.82;

        float citySignal = smoothstep(0.58, 0.90, luminance) * land;
        color += vec3(0.72, 0.83, 0.56) * citySignal * 0.22;

        float scan = 0.955 + 0.045 * sin(vUv.y * 180.0 + uTime * 1.7);
        color *= scan;

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(
          1.0 - max(dot(normalize(vNormal), viewDir), 0.0),
          2.25
        );
        color += vec3(0.02, 0.43, 1.0) * fresnel * 1.35;

        float sweep = 0.5 + 0.5 * sin(vUv.x * 6.28318 - uTime * 0.28);
        color += vec3(0.02, 0.22, 0.48) * sweep * 0.07;

        gl_FragColor = vec4(color, 0.97);
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
        gl_Position = projectionMatrix * viewMatrix * world;
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
        float shell = smoothstep(0.06, 0.92, rim);
        gl_FragColor = vec4(uColor, shell * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function createNTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#45efff');
  gradient.addColorStop(0.5, '#f8ffff');
  gradient.addColorStop(1, '#8a48ff');

  ctx.clearRect(0, 0, 256, 256);
  ctx.save();
  ctx.shadowColor = 'rgba(53,226,255,.8)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = 'rgba(2,11,22,.86)';
  ctx.strokeStyle = 'rgba(69,226,255,.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(26, 26, 204, 204, 32);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(134,72,255,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 40, 176, 176, 26);
  ctx.stroke();
  ctx.restore();

  ctx.font = '900 112px Orbitron, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgba(65,228,255,.95)';
  ctx.shadowBlur = 20;
  ctx.fillText('N', 128, 131);

  return new THREE.CanvasTexture(canvas);
}

function makeLine(points: THREE.Vector3[], color: number, opacity: number, width = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    linewidth: width,
  });
  return new THREE.Line(geometry, material);
}

function makeStarField(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * TAU;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const radius = THREE.MathUtils.randFloat(4.5, 8.0);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x2f9dff,
    size: 0.018,
    transparent: true,
    opacity: 0.52,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

function formatTimeLabel() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

export function HolographicEarth({ metrics }: { metrics: HomeEarthMetrics }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);

  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    const host = rootRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerCapable = window.matchMedia('(pointer: fine)');
    const state: AnimationState = {
      frame: 0,
      last: performance.now(),
      started: performance.now(),
      reduced: motionQuery.matches,
      mobile: window.innerWidth < 760,
      pointerX: 0,
      pointerY: 0,
    };

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    if (!gl) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.mobile ? 1.25 : 1.55));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(state.mobile ? 32 : 29, 1, 0.1, 30);
    camera.position.set(0, 0.06, state.mobile ? 5.15 : 5.35);

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(-4);
    root.position.y = state.mobile ? 0.02 : 0.10;
    scene.add(root);

    scene.add(new THREE.AmbientLight(0x42c7ff, 1.25));

    const key = new THREE.DirectionalLight(0xbceeff, 2.2);
    key.position.set(-4, 3, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x754cff, 0.85);
    fill.position.set(3, -1, -3);
    scene.add(fill);

    const backLight = new THREE.PointLight(0x3defff, 2.0, 10);
    backLight.position.set(0, 0.8, -2);
    root.add(backLight);

    const starField = makeStarField(state.mobile ? 120 : 220);
    scene.add(starField);

    const earthSystem = new THREE.Group();
    earthSystem.scale.setScalar(state.mobile ? 0.94 : 1.02);
    root.add(earthSystem);

    const earthMaterial = createHologramEarthMaterial();
    const textureLoader = new THREE.TextureLoader();
    const placeholder = new THREE.Texture();
    earthMaterial.uniforms.uTexture.value = placeholder;

    const earthTexture = textureLoader.load(
      EARTH_TEXTURE,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
        earthMaterial.uniforms.uTexture.value = texture;
        texture.needsUpdate = true;
      },
      undefined,
      () => {},
    );

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, state.mobile ? 64 : 96, state.mobile ? 40 : 64),
      earthMaterial,
    );
    earth.rotation.y = Math.PI;
    earthSystem.add(earth);

    const grid = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, state.mobile ? 42 : 64, state.mobile ? 28 : 40),
      new THREE.MeshBasicMaterial({
        color: 0x51eaff,
        wireframe: true,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthSystem.add(grid);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.075, state.mobile ? 48 : 72, state.mobile ? 32 : 48),
      createAtmosphereMaterial(0x38e6ff, 0.55),
    );
    earthSystem.add(atmosphere);

    const innerAtmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.035, state.mobile ? 42 : 64, state.mobile ? 28 : 40),
      createAtmosphereMaterial(0x704dff, 0.12),
    );
    earthSystem.add(innerAtmosphere);

    const nodeVectors = REGION_NODES.map((region) => latLonToVector3(region.lat, region.lon, 1.025));

    const nodeGroup = new THREE.Group();
    earthSystem.add(nodeGroup);

    const nodeMeshes: THREE.Mesh[] = [];
    REGION_NODES.forEach((region, index) => {
      const color = region.accent === 'cyan' ? 0x55eaff : 0xa86aff;
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(index % 2 === 0 ? 0.033 : 0.027, state.mobile ? 8 : 10, state.mobile ? 8 : 10),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      node.position.copy(nodeVectors[index]);
      nodeGroup.add(node);
      nodeMeshes.push(node);
    });

    const routeGroup = new THREE.Group();
    earthSystem.add(routeGroup);

    const routePairs = [
      [0, 1], [1, 2], [2, 4], [4, 3], [3, 0], [1, 3],
    ];

    routePairs.forEach(([a, b], index) => {
      routeGroup.add(
        makeLine(
          makeArcPoints(nodeVectors[a], nodeVectors[b], 1.035),
          index % 2 === 0 ? 0x3defff : 0x8b4cff,
          index % 2 === 0 ? 0.27 : 0.18,
        ),
      );
    });

    const orbitalGroup = new THREE.Group();
    root.add(orbitalGroup);

    const orbitOne = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.008, 5, 160),
      new THREE.MeshBasicMaterial({
        color: 0x48e9ff,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbitOne.scale.y = 0.35;
    orbitOne.rotation.x = THREE.MathUtils.degToRad(65);
    orbitOne.rotation.z = THREE.MathUtils.degToRad(12);
    orbitalGroup.add(orbitOne);

    const orbitTwo = new THREE.Mesh(
      new THREE.TorusGeometry(1.54, 0.006, 5, 160),
      new THREE.MeshBasicMaterial({
        color: 0x9a54ff,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbitTwo.scale.y = 0.30;
    orbitTwo.rotation.x = THREE.MathUtils.degToRad(64);
    orbitTwo.rotation.z = THREE.MathUtils.degToRad(-33);
    orbitalGroup.add(orbitTwo);

    const orbitThree = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.004, 4, 144),
      new THREE.MeshBasicMaterial({
        color: 0x2fcfff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbitThree.scale.y = 0.22;
    orbitThree.rotation.x = THREE.MathUtils.degToRad(55);
    orbitThree.rotation.z = THREE.MathUtils.degToRad(72);
    orbitalGroup.add(orbitThree);

    const platform = new THREE.Group();
    platform.position.y = -1.18;
    root.add(platform);

    const platformMaterials = [
      new THREE.MeshStandardMaterial({
        color: 0x06101c,
        metalness: 0.8,
        roughness: 0.22,
        emissive: 0x041225,
        emissiveIntensity: 0.35,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x081425,
        metalness: 0.9,
        roughness: 0.16,
        emissive: 0x111039,
        emissiveIntensity: 0.42,
      }),
    ];

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.14, 0.15, 96),
      platformMaterials[0],
    );
    platform.add(base);

    const tier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.84, 0.97, 0.12, 96),
      platformMaterials[1],
    );
    tier.position.y = 0.105;
    platform.add(tier);

    const platformRingOne = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.012, 5, 144),
      new THREE.MeshBasicMaterial({
        color: 0x42e9ff,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    platformRingOne.position.y = 0.08;
    platform.add(platformRingOne);

    const platformRingTwo = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.007, 5, 128),
      new THREE.MeshBasicMaterial({
        color: 0x9b52ff,
        transparent: true,
        opacity: 0.60,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    platformRingTwo.position.y = 0.15;
    platform.add(platformRingTwo);

    const nTexture = createNTexture();
    const nSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: nTexture,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    nSprite.scale.setScalar(state.mobile ? 0.40 : 0.46);
    nSprite.position.set(0, 0, 1.08);
    root.add(nSprite);

    const ringGlow = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.018, 5, 128),
      new THREE.MeshBasicMaterial({
        color: 0x3feaff,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ringGlow.rotation.x = THREE.MathUtils.degToRad(82);
    ringGlow.position.y = -0.03;
    root.add(ringGlow);

    const labelEls = labelRefs.current;
    const regionWorldPositions = REGION_NODES.map((_, index) => nodeMeshes[index].position.clone());

    const updateLabels = () => {
      for (let index = 0; index < regionWorldPositions.length; index += 1) {
        const el = labelEls[index];
        if (!el) continue;
        const point = regionWorldPositions[index].clone();
        nodeGroup.localToWorld(point);
        point.project(camera);

        const visible = point.z < 1 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2;
        if (!visible) {
          el.style.opacity = '0';
          continue;
        }

        const x = (point.x * 0.5 + 0.5) * host.clientWidth;
        const y = (-point.y * 0.5 + 0.5) * host.clientHeight;

        el.style.opacity = '1';
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      state.mobile = width < 760;
      camera.aspect = width / height;
      camera.fov = state.mobile ? 32 : 29;
      camera.position.z = state.mobile ? 5.15 : 5.35;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.mobile ? 1.25 : 1.55));
      renderer.setSize(width, height, false);
      updateLabels();
    };

    const onMotionPreference = () => {
      state.reduced = motionQuery.matches;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerCapable.matches || state.mobile || state.reduced) return;
      const rect = host.getBoundingClientRect();
      state.pointerX = THREE.MathUtils.clamp((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5, -0.5, 0.5);
      state.pointerY = THREE.MathUtils.clamp((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5, -0.5, 0.5);
    };

    const onPointerLeave = () => {
      state.pointerX = 0;
      state.pointerY = 0;
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    motionQuery.addEventListener?.('change', onMotionPreference);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);

    const render = (now: number) => {
      const delta = Math.min(0.05, (now - state.last) / 1000);
      state.last = now;
      const elapsed = (now - state.started) * 0.001;

      if (!state.reduced) {
        earthSystem.rotation.y += delta * 0.20;
        orbitalGroup.rotation.y -= delta * 0.07;
        orbitalGroup.rotation.z += delta * 0.025;
        starField.rotation.y += delta * 0.012;
        starField.rotation.x = Math.sin(elapsed * 0.12) * 0.02;

        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.1);
        nodeMeshes.forEach((node, index) => {
          const scale = 0.86 + pulse * 0.18 + (index === 2 ? 0.06 : 0);
          node.scale.setScalar(scale);
          const material = node.material as THREE.MeshBasicMaterial;
          material.opacity = 0.62 + pulse * 0.28;
        });

        platform.rotation.y += delta * 0.025;
        orbitOne.rotation.z += delta * 0.09;
        orbitTwo.rotation.z -= delta * 0.065;
        orbitThree.rotation.z += delta * 0.05;

        ringGlow.rotation.z -= delta * 0.22;
        nSprite.material.rotation = Math.sin(elapsed * 0.35) * 0.03;

        atmosphere.scale.setScalar(1 + pulse * 0.012);
        innerAtmosphere.scale.setScalar(1.002 + pulse * 0.018);

        root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, state.pointerX * 0.045, 0.05);
        root.rotation.x = THREE.MathUtils.lerp(
          root.rotation.x,
          THREE.MathUtils.degToRad(-4) + state.pointerY * -0.03,
          0.05,
        );
      }

      earthMaterial.uniforms.uTime.value = elapsed;
      const atmosphereMaterial = atmosphere.material as THREE.ShaderMaterial;
      atmosphereMaterial.uniforms.uOpacity.value = 0.50 + Math.sin(elapsed * 1.1) * 0.04;

      const current = metricsRef.current;
      host.dataset.status = current.status.toLowerCase();
      host.dataset.asset = current.asset.toUpperCase();

      updateLabels();
      renderer.render(scene, camera);

      if (state.reduced) {
        if (!state.frame) {
          state.frame = window.requestAnimationFrame(render);
        }
      } else {
        state.frame = window.requestAnimationFrame(render);
      }
    };

    state.frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(state.frame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener?.('change', onMotionPreference);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);

      scene.traverse((object) => {
        const item = object as THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite;
        if ('geometry' in item && item.geometry) item.geometry.dispose();
        const material = 'material' in item ? item.material : null;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else if (material) material.dispose();
      });

      earthTexture.dispose();
      earthMaterial.dispose();
      nTexture.dispose();
      renderer.dispose();
    };
  }, []);

  const live = metrics.status === 'LIVE';

  return (
    <div ref={rootRef} className={styles.root} data-live={live ? 'true' : 'false'}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div className={styles.topRail} aria-hidden="true">
        <span>GLOBAL MINING NETWORK</span>
        <b><i />{live ? 'LIVE' : 'PAUSED'}</b>
      </div>

      <div className={styles.hudTopCenter} aria-hidden="true">
        <span>NEXTGEN CORE</span>
        <small>REAL-TIME NETWORK · REAL MINERS · REAL REWARDS</small>
      </div>

      <div className={styles.livePanel} aria-hidden="true">
        <strong>NETWORK {live ? 'LIVE' : 'PAUSED'}</strong>
        <small>{formatTimeLabel()}</small>
      </div>

      <div className={`${styles.metricPanel} ${styles.hashPanel}`} aria-hidden="true">
        <span>GLOBAL HASHRATE</span>
        <strong>{metrics.activeHashrate} <em>H/s</em></strong>
      </div>

      <div className={`${styles.metricPanel} ${styles.minerPanel}`} aria-hidden="true">
        <span>ACTIVE MINERS</span>
        <strong>{metrics.activeMiners}</strong>
      </div>

      <div className={`${styles.metricPanel} ${styles.outputPanel}`} aria-hidden="true">
        <span>LIVE OUTPUT</span>
        <strong>${metrics.dailyOutputUsd}</strong>
        <small>{metrics.asset.toUpperCase()} · TODAY</small>
      </div>

      <div className={styles.assetBadge} aria-hidden="true">
        <span>MINING ASSET</span>
        <b>{metrics.asset.toUpperCase()}</b>
      </div>

      {REGION_NODES.map((region, index) => (
        <div
          key={region.label}
          ref={(element) => {
            labelRefs.current[index] = element;
          }}
          className={`${styles.regionLabel} ${region.accent === 'violet' ? styles.violet : styles.cyan} ${index > 2 ? styles.mobileHidden : ''}`}
          aria-hidden="true"
        >
          <i />
          <b>{region.label}</b>
          <small>NETWORK NODE</small>
        </div>
      ))}

      <div className={styles.bottomRail} aria-hidden="true">
        <span>REAL-TIME CORE VISUAL</span>
        <b>360° / LIVE</b>
      </div>
    </div>
  );
}
