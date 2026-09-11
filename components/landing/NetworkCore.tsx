'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * NEXTGEN MINER — GLOBAL MINING NETWORK
 *
 * Real 3D Earth rendered with Three.js.
 * - Full 360° Y-axis rotation
 * - Separate atmospheric shell
 * - Rotating cloud shell using a lightweight procedural alpha shader
 * - 3D network nodes attached to Earth
 * - Independent orbital system around Earth
 * - Responsive renderer + DPR cap for mobile performance
 * - Respects prefers-reduced-motion
 *
 * Requires: three ^0.186.0
 */

const EARTH_TEXTURE = '/assets/landing/earth-equirectangular.webp';

type Point3 = { x: number; y: number; z: number };

function latLonToVector3(latitude: number, longitude: number, radius: number): Point3 {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function makeArcPoints(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const points: THREE.Vector3[] = [];
  const start = a.clone().normalize().multiplyScalar(radius);
  const end = b.clone().normalize().multiplyScalar(radius);
  const angle = start.angleTo(end);
  const steps = 32;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const slerp = start.clone().lerp(end, t);
    const lift = Math.sin(Math.PI * t) * (0.08 + angle * 0.06);
    points.push(slerp.normalize().multiplyScalar(radius + lift));
  }

  return points;
}

function createCloudMaterial() {
  const vertexShader = `
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
  `;

  const fragmentShader = `
    precision mediump float;

    uniform sampler2D uTexture;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 uv = vUv;
      uv.x += uTime * 0.0045;

      float n = noise(uv * vec2(34.0, 17.0));
      n += noise(uv * vec2(68.0, 34.0)) * 0.35;
      n = smoothstep(0.54, 0.78, n);

      float light = smoothstep(-0.15, 0.45, dot(normalize(vNormal), normalize(vec3(-0.45, 0.25, 1.0))));
      float edge = pow(1.0 - max(dot(normalize(vNormal), normalize(cameraPosition - vWorldPosition)), 0.0), 2.5);
      float alpha = n * (0.07 + light * 0.16) + edge * 0.035;

      gl_FragColor = vec4(0.55, 0.92, 1.0, alpha);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
}

function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x32dfff) },
      uPower: { value: 2.5 },
      uOpacity: { value: 0.72 },
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
        float shell = smoothstep(0.12, 0.95, rim);
        gl_FragColor = vec4(uColor, shell * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

export default function NetworkCore() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery.matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0.15, 3.6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(-7);
    scene.add(root);

    const earthGroup = new THREE.Group();
    root.add(earthGroup);

    // Lighting is intentionally cyan-biased so the globe belongs to the existing HUD.
    scene.add(new THREE.AmbientLight(0x3c78a8, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(-4.5, 2.2, 5.5);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x2ddcff, 1.35);
    fill.position.set(4, -2, 2);
    scene.add(fill);

    const loader = new THREE.TextureLoader();
    let earthTexture: THREE.Texture | null = null;
    const textureLoad = loader.load(
      EARTH_TEXTURE,
      (texture) => {
        earthTexture = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
      },
      undefined,
      () => {
        // The CSS frame remains visible if the texture cannot be loaded.
      },
    );
    earthTexture = textureLoad;
    earthTexture.colorSpace = THREE.SRGBColorSpace;

    const earthRadius = 1.0;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius, 96, 64),
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        map: earthTexture,
        shininess: 18,
        specular: new THREE.Color(0x4bdcff),
        emissive: new THREE.Color(0x042235),
        emissiveIntensity: 0.38,
      }),
    );
    earth.rotation.y = Math.PI;
    earthGroup.add(earth);

    // Very subtle wire grid gives the globe its network/HUD language.
    const grid = new THREE.Mesh(
      new THREE.SphereGeometry(1.008, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x36e6ff,
        wireframe: true,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(grid);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.075, 96, 64),
      createAtmosphereMaterial(),
    );
    earthGroup.add(atmosphere);

    const cloudMaterial = createCloudMaterial();
    const cloudShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.026, 72, 48),
      cloudMaterial,
    );
    earthGroup.add(cloudShell);

    // Attached network nodes at real latitude/longitude positions.
    const nodeData = [
      [-37, -63], [40, -74], [51, 0], [1, 103], [35, 139], [-33, 151],
      [25, 55], [-1, 36], [19, -99], [50, 14], [-6, -75], [-23, 133],
    ];

    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: 0x63f9c8,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    const nodeGeometry = new THREE.SphereGeometry(0.027, 12, 12);
    const nodes = new THREE.Group();
    nodes.position.copy(earth.position);
    earthGroup.add(nodes);

    const nodeVectors: THREE.Vector3[] = [];
    nodeData.forEach(([lat, lon]) => {
      const p = latLonToVector3(lat, lon, 1.055);
      const vector = new THREE.Vector3(p.x, p.y, p.z);
      nodeVectors.push(vector);
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
      node.position.copy(vector);
      nodes.add(node);
    });

    // Curved data routes over the globe surface.
    const routeGroup = new THREE.Group();
    earthGroup.add(routeGroup);
    const routeMaterial = new THREE.LineBasicMaterial({
      color: 0x29e8ff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const routePairs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 8], [7, 10], [8, 10], [2, 9], [5, 11]];
    routePairs.forEach(([a, b]) => {
      const curve = new THREE.CatmullRomCurve3(makeArcPoints(nodeVectors[a], nodeVectors[b], 1.055));
      const points = curve.getPoints(32);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      routeGroup.add(new THREE.Line(geometry, routeMaterial.clone()));
    });

    // Independent orbital system — visible even while Earth rotates beneath it.
    const orbitalGroup = new THREE.Group();
    root.add(orbitalGroup);

    const orbitMaterials = [
      new THREE.LineBasicMaterial({ color: 0x31e6ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }),
      new THREE.LineBasicMaterial({ color: 0xa05cff, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false }),
      new THREE.LineBasicMaterial({ color: 0x57f6c4, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
    ];

    const orbitSpecs = [
      { radius: 1.42, yScale: 0.32, rx: 0.0, rz: 0.1, speed: 0.34 },
      { radius: 1.34, yScale: 0.82, rx: Math.PI * 0.48, rz: 0.38, speed: -0.23 },
      { radius: 1.52, yScale: 0.25, rx: Math.PI * 0.52, rz: -0.7, speed: 0.18 },
    ];

    const orbitGroups: Array<{ group: THREE.LineLoop; speed: number }> = [];
    orbitSpecs.forEach((spec, index) => {
      const points: THREE.Vector3[] = [];
      const steps = 128;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(t) * spec.radius,
          Math.sin(t) * spec.radius * spec.yScale,
          0,
        ));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const loop = new THREE.LineLoop(geometry, orbitMaterials[index]);
      loop.rotation.x = spec.rx;
      loop.rotation.z = spec.rz;
      orbitalGroup.add(loop);
      orbitGroups.push({ group: loop, speed: spec.speed });
    });

    // Glowing orbital nodes.
    const orbitalNodeGroup = new THREE.Group();
    orbitalGroup.add(orbitalNodeGroup);
    const orbitalNodePositions = [
      { r: 1.50, a: 0.2, y: 0.0 },
      { r: 1.40, a: 2.2, y: 0.15 },
      { r: 1.52, a: 4.2, y: -0.12 },
      { r: 1.34, a: 5.4, y: 0.0 },
    ];
    orbitalNodePositions.forEach((item, index) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(index % 2 ? 0.022 : 0.032, 10, 10),
        new THREE.MeshBasicMaterial({
          color: index % 2 ? 0x63f9c8 : 0x3adfff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        }),
      );
      dot.position.set(Math.cos(item.a) * item.r, item.y, Math.sin(item.a) * item.r);
      orbitalNodeGroup.add(dot);
    });

    // Holographic center pulse.
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xb7ffff,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
      }),
    );
    root.add(pulse);

    const clock = new THREE.Clock();
    let raf = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const aspect = width / height;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const onReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    reducedMotionQuery.addEventListener('change', onReducedMotion);

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);
      void dt;

      if (!reducedMotion) {
        // One full 360° Earth rotation every ~20 seconds.
        earthGroup.rotation.y = elapsed * (Math.PI * 2 / 20);
        cloudShell.rotation.y = elapsed * (Math.PI * 2 / 17);
        grid.rotation.y = elapsed * (Math.PI * 2 / 20);
        nodes.rotation.y = elapsed * (Math.PI * 2 / 20);
        routeGroup.rotation.y = elapsed * (Math.PI * 2 / 20);

        orbitalGroup.rotation.y = elapsed * 0.08;
        orbitGroups.forEach((item) => {
          item.group.rotation.y = elapsed * item.speed * 0.1;
        });
        orbitalNodeGroup.rotation.y = elapsed * -0.12;

        pulse.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.18);
        cloudMaterial.uniforms.uTime.value = elapsed;
      } else {
        earthGroup.rotation.y = Math.PI * 0.12;
        cloudShell.rotation.y = Math.PI * 0.1;
        grid.rotation.y = earthGroup.rotation.y;
        nodes.rotation.y = earthGroup.rotation.y;
        routeGroup.rotation.y = earthGroup.rotation.y;
        pulse.scale.setScalar(1);
      }

      root.rotation.z = Math.sin(elapsed * 0.24) * 0.018;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    raf = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      reducedMotionQuery.removeEventListener('change', onReducedMotion);

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
      earthTexture?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} className="network-core-3d" aria-label="Rotating 3D global mining network visualization">
      <div className="network-core-3d__aura" aria-hidden="true" />
      <canvas ref={canvasRef} className="network-core-3d__canvas" aria-hidden="true" />
      <div className="network-core-3d__scan" aria-hidden="true" />
      <div className="network-core-3d__reflection" aria-hidden="true" />
    </div>
  );
}
