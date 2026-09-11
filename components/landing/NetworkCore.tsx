'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * NEXTGEN MINER — HOLOGRAPHIC GLOBAL NETWORK CORE
 *
 * A lightweight real-time 3D hologram Earth built with Three.js:
 * - True 360° Y-axis Earth rotation
 * - Cyan hologram-shaded Earth surface using the existing Earth texture as data
 * - Scanning grid + atmosphere + network nodes + data arcs
 * - One synchronized orbital system around the Earth
 * - Responsive renderer with DPR cap for Android/mobile performance
 * - Respects prefers-reduced-motion
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
  const start = a.clone().normalize();
  const end = b.clone().normalize();
  const angle = start.angleTo(end);
  const steps = 40;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = start.clone().lerp(end, t).normalize();
    const lift = Math.sin(Math.PI * t) * (0.07 + angle * 0.055);
    points.push(point.multiplyScalar(radius + lift));
  }

  return points;
}

function createHologramEarthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
      uOpacity: { value: 0.95 },
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
      uniform float uOpacity;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 tex = texture2D(uTexture, vUv).rgb;
        float luminance = dot(tex, vec3(0.299, 0.587, 0.114));
        float contrast = smoothstep(0.22, 0.88, luminance);

        vec3 deep = vec3(0.005, 0.065, 0.12);
        vec3 cyan = vec3(0.05, 0.82, 1.0);
        vec3 mint = vec3(0.48, 1.0, 0.88);
        vec3 hologram = mix(deep, cyan, contrast * 0.82);
        hologram += mint * smoothstep(0.58, 0.95, luminance) * 0.26;

        float scan = 0.82 + 0.18 * sin((vUv.y * 135.0) + (uTime * 2.6));
        hologram *= scan;

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.1);
        hologram += vec3(0.04, 0.72, 1.0) * fresnel * 1.35;

        float edge = smoothstep(0.72, 1.0, abs(vUv.y - 0.5) * 2.0);
        hologram += cyan * edge * 0.05;

        float alpha = clamp(0.48 + contrast * 0.42 + fresnel * 0.25, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(hologram, alpha);
      }
    `,
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
}

function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x31eaff) },
      uPower: { value: 2.15 },
      uOpacity: { value: 0.66 },
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
        float shell = smoothstep(0.08, 0.92, rim);
        gl_FragColor = vec4(uColor, shell * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function createPulseMaterial(color: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export default function NetworkCore() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reduceMotion.matches;

    const onMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };

    reduceMotion.addEventListener?.('change', onMotionPreference);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    camera.position.set(0, 0.08, 4.45);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      reduceMotion.removeEventListener?.('change', onMotionPreference);
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(-7);
    scene.add(root);

    const earthGroup = new THREE.Group();
    earthGroup.scale.setScalar(0.90);
    root.add(earthGroup);

    scene.add(new THREE.AmbientLight(0x3cc8ff, 1.55));

    const key = new THREE.DirectionalLight(0x9ef5ff, 2.15);
    key.position.set(-4, 3, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x306eff, 1.1);
    fill.position.set(3, -1, -2);
    scene.add(fill);

    const hologramMaterial = createHologramEarthMaterial();
    const loader = new THREE.TextureLoader();
    const earthTexture = loader.load(EARTH_TEXTURE, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      texture.needsUpdate = true;
      hologramMaterial.uniforms.uTexture.value = texture;
      hologramMaterial.needsUpdate = true;
    });
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    hologramMaterial.uniforms.uTexture.value = earthTexture;

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      hologramMaterial,
    );
    earth.rotation.y = Math.PI;
    earthGroup.add(earth);

    const grid = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 56, 36),
      new THREE.MeshBasicMaterial({
        color: 0x48ecff,
        wireframe: true,
        transparent: true,
        opacity: 0.105,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(grid);

    const innerScan = new THREE.Mesh(
      new THREE.SphereGeometry(1.022, 64, 40),
      new THREE.MeshBasicMaterial({
        color: 0x18dfff,
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(innerScan);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.075, 80, 56),
      createAtmosphereMaterial(),
    );
    earthGroup.add(atmosphere);

    const nodeData = [
      [-37, -63], [40, -74], [51, 0], [1, 103], [35, 139], [-33, 151],
      [25, 55], [-1, 36], [19, -99], [50, 14], [-6, -75], [-23, 133],
      [59, 18], [21, 105], [37, 127],
    ];

    const nodes = new THREE.Group();
    const nodeVectors: THREE.Vector3[] = [];
    earthGroup.add(nodes);

    nodeData.forEach(([latitude, longitude], index) => {
      const p = latLonToVector3(latitude, longitude, 1.045);
      const vector = new THREE.Vector3(p.x, p.y, p.z);
      nodeVectors.push(vector);

      const node = new THREE.Mesh(
        new THREE.SphereGeometry(index % 4 === 0 ? 0.033 : 0.023, 10, 10),
        createPulseMaterial(index % 3 === 0 ? 0x7dffd9 : 0x39eaff),
      );
      node.position.copy(vector);
      nodes.add(node);
    });

    const routeGroup = new THREE.Group();
    earthGroup.add(routeGroup);

    const routePairs = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [1, 8], [7, 10], [8, 10], [2, 9], [5, 11],
      [9, 12], [3, 13], [4, 14], [6, 13],
    ];

    routePairs.forEach(([a, b], index) => {
      const curve = new THREE.CatmullRomCurve3(makeArcPoints(nodeVectors[a], nodeVectors[b], 1.048));
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
      const material = new THREE.LineBasicMaterial({
        color: index % 3 === 0 ? 0x8bffff : 0x25dfff,
        transparent: true,
        opacity: index % 2 === 0 ? 0.44 : 0.27,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      routeGroup.add(new THREE.Line(geometry, material));
    });

    // One master orbital group keeps every external hologram orbit synchronized.
    const orbitSystem = new THREE.Group();
    root.add(orbitSystem);

    const orbitSpecs = [
      { radius: 1.34, yScale: 0.30, rotationX: 0.08, rotationZ: 0.14, color: 0x2fe7ff, opacity: 0.46 },
      { radius: 1.44, yScale: 0.74, rotationX: 0.78, rotationZ: -0.34, color: 0xa55dff, opacity: 0.28 },
      { radius: 1.54, yScale: 0.22, rotationX: 0.62, rotationZ: 0.68, color: 0x5ef4d0, opacity: 0.23 },
    ];

    orbitSpecs.forEach((spec) => {
      const points: THREE.Vector3[] = [];
      const steps = 160;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(t) * spec.radius,
          Math.sin(t) * spec.radius * spec.yScale,
          0,
        ));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const loop = new THREE.LineLoop(geometry, material);
      loop.rotation.x = spec.rotationX;
      loop.rotation.z = spec.rotationZ;
      orbitSystem.add(loop);
    });

    const orbitalNodes = new THREE.Group();
    orbitSystem.add(orbitalNodes);
    [
      [1.48, 0.2, 0.02],
      [1.39, 2.25, 0.05],
      [1.54, 4.18, -0.06],
      [1.43, 5.45, 0.08],
    ].forEach(([radius, angle, y], index) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(index % 2 === 0 ? 0.031 : 0.022, 10, 10),
        createPulseMaterial(index % 2 === 0 ? 0x44eaff : 0x8cffd9),
      );
      dot.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      orbitalNodes.add(dot);
    });

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x5cffff,
        transparent: true,
        opacity: 0.065,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(pulse);

    let animationFrame = 0;
    let lastFrame = performance.now();

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const render = (now: number) => {
      const delta = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      if (!reducedMotion) {
        earthGroup.rotation.y += delta * 0.25;
        grid.rotation.y -= delta * 0.045;
        innerScan.rotation.y += delta * 0.075;
        atmosphere.rotation.y += delta * 0.028;
        orbitSystem.rotation.y += delta * 0.17;
        orbitalNodes.rotation.z += delta * 0.03;
        pulse.scale.setScalar(1 + Math.sin(now * 0.0018) * 0.055);
      }

      const time = now * 0.001;
      hologramMaterial.uniforms.uTime.value = time;
      const atmosphereMaterial = atmosphere.material as THREE.ShaderMaterial;
      atmosphereMaterial.uniforms.uOpacity.value = 0.6 + (Math.sin(time * 1.2) * 0.08 + 0.08);

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      reduceMotion.removeEventListener?.('change', onMotionPreference);

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else if (material) {
          material.dispose();
        }
      });

      earthTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} className="network-core-3d" aria-label="Interactive holographic Earth">
      <div className="network-core-3d__hologram-glow" aria-hidden="true" />
      <canvas ref={canvasRef} className="network-core-3d__canvas" aria-hidden="true" />
      <div className="network-core-3d__scan" aria-hidden="true" />
      <div className="network-core-3d__reflection" aria-hidden="true" />
      <div className="network-core-3d__hud-corner corner-a" aria-hidden="true" />
      <div className="network-core-3d__hud-corner corner-b" aria-hidden="true" />
      <div className="network-core-3d__label" aria-hidden="true">LIVE PLANETARY NODE MAP</div>
    </div>
  );
}
