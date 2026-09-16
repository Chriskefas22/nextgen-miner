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
  key: 'americas' | 'europe' | 'asia' | 'africa' | 'australia';
  lat: number;
  lon: number;
  label: string;
  color: number;
};

type RegionRuntime = {
  anchor: THREE.Object3D;
  dot: THREE.Mesh;
  active: boolean;
};

const EARTH_TEXTURE = '/assets/landing/earth-equirectangular.webp';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/*
 * Region coordinates are intentional and stable. They are not random.
 * The same 3D anchors drive:
 *  1) the surface node,
 *  2) the connector line,
 *  3) the HTML label projection.
 */
const REGIONS: Region[] = [
  { key: 'americas', lat: 26, lon: -92, label: 'AMERICAS', color: 0x47eaff },
  { key: 'europe', lat: 49, lon: 12, label: 'EUROPE', color: 0xa763ff },
  { key: 'asia', lat: 28, lon: 103, label: 'ASIA', color: 0x47eaff },
  { key: 'africa', lat: -5, lon: 24, label: 'AFRICA', color: 0xa763ff },
  { key: 'australia', lat: -27, lon: 134, label: 'AUSTRALIA', color: 0x47eaff },
];

function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number,
) {
  const phi = (90 - latitude) * DEG;
  const theta = (longitude + 180) * DEG;

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(
    32,
    32,
    1,
    32,
    32,
    32,
  );

  gradient.addColorStop(0, 'rgba(225,255,255,1)');
  gradient.addColorStop(0.10, 'rgba(71,234,255,.95)');
  gradient.addColorStop(0.32, 'rgba(71,204,255,.38)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEarthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

    fragmentShader: `
      precision highp float;

      uniform sampler2D uTexture;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 tex = texture2D(uTexture, vUv).rgb;

        float lum = dot(
          tex,
          vec3(0.299, 0.587, 0.114)
        );

        float landSignal = max(
          tex.r - tex.b * 0.78,
          tex.g - tex.b * 0.68
        );

        float land = smoothstep(
          0.012,
          0.095,
          landSignal
        );

        float coast = smoothstep(
          0.012,
          0.030,
          landSignal
        ) * (
          1.0 - smoothstep(
            0.052,
            0.095,
            landSignal
          )
        );

        vec3 ocean = mix(
          vec3(0.001, 0.008, 0.020),
          vec3(0.008, 0.082, 0.175),
          smoothstep(0.05, 0.76, lum)
        );

        vec3 landColor = mix(
          vec3(0.018, 0.22, 0.46),
          vec3(0.075, 0.62, 0.88),
          smoothstep(0.18, 0.82, lum)
        );

        vec3 color = mix(
          ocean,
          landColor,
          land
        );

        color += vec3(0.035, 0.36, 0.84)
          * coast
          * 0.62;

        float city = smoothstep(
          0.73,
          0.97,
          lum
        ) * land;

        color += vec3(
          0.86,
          0.72,
          0.42
        ) * city * 0.12;

        float scan = 0.982 +
          0.018 * sin(
            vUv.y * 180.0 +
            uTime * 1.15
          );

        color *= scan;

        vec3 viewDir = normalize(
          cameraPosition -
          vWorldPosition
        );

        float facing = max(
          dot(
            normalize(vWorldNormal),
            viewDir
          ),
          0.0
        );

        float rim = pow(
          1.0 - facing,
          2.38
        );

        color += vec3(
          0.008,
          0.30,
          0.86
        ) * rim * 0.90;

        gl_FragColor = vec4(
          color,
          0.985
        );
      }
    `,

    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
  });
}

function createAtmosphereMaterial(
  color: number,
  opacity: number,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: {
        value: new THREE.Color(color),
      },
      uOpacity: {
        value: opacity,
      },
    },

    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition =
          modelMatrix * vec4(position, 1.0);

        vWorldPosition = worldPosition.xyz;

        vWorldNormal =
          normalize(
            mat3(modelMatrix) * normal
          );

        gl_Position =
          projectionMatrix *
          viewMatrix *
          worldPosition;
      }
    `,

    fragmentShader: `
      precision highp float;

      uniform vec3 uColor;
      uniform float uOpacity;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(
          vWorldNormal
        );

        vec3 viewDir = normalize(
          cameraPosition -
          vWorldPosition
        );

        float rim = pow(
          1.0 - max(
            dot(normal, viewDir),
            0.0
          ),
          2.4
        );

        float shell = smoothstep(
          0.025,
          0.84,
          rim
        );

        gl_FragColor = vec4(
          uColor,
          shell * uOpacity
        );
      }
    `,

    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function createSurfaceRing(
  radius: number,
  latitude: number,
  longitudeOffset: number,
  color: number,
  opacity: number,
  segments = 180,
) {
  const points: THREE.Vector3[] = [];
  const lat = latitude * DEG;
  const y = Math.sin(lat) * radius;
  const ringRadius = Math.cos(lat) * radius;

  for (let i = 0; i <= segments; i += 1) {
    const lon =
      (i / segments) * TAU +
      longitudeOffset;

    points.push(
      new THREE.Vector3(
        ringRadius * Math.cos(lon),
        y,
        ringRadius * Math.sin(lon),
      ),
    );
  }

  const geometry =
    new THREE.BufferGeometry().setFromPoints(
      points,
    );

  const material =
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  return new THREE.Line(
    geometry,
    material,
  );
}

function createGreatCircle(
  radius: number,
  tiltX: number,
  tiltY: number,
  tiltZ: number,
  color: number,
  opacity: number,
  segments = 180,
) {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle =
      (i / segments) * TAU;

    const point = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0,
    );

    point.applyEuler(
      new THREE.Euler(
        tiltX,
        tiltY,
        tiltZ,
      ),
    );

    points.push(point);
  }

  const geometry =
    new THREE.BufferGeometry().setFromPoints(
      points,
    );

  const material =
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  return new THREE.LineLoop(
    geometry,
    material,
  );
}

function makeStarField(
  count: number,
) {
  const positions =
    new Float32Array(count * 3);

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const theta =
      Math.random() * TAU;

    const z =
      THREE.MathUtils.randFloatSpread(
        2,
      );

    const xy = Math.sqrt(
      Math.max(
        0,
        1 - z * z,
      ),
    );

    const radius =
      THREE.MathUtils.randFloat(
        5.8,
        8.8,
      );

    positions[i * 3] =
      radius *
      xy *
      Math.cos(theta);

    positions[i * 3 + 1] =
      radius * z;

    positions[i * 3 + 2] =
      radius *
      xy *
      Math.sin(theta);
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      positions,
      3,
    ),
  );

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x5eb2ff,
      size: 0.010,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeConnectorCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  lift = 0.08,
) {
  const middle = from
    .clone()
    .add(to)
    .multiplyScalar(0.5);

  middle.normalize()
    .multiplyScalar(
      Math.max(
        from.length(),
        to.length(),
      ) + lift,
    );

  const curve =
    new THREE.QuadraticBezierCurve3(
      from,
      middle,
      to,
    );

  const geometry =
    new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(30),
    );

  const material =
    new THREE.LineBasicMaterial({
      color: 0x59e7ff,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  return new THREE.Line(
    geometry,
    material,
  );
}

function makeRegionNode(
  position: THREE.Vector3,
  color: number,
) {
  const group =
    new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.RingGeometry(
      0.032,
      0.046,
      28,
    ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.018,
      8,
      8,
    ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  outer.rotation.set(
    Math.PI / 2,
    0,
    0,
  );

  inner.position.copy(
    position,
  );

  outer.position.copy(
    position,
  );

  group.add(
    outer,
    inner,
  );

  return {
    group,
    dot: inner,
  };
}

function disposeObject(
  object: THREE.Object3D,
) {
  object.traverse(
    (child) => {
      const item =
        child as
          | THREE.Mesh
          | THREE.Line
          | THREE.Points
          | THREE.Sprite;

      if (
        'geometry' in item &&
        item.geometry
      ) {
        item.geometry.dispose();
      }

      if (
        'material' in item &&
        item.material
      ) {
        if (
          Array.isArray(
            item.material,
          )
        ) {
          item.material.forEach(
            (material) =>
              material.dispose(),
          );
        } else {
          item.material.dispose();
        }
      }
    },
  );
}

export function HolographicEarth({
  metrics,
}: {
  metrics: HomeEarthMetrics;
}) {
  const hostRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const regionRefs =
    useRef<
      Array<HTMLDivElement | null>
    >([]);

  const metricsRef =
    useRef(metrics);

  metricsRef.current =
    metrics;

  useEffect(() => {
    const host =
      hostRef.current;

    const canvas =
      canvasRef.current;

    if (!host || !canvas) {
      return;
    }

    let renderer:
      | THREE.WebGLRenderer
      | null = null;

    let animationFrame = 0;
    let disposed = false;
    let mobile =
      window.innerWidth < 760;

    let reducedMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    let dragging = false;
    let pointerId:
      | number
      | null = null;

    let lastPointerX = 0;
    let lastPointerY = 0;

    let angularVelocity = 0;

    let rotationY =
      THREE.MathUtils.degToRad(
        100,
      );

    let targetRotationY =
      rotationY;

    let rotationX =
      THREE.MathUtils.degToRad(
        -3,
      );

    let targetRotationX =
      rotationX;

    let lastTime =
      performance.now();

    const motionQuery =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      );

    try {
      renderer =
        new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference:
            'high-performance',
          preserveDrawingBuffer:
            false,
        });

      renderer.setClearColor(
        0x000000,
        0,
      );

      renderer.outputColorSpace =
        THREE.SRGBColorSpace;

      renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

      renderer.toneMappingExposure =
        1.05;

      const scene =
        new THREE.Scene();

      const camera =
        new THREE.PerspectiveCamera(
          29,
          1,
          0.1,
          30,
        );

      camera.position.set(
        0,
        0.02,
        mobile ? 4.32 : 4.0,
      );

      /*
       * SINGLE MASTER TRANSFORM.
       * Earth, atmosphere, subtle grid, nodes,
       * surface rings and region anchors are all
       * children of synchronizedSystem.
       */
      const synchronizedSystem =
        new THREE.Group();

      synchronizedSystem.rotation.x =
        rotationX;

      scene.add(
        synchronizedSystem,
      );

      const key =
        new THREE.DirectionalLight(
          0xcffaff,
          2.25,
        );

      key.position.set(
        -4,
        4,
        6,
      );

      scene.add(key);

      const fill =
        new THREE.DirectionalLight(
          0x7956ff,
          0.42,
        );

      fill.position.set(
        3,
        -2,
        -3,
      );

      scene.add(fill);

      scene.add(
        new THREE.AmbientLight(
          0x3dbbff,
          0.86,
        ),
      );

      const stars =
        makeStarField(
          mobile ? 70 : 125,
        );

      scene.add(stars);

      const earthMaterial =
        createEarthMaterial();

      const fallbackTexture =
        new THREE.DataTexture(
          new Uint8Array([
            4,
            19,
            42,
            255,
          ]),
          1,
          1,
          THREE.RGBAFormat,
        );

      fallbackTexture.colorSpace =
        THREE.SRGBColorSpace;

      fallbackTexture.needsUpdate =
        true;

      earthMaterial.uniforms.uTexture.value =
        fallbackTexture;

      const loader =
        new THREE.TextureLoader();

      const earthTexture =
        loader.load(
          EARTH_TEXTURE,
          (texture) => {
            texture.colorSpace =
              THREE.SRGBColorSpace;

            texture.anisotropy =
              Math.min(
                renderer
                  ?.capabilities
                  .getMaxAnisotropy() ??
                  1,
                mobile ? 2 : 4,
              );

            earthMaterial
              .uniforms.uTexture.value =
              texture;

            texture.needsUpdate =
              true;
          },
          undefined,
          () => {
            console.warn(
              '[HomeEarth] Earth texture failed to load; fallback retained.',
            );
          },
        );

      const earth =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1,
            mobile ? 64 : 96,
            mobile ? 44 : 64,
          ),
          earthMaterial,
        );

      earth.position.y =
        0.10;

      synchronizedSystem.add(
        earth,
      );

      const earthGrid =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.006,
            mobile ? 32 : 48,
            mobile ? 22 : 30,
          ),
          new THREE.MeshBasicMaterial(
            {
              color: 0x5bdfff,
              wireframe: true,
              transparent: true,
              opacity: 0.014,
              depthWrite: false,
              blending:
                THREE.AdditiveBlending,
            },
          ),
        );

      earthGrid.position.y =
        0.10;

      synchronizedSystem.add(
        earthGrid,
      );

      const glow =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.038,
            mobile ? 38 : 56,
            mobile ? 26 : 36,
          ),
          new THREE.MeshBasicMaterial(
            {
              color: 0x17c9ff,
              transparent: true,
              opacity: 0.046,
              side: THREE.BackSide,
              depthWrite: false,
              blending:
                THREE.AdditiveBlending,
            },
          ),
        );

      glow.position.y =
        0.10;

      synchronizedSystem.add(
        glow,
      );

      const atmosphere =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.062,
            mobile ? 42 : 62,
            mobile ? 28 : 40,
          ),
          createAtmosphereMaterial(
            0x35e9ff,
            0.40,
          ),
        );

      atmosphere.position.y =
        0.10;

      synchronizedSystem.add(
        atmosphere,
      );

      const violetAtmosphere =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.040,
            mobile ? 38 : 54,
            mobile ? 26 : 36,
          ),
          createAtmosphereMaterial(
            0xa763ff,
            0.08,
          ),
        );

      violetAtmosphere.position.y =
        0.10;

      synchronizedSystem.add(
        violetAtmosphere,
      );

      /*
       * Surface rings are real 3D lines just above
       * the Earth. No large off-globe TorusGeometry,
       * so nothing can create the old "trails through
       * the bottom" effect.
       */
      const surfaceRings =
        new THREE.Group();

      surfaceRings.position.y =
        0.10;

      synchronizedSystem.add(
        surfaceRings,
      );

      surfaceRings.add(
        createSurfaceRing(
          1.018,
          30,
          0.20,
          0x47eaff,
          0.10,
          mobile ? 128 : 180,
        ),
      );

      surfaceRings.add(
        createSurfaceRing(
          1.018,
          -8,
          -0.48,
          0xa763ff,
          0.075,
          mobile ? 128 : 180,
        ),
      );

      surfaceRings.add(
        createSurfaceRing(
          1.018,
          -33,
          0.12,
          0x47eaff,
          0.055,
          mobile ? 128 : 180,
        ),
      );

      /*
       * Only two subtle great-circle bands.
       * They wrap the globe and are never projected
       * as long vertical rays.
       */
      const orbitBands =
        new THREE.Group();

      synchronizedSystem.add(
        orbitBands,
      );

      const orbitA =
        createGreatCircle(
          1.055,
          THREE.MathUtils.degToRad(
            63,
          ),
          THREE.MathUtils.degToRad(
            8,
          ),
          THREE.MathUtils.degToRad(
            -12,
          ),
          0x46e8ff,
          0.105,
          mobile ? 128 : 180,
        );

      const orbitB =
        createGreatCircle(
          1.07,
          THREE.MathUtils.degToRad(
            -54,
          ),
          THREE.MathUtils.degToRad(
            20,
          ),
          THREE.MathUtils.degToRad(
            24,
          ),
          0xa763ff,
          0.075,
          mobile ? 128 : 180,
        );

      orbitBands.add(
        orbitA,
        orbitB,
      );

      /*
       * Region network is controlled by the five real
       * regions, not by random points. Each region gets
       * one surface node + one nearby connector line.
       */
      const regionRoot =
        new THREE.Group();

      regionRoot.position.y =
        0.10;

      synchronizedSystem.add(
        regionRoot,
      );

      const regionRuntime =
        new Map<
          Region['key'],
          RegionRuntime
        >();

      const center =
        new THREE.Vector3(
          0,
          0.10,
          0,
        );

      REGIONS.forEach(
        (region) => {
          const surfacePosition =
            latLonToVector3(
              region.lat,
              region.lon,
              1.024,
            );

          const node =
            makeRegionNode(
              surfacePosition,
              region.color,
            );

          const anchor =
            new THREE.Object3D();

          anchor.position.copy(
            surfacePosition,
          );

          regionRoot.add(
            anchor,
          );

          regionRoot.add(
            node.group,
          );

          const connector =
            makeConnectorCurve(
              surfacePosition,
              surfacePosition
                .clone()
                .normalize()
                .multiplyScalar(
                  1.075,
                ),
              0.035,
            );

          connector.position.y =
            0;

          regionRoot.add(
            connector,
          );

          regionRuntime.set(
            region.key,
            {
              anchor,
              dot: node.dot,
              active: true,
            },
          );
        },
      );

      const resize =
        () => {
          if (!renderer) {
            return;
          }

          mobile =
            window.innerWidth < 760;

          const rect =
            host.getBoundingClientRect();

          const width =
            Math.max(
              1,
              rect.width,
            );

          const height =
            Math.max(
              420,
              rect.height,
            );

          camera.aspect =
            width / height;

          camera.fov =
            mobile
              ? 32
              : 29;

          camera.position.z =
            mobile
              ? 4.32
              : 4.0;

          camera.updateProjectionMatrix();

          renderer.setPixelRatio(
            Math.min(
              window.devicePixelRatio ||
                1,
              mobile
                ? 1.20
                : 1.45,
            ),
          );

          renderer.setSize(
            width,
            height,
            false,
          );
        };

      const pointerDown =
        (event: PointerEvent) => {
          if (
            event.pointerType ===
            'mouse' &&
            event.button !== 0
          ) {
            return;
          }

          dragging = true;
          pointerId =
            event.pointerId;

          lastPointerX =
            event.clientX;

          lastPointerY =
            event.clientY;

          angularVelocity = 0;

          try {
            canvas.setPointerCapture(
              event.pointerId,
            );
          } catch {
            // Pointer capture is optional.
          }
        };

      const pointerMove =
        (event: PointerEvent) => {
          if (
            !dragging ||
            pointerId !==
              event.pointerId
          ) {
            return;
          }

          const dx =
            event.clientX -
            lastPointerX;

          const dy =
            event.clientY -
            lastPointerY;

          lastPointerX =
            event.clientX;

          lastPointerY =
            event.clientY;

          targetRotationY +=
            dx * 0.0058;

          targetRotationX =
            THREE.MathUtils.clamp(
              targetRotationX +
                dy * 0.0021,
              THREE.MathUtils.degToRad(
                -18,
              ),
              THREE.MathUtils.degToRad(
                18,
              ),
            );

          angularVelocity =
            dx * 0.0009;
        };

      const pointerUp =
        (event: PointerEvent) => {
          if (
            pointerId !==
            event.pointerId
          ) {
            return;
          }

          dragging = false;
          pointerId = null;

          try {
            canvas.releasePointerCapture(
              event.pointerId,
            );
          } catch {
            // No-op.
          }
        };

      const onWheel =
        (event: WheelEvent) => {
          const next =
            camera.position.z +
            event.deltaY * 0.0013;

          camera.position.z =
            THREE.MathUtils.clamp(
              next,
              mobile
                ? 3.68
                : 3.45,
              mobile
                ? 4.85
                : 4.70,
            );

          camera.updateProjectionMatrix();
        };

      const onMotionChange =
        (
          event: MediaQueryListEvent,
        ) => {
          reducedMotion =
            event.matches;
        };

      const projectRegions =
        (now: number) => {
          const status =
            metricsRef.current
              .status;

          REGIONS.forEach(
            (
              region,
              index,
            ) => {
              const runtime =
                regionRuntime.get(
                  region.key,
                );

              const element =
                regionRefs.current[
                  index
                ];

              if (
                !runtime ||
                !element
              ) {
                return;
              }

              const world =
                runtime.anchor
                  .getWorldPosition(
                    new THREE.Vector3(),
                  );

              const normal =
                world
                  .clone()
                  .sub(
                    synchronizedSystem.getWorldPosition(
                      new THREE.Vector3(),
                    ),
                  )
                  .normalize();

              const toCamera =
                camera.position
                  .clone()
                  .sub(world)
                  .normalize();

              /*
               * Positive means the anchor faces the
               * camera. Back-side labels fade out.
               */
              const depth =
                normal.dot(
                  toCamera,
                );

              const projected =
                world.clone().project(
                  camera,
                );

              const x =
                (projected.x * 0.5 + 0.5) *
                100;

              const y =
                (-projected.y * 0.5 + 0.5) *
                100;

              const safe =
                x > -8 &&
                x < 108 &&
                y > 13 &&
                y < 88;

              const visible =
                depth > 0.10 &&
                projected.z < 1 &&
                safe;

              const alpha =
                visible
                  ? Math.min(
                      1,
                      Math.max(
                        0,
                        (depth - 0.10) /
                          0.22,
                      ),
                    )
                  : 0;

              /*
               * HUD guard zones. Region labels are not
               * allowed to occupy the top/bottom rails.
               */
              const topHudBlocked =
                y < (mobile ? 18 : 14);

              const bottomHudBlocked =
                y > (mobile ? 82 : 84);

              const hiddenByHud =
                topHudBlocked ||
                bottomHudBlocked;

              element.style.left =
                `${x}%`;

              element.style.top =
                `${y}%`;

              element.style.opacity =
                hiddenByHud
                  ? '0'
                  : alpha.toFixed(3);

              element.style.visibility =
                hiddenByHud ||
                alpha <= 0.01
                  ? 'hidden'
                  : 'visible';

              const pulse =
                0.88 +
                Math.sin(
                  now * 0.0024 +
                    index *
                      1.13,
                ) *
                  0.12;

              element.style.setProperty(
                '--region-pulse',
                pulse.toFixed(3),
              );

              runtime.dot.scale.setScalar(
                0.86 +
                  (pulse - 0.88) *
                    1.8,
              );

              (
                runtime.dot
                  .material as THREE.MeshBasicMaterial
              ).opacity =
                0.48 +
                (pulse - 0.88) *
                  1.35;

              /*
               * Visual status remains truthful:
               * PAUSED is a softer presentation, not a
               * fake "online" state.
               */
              element.dataset.status =
                status.toLowerCase();
            },
          );
        };

      resize();

      const observer =
        new ResizeObserver(
          resize,
        );

      observer.observe(host);

      window.addEventListener(
        'resize',
        resize,
      );

      canvas.addEventListener(
        'pointerdown',
        pointerDown,
      );

      canvas.addEventListener(
        'pointermove',
        pointerMove,
      );

      canvas.addEventListener(
        'pointerup',
        pointerUp,
      );

      canvas.addEventListener(
        'pointercancel',
        pointerUp,
      );

      canvas.addEventListener(
        'wheel',
        onWheel,
        { passive: true },
      );

      motionQuery.addEventListener(
        'change',
        onMotionChange,
      );

      const render =
        (now: number) => {
          if (
            disposed ||
            !renderer
          ) {
            return;
          }

          const delta =
            Math.min(
              0.05,
              (now - lastTime) /
                1000,
            );

          lastTime = now;

          if (!dragging) {
            if (
              !reducedMotion
            ) {
              targetRotationY +=
                delta *
                (mobile
                  ? 0.050
                  : 0.036);
            }

            if (
              Math.abs(
                angularVelocity,
              ) > 0.00001
            ) {
              targetRotationY +=
                angularVelocity;

              angularVelocity *=
                Math.pow(
                  0.035,
                  delta,
                );
            }
          }

          rotationY =
            THREE.MathUtils.lerp(
              rotationY,
              targetRotationY,
              1 -
                Math.pow(
                  0.0006,
                  delta,
                ),
            );

          rotationX =
            THREE.MathUtils.lerp(
              rotationX,
              targetRotationX,
              1 -
                Math.pow(
                  0.0012,
                  delta,
                ),
            );

          synchronizedSystem.rotation.y =
            rotationY;

          synchronizedSystem.rotation.x =
            rotationX;

          earthMaterial.uniforms.uTime.value =
            now * 0.001;

          if (!reducedMotion) {
            stars.rotation.y +=
              delta * 0.0035;

            const pulse =
              0.5 +
              0.5 *
                Math.sin(
                  now * 0.0019,
                );

            (
              atmosphere
                .material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.37 +
              pulse * 0.045;

            (
              violetAtmosphere
                .material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.065 +
              pulse * 0.018;

            (
              surfaceRings.children[
                0
              ]
                .material as THREE.LineBasicMaterial
            ).opacity =
              0.082 +
              pulse * 0.020;

            (
              surfaceRings.children[
                1
              ]
                .material as THREE.LineBasicMaterial
            ).opacity =
              0.060 +
              pulse * 0.018;

            (
              surfaceRings.children[
                2
              ]
                .material as THREE.LineBasicMaterial
            ).opacity =
              0.044 +
              pulse * 0.012;
          }

          projectRegions(now);

          renderer.render(
            scene,
            camera,
          );

          animationFrame =
            window.requestAnimationFrame(
              render,
            );
        };

      animationFrame =
        window.requestAnimationFrame(
          render,
        );

      return () => {
        disposed = true;

        window.cancelAnimationFrame(
          animationFrame,
        );

        observer.disconnect();

        window.removeEventListener(
          'resize',
          resize,
        );

        canvas.removeEventListener(
          'pointerdown',
          pointerDown,
        );

        canvas.removeEventListener(
          'pointermove',
          pointerMove,
        );

        canvas.removeEventListener(
          'pointerup',
          pointerUp,
        );

        canvas.removeEventListener(
          'pointercancel',
          pointerUp,
        );

        canvas.removeEventListener(
          'wheel',
          onWheel,
        );

        motionQuery.removeEventListener(
          'change',
          onMotionChange,
        );

        disposeObject(scene);

        earthTexture.dispose();
        fallbackTexture.dispose();

        renderer?.dispose();
        renderer = null;
      };
    } catch (error) {
      console.error(
        '[HomeEarth init]',
        error,
      );
    }

    return () => {
      disposed = true;

      if (animationFrame) {
        window.cancelAnimationFrame(
          animationFrame,
        );
      }

      renderer?.dispose();
    };
  }, []);

  const live =
    metrics.status === 'LIVE';

  return (
    <div
      ref={hostRef}
      className={styles.host}
      data-live={
        live
          ? 'true'
          : 'false'
      }
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-hidden="true"
      />

      <div
        className={styles.scanline}
        aria-hidden="true"
      />

      <div
        className={`${styles.corner} ${styles.cornerTopLeft}`}
        aria-hidden="true"
      />

      <div
        className={`${styles.corner} ${styles.cornerTopRight}`}
        aria-hidden="true"
      />

      <div
        className={`${styles.corner} ${styles.cornerBottomLeft}`}
        aria-hidden="true"
      />

      <div
        className={`${styles.corner} ${styles.cornerBottomRight}`}
        aria-hidden="true"
      />

      <div
        className={styles.topHud}
        aria-hidden="true"
      >
        <div>
          <span
            className={styles.eyebrow}
          >
            GLOBAL MINING NETWORK
          </span>

          <span
            className={styles.subline}
          >
            REAL-TIME VISUALIZATION
          </span>
        </div>

        <div
          className={
            styles.operational
          }
        >
          <span
            className={
              styles.statusDot
            }
          />

          <span>
            {live
              ? 'OPERATIONAL'
              : 'PAUSED'}
          </span>
        </div>
      </div>

      <div
        className={styles.centerHud}
        aria-hidden="true"
      >
        <span
          className={
            styles.centerTitle
          }
        >
          NEXTGEN CORE
        </span>

        <span
          className={
            styles.centerSubline
          }
        >
          GLOBAL NETWORK
        </span>
      </div>

      <div
        className={styles.regionLayer}
        aria-hidden="true"
      >
        {REGIONS.map(
          (
            region,
            index,
          ) => (
            <div
              key={
                region.key
              }
              ref={(node) => {
                regionRefs.current[
                  index
                ] = node;
              }}
              className={
                styles.region
              }
            >
              <span
                className={
                  styles.regionDot
                }
              />

              <span
                className={
                  styles.regionLabel
                }
              >
                {
                  region.label
                }
              </span>
            </div>
          ),
        )}
      </div>

      <div
        className={styles.coreHud}
        aria-hidden="true"
      >
        <span
          className={
            styles.coreBadge
          }
        >
          N
        </span>

        <div>
          <span
            className={
              styles.coreTitle
            }
          >
            NEXTGEN CORE
          </span>

          <span
            className={
              styles.coreSubline
            }
          >
            POWERING A BRIGHTER
            TOMORROW
          </span>
        </div>
      </div>

      <div
        className={styles.liveBadge}
        aria-hidden="true"
      >
        <span
          className={
            styles.liveTitle
          }
        >
          LIVE NETWORK
        </span>

        <div
          className={
            styles.liveDots
          }
        >
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>

        <span
          className={
            styles.liveSubline
          }
        >
          REAL-TIME DATA
        </span>
      </div>
    </div>
  );
}
