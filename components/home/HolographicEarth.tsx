'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import styles from './HolographicEarth.module.css';

export type HomeEarthMetrics = {
  asset: string;
  status: 'LIVE' | 'PAUSED';
  activeHashrate: string;
  activeMiners: string;
  dailyOutputUsd: string;
};

type RegionKey =
  | 'americas'
  | 'europe'
  | 'asia'
  | 'africa'
  | 'australia';

type Region = {
  key: RegionKey;
  lat: number;
  lon: number;
  label: string;
  color: number;
  pulsePhase: number;
  offsetX: number;
  offsetY: number;
};

const EARTH_TEXTURE =
  '/assets/landing/earth-equirectangular.webp';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const REGIONS: Region[] = [
  {
    key: 'americas',
    lat: 25,
    lon: -92,
    label: 'AMERICAS',
    color: 0x47eaff,
    pulsePhase: 0.2,
    offsetX: -4,
    offsetY: 1,
  },
  {
    key: 'europe',
    lat: 49,
    lon: 12,
    label: 'EUROPE',
    color: 0xa763ff,
    pulsePhase: 1.1,
    offsetX: 1,
    offsetY: -6,
  },
  {
    key: 'asia',
    lat: 27,
    lon: 103,
    label: 'ASIA',
    color: 0x47eaff,
    pulsePhase: 2.1,
    offsetX: 5,
    offsetY: 0,
  },
  {
    key: 'africa',
    lat: -5,
    lon: 24,
    label: 'AFRICA',
    color: 0xa763ff,
    pulsePhase: 2.9,
    offsetX: 5,
    offsetY: 5,
  },
  {
    key: 'australia',
    lat: -27,
    lon: 134,
    label: 'AUSTRALIA',
    color: 0x47eaff,
    pulsePhase: 3.8,
    offsetX: 7,
    offsetY: 6,
  },
];

/*
 * Deterministic city/network lights.
 * These are clustered around the five operating regions instead of
 * being randomly scattered around the whole Earth.
 */
type CityLight = {
  region: RegionKey;
  lat: number;
  lon: number;
  size: number;
  intensity: number;
  phase: number;
};

/*
 * Curated city/network anchors. These are deliberately geographic locations,
 * not randomly generated points. The loaded Earth texture is still sampled
 * before a light is rendered, so an image/texture mismatch can suppress a dot.
 */
const CITY_LIGHTS: CityLight[] = [
  // Americas
  { region: 'americas', lat: 40.71, lon: -74.01, size: 0.040, intensity: 1.00, phase: 0.10 },
  { region: 'americas', lat: 34.05, lon: -118.24, size: 0.034, intensity: 0.86, phase: 0.80 },
  { region: 'americas', lat: 41.88, lon: -87.63, size: 0.030, intensity: 0.78, phase: 1.50 },
  { region: 'americas', lat: 29.76, lon: -95.37, size: 0.028, intensity: 0.72, phase: 2.20 },
  { region: 'americas', lat: 19.43, lon: -99.13, size: 0.026, intensity: 0.67, phase: 2.90 },
  { region: 'americas', lat: 25.76, lon: -80.19, size: 0.025, intensity: 0.65, phase: 3.60 },
  { region: 'americas', lat: -23.55, lon: -46.63, size: 0.034, intensity: 0.86, phase: 4.20 },
  { region: 'americas', lat: -34.60, lon: -58.38, size: 0.027, intensity: 0.68, phase: 4.90 },
  { region: 'americas', lat: -12.05, lon: -77.04, size: 0.023, intensity: 0.56, phase: 5.50 },

  // Europe
  { region: 'europe', lat: 51.51, lon: -0.13, size: 0.040, intensity: 1.00, phase: 0.50 },
  { region: 'europe', lat: 48.86, lon: 2.35, size: 0.036, intensity: 0.94, phase: 1.15 },
  { region: 'europe', lat: 52.52, lon: 13.41, size: 0.031, intensity: 0.82, phase: 1.80 },
  { region: 'europe', lat: 50.11, lon: 8.68, size: 0.028, intensity: 0.74, phase: 2.45 },
  { region: 'europe', lat: 41.90, lon: 12.50, size: 0.026, intensity: 0.68, phase: 3.05 },
  { region: 'europe', lat: 40.42, lon: -3.70, size: 0.025, intensity: 0.63, phase: 3.75 },
  { region: 'europe', lat: 52.37, lon: 4.90, size: 0.024, intensity: 0.61, phase: 4.40 },
  { region: 'europe', lat: 59.33, lon: 18.07, size: 0.021, intensity: 0.50, phase: 5.05 },

  // Asia
  { region: 'asia', lat: 35.68, lon: 139.69, size: 0.042, intensity: 1.00, phase: 0.35 },
  { region: 'asia', lat: 31.23, lon: 121.47, size: 0.040, intensity: 0.96, phase: 1.00 },
  { region: 'asia', lat: 22.32, lon: 114.17, size: 0.035, intensity: 0.88, phase: 1.65 },
  { region: 'asia', lat: 37.57, lon: 126.98, size: 0.031, intensity: 0.79, phase: 2.30 },
  { region: 'asia', lat: 1.35, lon: 103.82, size: 0.028, intensity: 0.76, phase: 2.95 },
  { region: 'asia', lat: 13.76, lon: 100.50, size: 0.027, intensity: 0.69, phase: 3.60 },
  { region: 'asia', lat: 28.61, lon: 77.21, size: 0.031, intensity: 0.79, phase: 4.25 },
  { region: 'asia', lat: 19.08, lon: 72.88, size: 0.033, intensity: 0.81, phase: 4.90 },
  { region: 'asia', lat: 25.20, lon: 55.27, size: 0.027, intensity: 0.63, phase: 5.55 },
  { region: 'asia', lat: 39.90, lon: 116.41, size: 0.038, intensity: 0.90, phase: 6.10 },

  // Africa
  { region: 'africa', lat: 30.04, lon: 31.24, size: 0.031, intensity: 0.70, phase: 0.80 },
  { region: 'africa', lat: 6.52, lon: 3.38, size: 0.030, intensity: 0.69, phase: 1.55 },
  { region: 'africa', lat: -1.29, lon: 36.82, size: 0.024, intensity: 0.52, phase: 2.30 },
  { region: 'africa', lat: -26.20, lon: 28.04, size: 0.033, intensity: 0.77, phase: 3.05 },
  { region: 'africa', lat: -33.92, lon: 18.42, size: 0.023, intensity: 0.49, phase: 3.75 },
  { region: 'africa', lat: 33.57, lon: -7.59, size: 0.024, intensity: 0.55, phase: 4.45 },
  { region: 'africa', lat: 14.72, lon: -17.47, size: 0.020, intensity: 0.43, phase: 5.15 },

  // Australia
  { region: 'australia', lat: -33.87, lon: 151.21, size: 0.035, intensity: 0.86, phase: 0.60 },
  { region: 'australia', lat: -37.81, lon: 144.96, size: 0.031, intensity: 0.75, phase: 1.45 },
  { region: 'australia', lat: -27.47, lon: 153.03, size: 0.027, intensity: 0.63, phase: 2.25 },
  { region: 'australia', lat: -31.95, lon: 115.86, size: 0.025, intensity: 0.58, phase: 3.00 },
  { region: 'australia', lat: -34.93, lon: 138.60, size: 0.022, intensity: 0.50, phase: 3.80 },
];


function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number,
) {
  const phi = (90 - latitude) * DEG;
  const theta = (longitude + 180) * DEG;

  return new THREE.Vector3(
    -radius *
      Math.sin(phi) *
      Math.cos(theta),
    radius * Math.cos(phi),
    radius *
      Math.sin(phi) *
      Math.sin(theta),
  );
}

function makeGlowTexture() {
  const canvas =
    document.createElement('canvas');

  canvas.width = 64;
  canvas.height = 64;

  const context =
    canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const gradient =
    context.createRadialGradient(
      32,
      32,
      1,
      32,
      32,
      32,
    );

  gradient.addColorStop(
    0,
    'rgba(255,255,255,1)',
  );

  gradient.addColorStop(
    0.09,
    'rgba(91,238,255,.95)',
  );

  gradient.addColorStop(
    0.28,
    'rgba(91,205,255,.40)',
  );

  gradient.addColorStop(
    0.62,
    'rgba(120,112,255,.08)',
  );

  gradient.addColorStop(
    1,
    'rgba(0,0,0,0)',
  );

  context.fillStyle = gradient;
  context.fillRect(
    0,
    0,
    64,
    64,
  );

  const texture =
    new THREE.CanvasTexture(
      canvas,
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

function createEarthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: {
        value: null,
      },
      uTime: {
        value: 0,
      },
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;

        vec4 worldPosition =
          modelMatrix *
          vec4(position, 1.0);

        vWorldPosition =
          worldPosition.xyz;

        vWorldNormal =
          normalize(
            mat3(modelMatrix) *
            normal
          );

        gl_Position =
          projectionMatrix *
          viewMatrix *
          worldPosition;
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
        vec3 tex =
          texture2D(
            uTexture,
            vUv
          ).rgb;

        float lum =
          dot(
            tex,
            vec3(
              0.299,
              0.587,
              0.114
            )
          );

        float landSignal =
          max(
            tex.r -
              tex.b *
              0.78,
            tex.g -
              tex.b *
              0.68
          );

        float land =
          smoothstep(
            0.012,
            0.095,
            landSignal
          );

        float coast =
          smoothstep(
            0.012,
            0.030,
            landSignal
          ) *
          (
            1.0 -
            smoothstep(
              0.052,
              0.095,
              landSignal
            )
          );

        /*
         * Blue hologram base.
         * Deliberately not photorealistic.
         */
        vec3 ocean =
          mix(
            vec3(
              0.001,
              0.006,
              0.018
            ),
            vec3(
              0.007,
              0.070,
              0.158
            ),
            smoothstep(
              0.05,
              0.78,
              lum
            )
          );

        vec3 landColor =
          mix(
            vec3(
              0.014,
              0.20,
              0.42
            ),
            vec3(
              0.065,
              0.58,
              0.86
            ),
            smoothstep(
              0.18,
              0.82,
              lum
            )
          );

        vec3 color =
          mix(
            ocean,
            landColor,
            land
          );

        color +=
          vec3(
            0.022,
            0.31,
            0.78
          ) *
          coast *
          0.60;

        /*
         * Subtle scan modulation.
         */
        color *=
          0.985 +
          0.015 *
          sin(
            vUv.y *
              188.0 +
            uTime *
              1.20
          );

        /*
         * Fine holographic rim.
         */
        vec3 viewDir =
          normalize(
            cameraPosition -
            vWorldPosition
          );

        float facing =
          max(
            dot(
              normalize(
                vWorldNormal
              ),
              viewDir
            ),
            0.0
          );

        float rim =
          pow(
            1.0 -
              facing,
            2.55
          );

        color +=
          vec3(
            0.008,
            0.30,
            0.88
          ) *
          rim *
          0.88;

        gl_FragColor =
          vec4(
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
        value:
          new THREE.Color(color),
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
          modelMatrix *
          vec4(position, 1.0);

        vWorldPosition =
          worldPosition.xyz;

        vWorldNormal =
          normalize(
            mat3(modelMatrix) *
            normal
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
        vec3 normal =
          normalize(
            vWorldNormal
          );

        vec3 viewDir =
          normalize(
            cameraPosition -
            vWorldPosition
          );

        float rim =
          pow(
            1.0 -
              max(
                dot(
                  normal,
                  viewDir
                ),
                0.0
              ),
            2.45
          );

        float shell =
          smoothstep(
            0.02,
            0.84,
            rim
          );

        gl_FragColor =
          vec4(
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
  segments = 144,
) {
  const points: THREE.Vector3[] =
    [];

  const lat =
    latitude * DEG;

  const y =
    Math.sin(lat) * radius;

  const ringRadius =
    Math.cos(lat) * radius;

  for (
    let i = 0;
    i <= segments;
    i += 1
  ) {
    const longitude =
      (i / segments) *
        TAU +
      longitudeOffset;

    points.push(
      new THREE.Vector3(
        ringRadius *
          Math.cos(
            longitude,
          ),
        y,
        ringRadius *
          Math.sin(
            longitude,
          ),
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
      blending:
        THREE.AdditiveBlending,
    });

  return new THREE.Line(
    geometry,
    material,
  );
}

function createOrbitBand(
  radius: number,
  rotation: THREE.Euler,
  color: number,
  opacity: number,
  segments = 160,
) {
  const points: THREE.Vector3[] =
    [];

  for (
    let i = 0;
    i <= segments;
    i += 1
  ) {
    const angle =
      (i / segments) *
      TAU;

    const point =
      new THREE.Vector3(
        Math.cos(angle) *
          radius,
        Math.sin(angle) *
          radius,
        0,
      );

    point.applyEuler(
      rotation,
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
      depthTest: false,
      depthWrite: false,
      blending:
        THREE.AdditiveBlending,
    });

  return new THREE.LineLoop(
    geometry,
    material,
  );
}

function createConnector(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
) {
  const direction =
    from
      .clone()
      .add(to)
      .normalize();

  const middle =
    direction.multiplyScalar(
      1.037,
    );

  const curve =
    new THREE.QuadraticBezierCurve3(
      from,
      middle,
      to,
    );

  const geometry =
    new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(24),
    );

  const material =
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending:
        THREE.AdditiveBlending,
    });

  return new THREE.Line(
    geometry,
    material,
  );
}

function createRegionCluster(
  region: Region,
  mobile: boolean,
  glowTexture: THREE.Texture | null,
) {
  const group =
    new THREE.Group();

  const primaryPosition =
    latLonToVector3(
      region.lat,
      region.lon,
      1.018,
    );

  const secondaryOffsets =
    mobile
      ? [
          [-1.7, 1.0],
          [1.6, -1.0],
        ]
      : [
          [-2.4, 1.5],
          [1.9, -1.1],
          [-1.1, -1.8],
        ];

  const primary =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.020,
        7,
        7,
      ),
      new THREE.MeshBasicMaterial({
        color:
          region.color,
        transparent: true,
        opacity: 0.80,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending,
      }),
    );

  primary.position.copy(
    primaryPosition,
  );

  group.add(primary);

  secondaryOffsets.forEach(
    ([latDelta, lonDelta]) => {
      const position =
        latLonToVector3(
          region.lat +
            latDelta,
          region.lon +
            lonDelta,
          1.019,
        );

      const point =
        glowTexture
          ? new THREE.Sprite(
              new THREE.SpriteMaterial({
                map: glowTexture,
                color:
                  region.color,
                transparent: true,
                opacity: 0.42,
                depthWrite: false,
                blending:
                  THREE.AdditiveBlending,
              }),
            )
          : new THREE.Mesh(
              new THREE.SphereGeometry(
                0.012,
                6,
                6,
              ),
              new THREE.MeshBasicMaterial({
                color:
                  region.color,
                transparent: true,
                opacity: 0.42,
                depthWrite: false,
                blending:
                  THREE.AdditiveBlending,
              }),
            );

      if (
        point instanceof
        THREE.Sprite
      ) {
        point.scale.set(
          0.06,
          0.06,
          1,
        );
      }

      point.position.copy(
        position,
      );

      group.add(point);

      group.add(
        createConnector(
          primaryPosition,
          position,
          region.color,
        ),
      );
    },
  );

  return {
    group,
    primary,
  };
}

type LandSampler = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

function buildLandSampler(
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
): LandSampler | null {
  const width =
    image instanceof HTMLCanvasElement
      ? image.width
      : 'naturalWidth' in image
        ? image.naturalWidth
        : image.width;

  const height =
    image instanceof HTMLCanvasElement
      ? image.height
      : 'naturalHeight' in image
        ? image.naturalHeight
        : image.height;

  if (!width || !height) {
    return null;
  }

  const canvas =
    document.createElement('canvas');

  /*
   * Downsample the texture. The mask is for placement, not display,
   * so a compact sample grid is much cheaper and avoids a large
   * getImageData allocation on mobile.
   */
  const sampleWidth =
    Math.min(1024, width);

  const sampleHeight =
    Math.min(512, height);

  canvas.width =
    sampleWidth;

  canvas.height =
    sampleHeight;

  const ctx =
    canvas.getContext('2d', {
      willReadFrequently: true,
    });

  if (!ctx) {
    return null;
  }

  try {
    ctx.drawImage(
      image as CanvasImageSource,
      0,
      0,
      sampleWidth,
      sampleHeight,
    );

    return {
      data: ctx.getImageData(
        0,
        0,
        sampleWidth,
        sampleHeight,
      ).data,
      width:
        sampleWidth,
      height:
        sampleHeight,
    };
  } catch {
    return null;
  }
}

function landSignalAt(
  sampler: LandSampler,
  latitude: number,
  longitude: number,
) {
  const wrappedLongitude =
    ((longitude + 180) %
      360 +
      360) %
    360;

  const u =
    wrappedLongitude / 360;

  const v =
    THREE.MathUtils.clamp(
      (90 - latitude) / 180,
      0,
      1,
    );

  const x =
    Math.round(
      u *
        (sampler.width - 1),
    );

  const y =
    Math.round(
      v *
        (sampler.height - 1),
    );

  /*
   * 5x5 neighbourhood prevents a coastline coordinate from failing
   * solely because of texture pixel rounding.
   */
  let best =
    -1;

  for (
    let oy = -2;
    oy <= 2;
    oy += 1
  ) {
    for (
      let ox = -2;
      ox <= 2;
      ox += 1
    ) {
      const sx =
        (x + ox +
          sampler.width) %
        sampler.width;

      const sy =
        THREE.MathUtils.clamp(
          y + oy,
          0,
          sampler.height - 1,
        );

      const offset =
        (sy *
          sampler.width +
          sx) *
        4;

      const r =
        sampler.data[offset] /
        255;

      const g =
        sampler.data[offset + 1] /
        255;

      const b =
        sampler.data[offset + 2] /
        255;

      const landSignal =
        Math.max(
          r - b * 0.78,
          g - b * 0.68,
        );

      best =
        Math.max(
          best,
          landSignal,
        );
    }
  }

  return best;
}

function resolveLandCity(
  sampler: LandSampler | null,
  city: CityLight,
) {
  /*
   * The geographic city coordinate is the source of truth.
   * If sampling is unavailable, keep the curated city coordinate.
   * If sampling is available, only suppress it when the sampled
   * texture strongly indicates ocean.
   */
  if (!sampler) {
    return {
      lat: city.lat,
      lon: city.lon,
    };
  }

  const signal =
    landSignalAt(
      sampler,
      city.lat,
      city.lon,
    );

  if (signal > 0.010) {
    return {
      lat: city.lat,
      lon: city.lon,
    };
  }

  /*
   * Search a very small radius around the known city. This keeps the
   * light on the same landmass and avoids "jumping" to another continent.
   */
  const offsets = [
    [0.35, 0],
    [-0.35, 0],
    [0, 0.35],
    [0, -0.35],
    [0.25, 0.25],
    [-0.25, 0.25],
    [0.25, -0.25],
    [-0.25, -0.25],
  ];

  let best =
    city;

  let bestSignal =
    signal;

  offsets.forEach(
    ([latOffset, lonOffset]) => {
      const next = {
        lat:
          city.lat +
          latOffset,
        lon:
          city.lon +
          lonOffset,
        size:
          city.size,
        intensity:
          city.intensity,
        phase:
          city.phase,
        region:
          city.region,
      };

      const nextSignal =
        landSignalAt(
          sampler,
          next.lat,
          next.lon,
        );

      if (
        nextSignal >
        bestSignal
      ) {
        bestSignal =
          nextSignal;
        best =
          next;
      }
    },
  );

  return {
    lat: best.lat,
    lon: best.lon,
  };
}


function createLandLights(
  mobile: boolean,
  glowTexture: THREE.Texture | null,
  sampler: LandSampler | null,
) {
  const group =
    new THREE.Group();

  const source =
    mobile
      ? CITY_LIGHTS.filter(
          (_, index) =>
            index % 2 ===
            0,
        )
      : CITY_LIGHTS;

  source.forEach(
    (city, index) => {
      const resolved =
        resolveLandCity(
          sampler,
          city,
        );

      if (!resolved) {
        return;
      }

      const position =
        latLonToVector3(
          resolved.lat,
          resolved.lon,
          1.026,
        );

      if (!glowTexture) {
        return;
      }

      const sprite =
        new THREE.Sprite(
          new THREE.SpriteMaterial({
            map:
              glowTexture,
            color:
              0xffe7a2,
            transparent:
              true,
            opacity:
              0.16 +
              city.intensity *
                0.28,
            depthWrite:
              false,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      const size =
        city.size *
        (mobile ? 1.65 : 1.95);

      sprite.scale.set(
        size,
        size,
        1,
      );

      sprite.position.copy(
        position,
      );

      sprite.userData = {
        baseOpacity:
          0.16 +
          city.intensity *
            0.28,
        phase:
          city.phase +
          index * 0.11,
        intensity:
          city.intensity,
        region:
          city.region,
      };

      group.add(sprite);
    },
  );

  return group;
}


function makeStars(
  count: number,
) {
  const positions =
    new Float32Array(
      count * 3,
    );

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

    positions[
      i * 3
    ] =
      radius *
      xy *
      Math.cos(theta);

    positions[
      i * 3 + 1
    ] =
      radius * z;

    positions[
      i * 3 + 2
    ] =
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
      color: 0x5caeff,
      size: 0.009,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending:
        THREE.AdditiveBlending,
    }),
  );
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

  /*
   * Keep markup stable. Region labels are projected
   * from the same 3D anchors that drive the surface nodes.
   */
  const regionList = useMemo(
    () => REGIONS,
    [],
  );

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

    const cityLightsRef = {
      current:
        new THREE.Group(),
    };

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
        1.02;

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
        0.01,
        mobile ? 4.55 : 4.18,
      );

      /*
       * MASTER 3D SYSTEM
       *
       * Everything that belongs to Earth lives under this single group:
       * Earth + atmosphere + grid + region nodes + city lights +
       * surface rings + subtle orbit + connector lines.
       */
      const master3DSystem =
        new THREE.Group();

      /*
       * Visual scale is intentionally smaller than the panel so the Earth
       * has breathing room for HUD, lights and orbit details.
       */
      master3DSystem.scale.setScalar(
        mobile ? 0.875 : 0.94,
      );

      master3DSystem.rotation.x =
        rotationX;

      master3DSystem.scale.setScalar(
        mobile ? 0.88 : 0.94,
      );

      scene.add(
        master3DSystem,
      );

      const lights =
        new THREE.Group();

      master3DSystem.add(
        lights,
      );

      const key =
        new THREE.DirectionalLight(
          0xd6fbff,
          2.15,
        );

      key.position.set(
        -4,
        4,
        6,
      );

      scene.add(key);

      const fill =
        new THREE.DirectionalLight(
          0x7150ff,
          0.34,
        );

      fill.position.set(
        3,
        -2,
        -3,
      );

      scene.add(fill);

      scene.add(
        new THREE.AmbientLight(
          0x38b5ff,
          0.82,
        ),
      );

      scene.add(
        makeStars(
          mobile ? 70 : 120,
        ),
      );

      const synchronizedSystem =
        new THREE.Group();

      master3DSystem.add(
        synchronizedSystem,
      );

      const glowTexture =
        makeGlowTexture();

      const earthMaterial =
        createEarthMaterial();

      const fallbackTexture =
        new THREE.DataTexture(
          new Uint8Array([
            4,
            18,
            40,
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

            earthMaterial.uniforms.uTexture.value =
              texture;

            texture.needsUpdate =
              true;

            /*
             * Rebuild living lights from the ACTUAL Earth texture.
             * This is what prevents dots from floating over oceans:
             * every candidate is validated against the same UV texture
             * that the Earth shader is displaying.
             */
            const landSampler =
              buildLandSampler(
                texture.image,
              );

            const refreshedLights =
              createLandLights(
                mobile,
                glowTexture,
                landSampler,
              );

            refreshedLights.position.y =
              0.10;

            synchronizedSystem.add(
              refreshedLights,
            );

            cityLightsRef.current =
              refreshedLights;
          },
          undefined,
          () => {
            console.warn(
              '[HomeEarth] Earth texture failed to load; fallback retained.',
            );
          },
        );

      /*
       * EARTH
       */
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

      /*
       * Subtle grid.
       */
      const gridMaterial =
        new THREE.MeshBasicMaterial({
          color: 0x5adfff,
          wireframe: true,
          transparent: true,
          opacity: 0.012,
          depthWrite: false,
          blending:
            THREE.AdditiveBlending,
        });

      const earthGrid =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.006,
            mobile ? 32 : 48,
            mobile ? 22 : 30,
          ),
          gridMaterial,
        );

      earthGrid.position.y =
        0.10;

      synchronizedSystem.add(
        earthGrid,
      );

      /*
       * Rim/atmosphere shells.
       */
      const earthGlow =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.030,
            mobile ? 38 : 56,
            mobile ? 26 : 36,
          ),
          new THREE.MeshBasicMaterial({
            color: 0x15c7ff,
            transparent: true,
            opacity: 0.010,
            side: THREE.BackSide,
            depthWrite: false,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      earthGlow.position.y =
        0.10;

      synchronizedSystem.add(
        earthGlow,
      );

      const atmosphere =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.135,
            mobile ? 42 : 62,
            mobile ? 28 : 40,
          ),
          createAtmosphereMaterial(
            0x35e9ff,
            0.245,
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
            1.036,
            mobile ? 38 : 54,
            mobile ? 26 : 36,
          ),
          createAtmosphereMaterial(
            0xa763ff,
            0.042,
          ),
        );

      violetAtmosphere.position.y =
        0.10;

      synchronizedSystem.add(
        violetAtmosphere,
      );

      /*
       * SurfaceRings: only three tight latitude rings.
       * They hug the Earth and cannot create the old long bottom trails.
       */
      const surfaceRings =
        new THREE.Group();

      surfaceRings.position.y =
        0.10;

      synchronizedSystem.add(
        surfaceRings,
      );

      const ringA =
        createSurfaceRing(
          1.010,
          32,
          0.15,
          0x47eaff,
          0.080,
          mobile ? 120 : 144,
        );

      const ringB =
        createSurfaceRing(
          1.010,
          -5,
          -0.42,
          0xa763ff,
          0.058,
          mobile ? 120 : 144,
        );

      const ringC =
        createSurfaceRing(
          1.010,
          -28,
          0.08,
          0x47eaff,
          0.042,
          mobile ? 120 : 144,
        );

      surfaceRings.add(
        ringA,
        ringB,
        ringC,
      );

      /*
       * SubtleOrbit: two very low-opacity great-circle bands,
       * kept close to the globe.
       */
      const subtleOrbit =
        new THREE.Group();

      synchronizedSystem.add(
        subtleOrbit,
      );

      const orbitA =
        createOrbitBand(
          1.115,
          new THREE.Euler(
            THREE.MathUtils.degToRad(
              50,
            ),
            THREE.MathUtils.degToRad(
              10,
            ),
            THREE.MathUtils.degToRad(
              -8,
            ),
          ),
          0x52eaff,
          0.13,
          mobile ? 112 : 160,
        );

      const orbitB =
        createOrbitBand(
          1.060,
          new THREE.Euler(
            THREE.MathUtils.degToRad(
              -40,
            ),
            THREE.MathUtils.degToRad(
              18,
            ),
            THREE.MathUtils.degToRad(
              14,
            ),
          ),
          0xa763ff,
          0.085,
          mobile ? 112 : 160,
        );

      subtleOrbit.add(
        orbitA,
        orbitB,
      );

      /*
       * SurfaceNetwork
       */
      const surfaceNetwork =
        new THREE.Group();

      synchronizedSystem.add(
        surfaceNetwork,
      );

      const regionRuntime =
        new Map<
          RegionKey,
          {
            anchor: THREE.Object3D;
            primary: THREE.Mesh;
          }
        >();

      REGIONS.forEach(
        (region) => {
          const anchor =
            new THREE.Object3D();

          anchor.position.copy(
            latLonToVector3(
              region.lat,
              region.lon,
              1.018,
            ),
          );

          surfaceNetwork.add(
            anchor,
          );

          const cluster =
            createRegionCluster(
              region,
              mobile,
              glowTexture,
            );

          surfaceNetwork.add(
            cluster.group,
          );

          regionRuntime.set(
            region.key,
            {
              anchor,
              primary:
                cluster.primary,
            },
          );
        },
      );


      /*
       * Core energy halo:
       * a tiny ring around the center, not a big blocking card.
       */
      const coreHalo =
        new THREE.Mesh(
          new THREE.RingGeometry(
            0.12,
            0.125,
            mobile ? 36 : 56,
          ),
          new THREE.MeshBasicMaterial({
            color: 0x56ebff,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      coreHalo.position.set(
        0,
        0.105,
        1.025,
      );

      synchronizedSystem.add(
        coreHalo,
      );

      const regionProjection =
        (
          now: number,
        ) => {
          const earthCenter =
            synchronizedSystem.localToWorld(
              new THREE.Vector3(
                0,
                0.10,
                0,
              ),
            );

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
                runtime.anchor.getWorldPosition(
                  new THREE.Vector3(),
                );

              const normal =
                world
                  .clone()
                  .sub(
                    earthCenter,
                  )
                  .normalize();

              const toCamera =
                camera.position
                  .clone()
                  .sub(world)
                  .normalize();

              /*
               * True surface depth:
               * backside -> 0
               * side     -> low alpha
               * front    -> full alpha
               */
              const depth =
                normal.dot(
                  toCamera,
                );

              const projected =
                world
                  .clone()
                  .project(camera);

              const x =
                (projected.x * 0.5 +
                  0.5) *
                100;

              const y =
                (-projected.y * 0.5 +
                  0.5) *
                100;

              const insideViewport =
                projected.z < 1 &&
                x > -10 &&
                x < 110 &&
                y > 4 &&
                y < 96;

              const frontAlpha =
                THREE.MathUtils.clamp(
                  (depth - 0.085) /
                    0.24,
                  0,
                  1,
                );

              /*
               * Safe zones prevent labels from occupying the HUD rails.
               */
              const topBlocked =
                y <
                (mobile
                  ? 17
                  : 13);

              const bottomBlocked =
                y >
                (mobile
                  ? 84
                  : 86);

              const leftPanelBlocked =
                mobile
                  ? false
                  : x < 12 &&
                    y > 33 &&
                    y < 70;

              const rightPanelBlocked =
                mobile
                  ? false
                  : x > 88 &&
                    y > 29 &&
                    y < 74;

              const hidden =
                !insideViewport ||
                frontAlpha <= 0.015 ||
                topBlocked ||
                bottomBlocked ||
                leftPanelBlocked ||
                rightPanelBlocked;

              const labelAlpha =
                hidden
                  ? 0
                  : 0.30 +
                    frontAlpha *
                      0.70;

              element.style.left =
                `${x}%`;

              element.style.top =
                `${y}%`;

              element.style.opacity =
                labelAlpha.toFixed(3);

              element.style.visibility =
                labelAlpha > 0.015
                  ? 'visible'
                  : 'hidden';

              /*
               * Slightly compress labels as they approach
               * the silhouette so they feel projected onto the globe.
               */
              const scale =
                0.90 +
                frontAlpha *
                  0.10;

              element.style.transform =
                `translate(-50%, -50%) scale(${scale.toFixed(
                  3,
                )})`;

              const pulse =
                0.88 +
                0.12 *
                  (
                    0.5 +
                    0.5 *
                      Math.sin(
                        now *
                          0.0022 +
                          region.pulsePhase,
                      )
                  );

              element.style.setProperty(
                '--region-pulse',
                pulse.toFixed(
                  3,
                ),
              );

              runtime.primary.scale.setScalar(
                0.86 +
                  (
                    pulse -
                    0.88
                  ) *
                    1.85,
              );

              (
                runtime.primary.material as THREE.MeshBasicMaterial
              ).opacity =
                0.46 +
                (
                  pulse -
                  0.88
                ) *
                  1.5;
            },
          );
        };


      const resize =
        () => {
          if (!renderer) {
            return;
          }

          mobile =
            window.innerWidth <
            760;

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
              ? 4.55
              : 4.18;

          master3DSystem.scale.setScalar(
            mobile ? 0.88 : 0.94,
          );

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

      const onPointerDown =
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
            // Optional browser feature.
          }
        };

      const onPointerMove =
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
                dy * 0.0020,
              THREE.MathUtils.degToRad(
                -17,
              ),
              THREE.MathUtils.degToRad(
                17,
              ),
            );

          angularVelocity =
            dx * 0.0009;
        };

      const onPointerUp =
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
          camera.position.z =
            THREE.MathUtils.clamp(
              camera.position.z +
                event.deltaY *
                  0.0012,
              mobile
                ? 3.70
                : 3.45,
              mobile
                ? 4.82
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
                (
                  mobile
                    ? 0.048
                    : 0.034
                );
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
                  0.0010,
                  delta,
                ),
            );

          /*
           * THE ONE MASTER ROTATION.
           * No individual Earth rotation loop exists.
           */
          master3DSystem.rotation.y =
            rotationY;

          master3DSystem.rotation.x =
            rotationX;

          earthMaterial.uniforms.uTime.value =
            now * 0.001;

          /*
           * Core halo breathes with the network.
           */
          if (
            !reducedMotion
          ) {
            const corePulse =
              0.5 +
              0.5 *
                Math.sin(
                  now *
                    0.0018,
                );

            (
              coreHalo.material as THREE.MeshBasicMaterial
            ).opacity =
              0.10 +
              corePulse *
                0.07;

            /*
             * Atmosphere remains restrained.
             */
            (
              atmosphere.material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.225 +
              corePulse *
                0.025;

            (
              violetAtmosphere.material as THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.036 +
              corePulse *
                0.010;

            (
              ringA.material as THREE.LineBasicMaterial
            ).opacity =
              0.082 +
              corePulse *
                0.016;

            (
              ringB.material as THREE.LineBasicMaterial
            ).opacity =
              0.058 +
              corePulse *
                0.012;

            (
              ringC.material as THREE.LineBasicMaterial
            ).opacity =
              0.044 +
              corePulse *
                0.009;
          }

          const virtualSun =
            new THREE.Vector3(
              -0.42,
              0.32,
              0.85,
            ).normalize();

          surfaceNetwork.traverse(
            (child) => {
              if (
                !(child instanceof THREE.Line)
              ) {
                return;
              }

              const material =
                child.material as THREE.LineBasicMaterial;

              const phase =
                Number(
                  child.userData.phase ??
                    0,
                );

              const baseOpacity =
                Number(
                  child.userData.baseOpacity ??
                    0.10,
                );

              const wave =
                0.72 +
                0.28 *
                  (
                    0.5 +
                    0.5 *
                      Math.sin(
                        now *
                          0.00165 +
                          phase,
                      )
                  );

              material.opacity =
                baseOpacity *
                wave;
            },
          );

          cityLightsRef.current.children.forEach(
            (child) => {
              const sprite =
                child as THREE.Sprite;

              const material =
                sprite.material as THREE.SpriteMaterial;

              const baseOpacity =
                Number(
                  sprite.userData
                    .baseOpacity ??
                    0.22,
                );

              const phase =
                Number(
                  sprite.userData.phase ??
                    0,
                );

              const worldPosition =
                sprite.getWorldPosition(
                  new THREE.Vector3(),
                );

              /*
               * City lights become strongest on the night-side.
               * This creates the "living Earth" feel while remaining
               * fully synchronized with master Earth rotation.
               */
              const normal =
                worldPosition
                  .clone()
                  .normalize();

              const day =
                Math.max(
                  0,
                  normal.dot(
                    virtualSun,
                  ),
                );

              const night =
                0.48 +
                0.72 *
                  (1 - day);

              const microPulse =
                0.86 +
                0.14 *
                  (
                    0.5 +
                    0.5 *
                      Math.sin(
                        now *
                          0.0019 +
                          phase,
                      )
                  );

              material.opacity =
                baseOpacity *
                night *
                microPulse;
            },
          );
          regionProjection(now);

          renderer.render(
            scene,
            camera,
          );

          animationFrame =
            window.requestAnimationFrame(
              render,
            );
        };

      resize();

      const resizeObserver =
        new ResizeObserver(
          resize,
        );

      resizeObserver.observe(
        host,
      );

      window.addEventListener(
        'resize',
        resize,
      );

      canvas.addEventListener(
        'pointerdown',
        onPointerDown,
      );

      canvas.addEventListener(
        'pointermove',
        onPointerMove,
      );

      canvas.addEventListener(
        'pointerup',
        onPointerUp,
      );

      canvas.addEventListener(
        'pointercancel',
        onPointerUp,
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

      animationFrame =
        window.requestAnimationFrame(
          render,
        );

      return () => {
        disposed = true;

        window.cancelAnimationFrame(
          animationFrame,
        );

        resizeObserver.disconnect();

        window.removeEventListener(
          'resize',
          resize,
        );

        canvas.removeEventListener(
          'pointerdown',
          onPointerDown,
        );

        canvas.removeEventListener(
          'pointermove',
          onPointerMove,
        );

        canvas.removeEventListener(
          'pointerup',
          onPointerUp,
        );

        canvas.removeEventListener(
          'pointercancel',
          onPointerUp,
        );

        canvas.removeEventListener(
          'wheel',
          onWheel,
        );

        motionQuery.removeEventListener(
          'change',
          onMotionChange,
        );

        disposeObject(
          scene,
        );

        earthTexture.dispose();
        fallbackTexture.dispose();
        glowTexture?.dispose();

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
      aria-label="Interactive holographic global mining network Earth"
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
        {regionList.map(
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
