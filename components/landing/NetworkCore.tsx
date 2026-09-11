'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * NEXTGEN MINER — GLOBAL MINING NETWORK
 * V7: holographic Earth with visible landmasses + synchronized surface nodes.
 * Real WebGL 3D, optimized for mobile, one master animation clock.
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
  const steps = 36;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = start.clone().lerp(end, t).normalize();
    const lift = Math.sin(Math.PI * t) * (0.055 + angle * 0.045);
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

        // Land is naturally warmer/greener than the blue ocean in the source map.
        float landSignal = max(tex.r - tex.b * 0.78, tex.g - tex.b * 0.68);
        float land = smoothstep(0.018, 0.105, landSignal);
        float coast = smoothstep(0.018, 0.032, landSignal) * (1.0 - smoothstep(0.060, 0.105, landSignal));
        float cloud = smoothstep(0.76, 0.96, luminance) * (1.0 - land) * 0.32;

        // Deep holographic ocean.
        vec3 ocean = mix(
          vec3(0.004, 0.032, 0.065),
          vec3(0.015, 0.16, 0.24),
          smoothstep(0.10, 0.72, luminance)
        );

        // Bright cyan/mint land silhouette, preserving geography from the equirectangular map.
        vec3 landColor = mix(
          vec3(0.06, 0.72, 0.96),
          vec3(0.56, 1.0, 0.88),
          smoothstep(0.22, 0.82, luminance)
        );

        vec3 color = mix(ocean, landColor, land);
        color += vec3(0.18, 0.92, 1.0) * coast * 0.78;
        color += vec3(0.16, 0.72, 0.86) * cloud;

        // Fine hologram scan modulation.
        float scan = 0.93 + 0.07 * sin(vUv.y * 210.0 + uTime * 2.0);
        color *= scan;

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.3);
        color += vec3(0.03, 0.62, 1.0) * fresnel * 1.25;

        // Mild longitude shimmer makes the globe feel holographic without washing out land.
        float sweep = smoothstep(0.0, 1.0, sin((vUv.x * 6.28318) - uTime * 0.35) * 0.5 + 0.5);
        color += vec3(0.02, 0.30, 0.55) * sweep * 0.06;

        float alpha = 0.96;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
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
    opacity: 0.88,
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

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const onMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    motionQuery.addEventListener?.('change', onMotionPreference);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.set(0, 0.06, 4.8);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      motionQuery.removeEventListener?.('change', onMotionPreference);
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(-5);
    scene.add(root);

    const earthGroup = new THREE.Group();
    earthGroup.scale.setScalar(0.84);
    root.add(earthGroup);

    scene.add(new THREE.AmbientLight(0x3cc8ff, 1.55));
    const key = new THREE.DirectionalLight(0xa6f7ff, 2.45);
    key.position.set(-4, 3, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x276cff, 1.0);
    fill.position.set(3, -1, -2);
    scene.add(fill);

    const loader = new THREE.TextureLoader();
    const hologramMaterial = createHologramEarthMaterial();
    const earthTexture = loader.load(EARTH_TEXTURE, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      texture.needsUpdate = true;
      hologramMaterial.uniforms.uTexture.value = texture;
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
      new THREE.SphereGeometry(1.014, 64, 40),
      new THREE.MeshBasicMaterial({
        color: 0x64efff,
        wireframe: true,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(grid);

    const latitudeGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.026, 72, 48),
      new THREE.MeshBasicMaterial({
        color: 0x25dfff,
        transparent: true,
        opacity: 0.035,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(latitudeGlow);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.078, 80, 56),
      createAtmosphereMaterial(),
    );
    earthGroup.add(atmosphere);

    const nodeData = [
      [-37, -63], [40, -74], [51, 0], [1, 103], [35, 139], [-33, 151],
      [25, 55], [-1, 36], [19, -99], [50, 14], [-6, -75], [-23, 133],
      [59, 18], [21, 105], [37, 127], [64, -145], [28, 77],
    ];

    const nodes = new THREE.Group();
    const nodeVectors: THREE.Vector3[] = [];
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeMaterials: THREE.MeshBasicMaterial[] = [];
    earthGroup.add(nodes);

    nodeData.forEach(([latitude, longitude], index) => {
      const p = latLonToVector3(latitude, longitude, 1.048);
      const vector = new THREE.Vector3(p.x, p.y, p.z);
      nodeVectors.push(vector);

      const material = createPulseMaterial(index % 3 === 0 ? 0x79ffe0 : 0x35eaff);
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(index % 5 === 0 ? 0.034 : 0.022, 10, 10),
        material,
      );
      node.position.copy(vector);
      nodeMeshes.push(node);
      nodeMaterials.push(material);
      nodes.add(node);
    });

    const routeGroup = new THREE.Group();
    earthGroup.add(routeGroup);
    const routePairs = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 8], [7, 10],
      [8, 10], [2, 9], [5, 11], [9, 12], [3, 13], [4, 14], [6, 13],
      [8, 16], [3, 14], [12, 15],
    ];

    routePairs.forEach(([a, b], index) => {
      const curve = new THREE.CatmullRomCurve3(makeArcPoints(nodeVectors[a], nodeVectors[b], 1.048));
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
      const material = new THREE.LineBasicMaterial({
        color: index % 4 === 0 ? 0x8fffff : 0x25dfff,
        transparent: true,
        opacity: index % 2 === 0 ? 0.34 : 0.20,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      routeGroup.add(new THREE.Line(geometry, material));
    });

    // V7: no independent orbital nodes. Surface nodes and routes stay attached
    // to the Earth, so their movement remains physically coherent with the globe.

    const centerPulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x56eeff,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    earthGroup.add(centerPulse);

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

      const time = now * 0.001;
      if (!reducedMotion) {
        // Single master clock: Earth, surface points and routes move as one system.
        earthGroup.rotation.y += delta * 0.20;

        const pulseWave = (Math.sin(time * 2.15) + 1) * 0.5;
        const nodeScale = 0.88 + pulseWave * 0.16;
        const nodeOpacity = 0.64 + pulseWave * 0.30;
        nodeMeshes.forEach((node, index) => {
          const localScale = nodeScale * (index % 5 === 0 ? 1.10 : 1.0);
          node.scale.setScalar(localScale);
          nodeMaterials[index].opacity = nodeOpacity;
        });

        const routePulse = 0.16 + pulseWave * 0.16;
        routeGroup.traverse((object) => {
          const line = object as THREE.Line;
          if (line.material && !Array.isArray(line.material)) {
            (line.material as THREE.LineBasicMaterial).opacity = routePulse;
          }
        });

        centerPulse.scale.setScalar(1 + pulseWave * 0.055);
      }

      hologramMaterial.uniforms.uTime.value = time;
      const atmosphereMaterial = atmosphere.material as THREE.ShaderMaterial;
      atmosphereMaterial.uniforms.uOpacity.value =
        0.54 + (Math.sin(time * 1.2) * 0.055 + 0.055);

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener?.('change', onMotionPreference);

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material) material.dispose();
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
