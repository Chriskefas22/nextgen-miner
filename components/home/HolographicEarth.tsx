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
  phase: number;
};

type CityLight = {
  region: RegionKey;
  lat: number;
  lon: number;
  intensity: number;
  size: number;
  phase: number;
};

type LandSampler = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

const EARTH_TEXTURE =
  '/assets/landing/earth-equirectangular.webp';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/*
 * Default orientation:
 * Europe/Africa near the center, Americas toward the left edge,
 * Asia/Australia toward the right/lower-right edge.
 *
 * These coordinates are also the authoritative locations for all
 * region/network lights. They are not randomly generated.
 */
const REGIONS: Region[] = [
  {
    key: 'americas',
    lat: 23,
    lon: -92,
    label: 'AMERICAS',
    color: 0x47eaff,
    phase: 0.20,
  },
  {
    key: 'europe',
    lat: 50,
    lon: 12,
    label: 'EUROPE',
    color: 0xa763ff,
    phase: 1.10,
  },
  {
    key: 'asia',
    lat: 28,
    lon: 103,
    label: 'ASIA',
    color: 0x47eaff,
    phase: 2.10,
  },
  {
    key: 'africa',
    lat: -5,
    lon: 24,
    label: 'AFRICA',
    color: 0xa763ff,
    phase: 2.90,
  },
  {
    key: 'australia',
    lat: -28,
    lon: 134,
    label: 'AUSTRALIA',
    color: 0x47eaff,
    phase: 3.80,
  },
];

/*
 * Curated city/network points. These are known land coordinates.
 * The texture land-mask is used as an additional safety check, but the
 * geographic coordinate remains authoritative so a blue/low-contrast
 * texture never causes a valid city light to disappear.
 */
const CITY_LIGHTS: CityLight[] = [
  // Americas
  { region: 'americas', lat: 40.71, lon: -74.01, intensity: 1.00, size: 0.045, phase: 0.15 },
  { region: 'americas', lat: 34.05, lon: -118.24, intensity: 0.82, size: 0.038, phase: 0.85 },
  { region: 'americas', lat: 41.88, lon: -87.63, intensity: 0.78, size: 0.034, phase: 1.45 },
  { region: 'americas', lat: 29.76, lon: -95.37, intensity: 0.68, size: 0.031, phase: 2.10 },
  { region: 'americas', lat: 19.43, lon: -99.13, intensity: 0.70, size: 0.030, phase: 2.75 },
  { region: 'americas', lat: 25.76, lon: -80.19, intensity: 0.60, size: 0.028, phase: 3.35 },
  { region: 'americas', lat: -23.55, lon: -46.63, intensity: 0.90, size: 0.040, phase: 4.10 },
  { region: 'americas', lat: -34.60, lon: -58.38, intensity: 0.66, size: 0.031, phase: 4.80 },
  { region: 'americas', lat: -12.05, lon: -77.04, intensity: 0.54, size: 0.027, phase: 5.45 },

  // Europe
  { region: 'europe', lat: 51.51, lon: -0.13, intensity: 1.00, size: 0.045, phase: 0.45 },
  { region: 'europe', lat: 48.86, lon: 2.35, intensity: 0.94, size: 0.041, phase: 1.15 },
  { region: 'europe', lat: 52.52, lon: 13.41, intensity: 0.84, size: 0.035, phase: 1.80 },
  { region: 'europe', lat: 50.11, lon: 8.68, intensity: 0.76, size: 0.032, phase: 2.45 },
  { region: 'europe', lat: 41.90, lon: 12.50, intensity: 0.64, size: 0.028, phase: 3.15 },
  { region: 'europe', lat: 40.42, lon: -3.70, intensity: 0.63, size: 0.027, phase: 3.80 },
  { region: 'europe', lat: 52.37, lon: 4.90, intensity: 0.58, size: 0.026, phase: 4.45 },
  { region: 'europe', lat: 59.33, lon: 18.07, intensity: 0.46, size: 0.023, phase: 5.05 },

  // Asia
  { region: 'asia', lat: 35.68, lon: 139.69, intensity: 1.00, size: 0.047, phase: 0.35 },
  { region: 'asia', lat: 31.23, lon: 121.47, intensity: 0.96, size: 0.044, phase: 1.00 },
  { region: 'asia', lat: 22.32, lon: 114.17, intensity: 0.88, size: 0.040, phase: 1.65 },
  { region: 'asia', lat: 37.57, lon: 126.98, intensity: 0.78, size: 0.035, phase: 2.30 },
  { region: 'asia', lat: 1.35, lon: 103.82, intensity: 0.78, size: 0.032, phase: 2.95 },
  { region: 'asia', lat: 13.76, lon: 100.50, intensity: 0.69, size: 0.030, phase: 3.60 },
  { region: 'asia', lat: 28.61, lon: 77.21, intensity: 0.80, size: 0.034, phase: 4.25 },
  { region: 'asia', lat: 19.08, lon: 72.88, intensity: 0.82, size: 0.036, phase: 4.90 },
  { region: 'asia', lat: 25.20, lon: 55.27, intensity: 0.63, size: 0.029, phase: 5.55 },
  { region: 'asia', lat: 39.90, lon: 116.41, intensity: 0.90, size: 0.042, phase: 6.10 },

  // Africa
  { region: 'africa', lat: 30.04, lon: 31.24, intensity: 0.70, size: 0.033, phase: 0.75 },
  { region: 'africa', lat: 6.52, lon: 3.38, intensity: 0.68, size: 0.031, phase: 1.50 },
  { region: 'africa', lat: -1.29, lon: 36.82, intensity: 0.54, size: 0.026, phase: 2.20 },
  { region: 'africa', lat: -26.20, lon: 28.04, intensity: 0.78, size: 0.035, phase: 3.00 },
  { region: 'africa', lat: -33.92, lon: 18.42, intensity: 0.50, size: 0.025, phase: 3.75 },
  { region: 'africa', lat: 33.57, lon: -7.59, intensity: 0.53, size: 0.026, phase: 4.40 },
  { region: 'africa', lat: 14.72, lon: -17.47, intensity: 0.42, size: 0.023, phase: 5.05 },

  // Australia
  { region: 'australia', lat: -33.87, lon: 151.21, intensity: 0.86, size: 0.039, phase: 0.55 },
  { region: 'australia', lat: -37.81, lon: 144.96, intensity: 0.74, size: 0.034, phase: 1.40 },
  { region: 'australia', lat: -27.47, lon: 153.03, intensity: 0.64, size: 0.030, phase: 2.20 },
  { region: 'australia', lat: -31.95, lon: 115.86, intensity: 0.56, size: 0.028, phase: 2.95 },
  { region: 'australia', lat: -34.93, lon: 138.60, intensity: 0.48, size: 0.025, phase: 3.70 },
];

/*
 * This mapping follows an equirectangular texture convention where
 * longitude 0° is the front-center meridian. It is used consistently
 * for Earth, region nodes and city lights.
 */
function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number,
) {
  const lat =
    THREE.MathUtils.degToRad(
      latitude,
    );

  const lon =
    THREE.MathUtils.degToRad(
      longitude,
    );

  const cosLat =
    Math.cos(lat);

  /*
   * Three.js SphereGeometry maps the equirectangular U coordinate around
   * the Y axis with theta=0 at the -X direction. This mapping keeps
   * geographic longitude, texture longitude and 3D projection in sync.
   */
  return new THREE.Vector3(
    radius *
      cosLat *
      Math.cos(lon),
    radius *
      Math.sin(lat),
    -radius *
      cosLat *
      Math.sin(lon),
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
    0.08,
    'rgba(255,245,186,.98)',
  );

  gradient.addColorStop(
    0.22,
    'rgba(87,234,255,.72)',
  );

  gradient.addColorStop(
    0.46,
    'rgba(87,180,255,.20)',
  );

  gradient.addColorStop(
    0.72,
    'rgba(120,100,255,.05)',
  );

  gradient.addColorStop(
    1,
    'rgba(0,0,0,0)',
  );

  context.fillStyle =
    gradient;

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

  texture.needsUpdate =
    true;

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

        float luminance =
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

        float coastline =
          smoothstep(
            0.012,
            0.031,
            landSignal
          ) *
          (
            1.0 -
            smoothstep(
              0.050,
              0.095,
              landSignal
            )
          );

        vec3 ocean =
          mix(
            vec3(
              0.001,
              0.006,
              0.018
            ),
            vec3(
              0.006,
              0.070,
              0.160
            ),
            smoothstep(
              0.06,
              0.78,
              luminance
            )
          );

        vec3 landColor =
          mix(
            vec3(
              0.012,
              0.18,
              0.39
            ),
            vec3(
              0.060,
              0.55,
              0.85
            ),
            smoothstep(
              0.18,
              0.84,
              luminance
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
            0.018,
            0.27,
            0.74
          ) *
          coastline *
          0.52;

        /*
         * Fine holographic scan modulation.
         * Very low amplitude so the Earth stays clean.
         */
        color *=
          0.987 +
          0.013 *
          sin(
            vUv.y *
              180.0 +
            uTime *
              1.15
          );

        vec3 viewDirection =
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
              viewDirection
            ),
            0.0
          );

        float rim =
          pow(
            1.0 -
              facing,
            2.65
          );

        color +=
          vec3(
            0.006,
            0.26,
            0.80
          ) *
          rim *
          0.62;

        gl_FragColor =
          vec4(
            color,
            0.985
          );
      }
    `,

    transparent: false,
    depthWrite: true,
    depthTest: true,
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
          new THREE.Color(
            color,
          ),
      },
      uOpacity: {
        value: opacity,
      },
    },

    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition =
          modelMatrix *
          vec4(position, 1.0);

        vWorldPosition =
          worldPosition.xyz;

        vNormal =
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

      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal =
          normalize(vNormal);

        vec3 viewDirection =
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
                  viewDirection
                ),
                0.0
              ),
            2.85
          );

        gl_FragColor =
          vec4(
            uColor,
            rim * uOpacity
          );
      }
    `,

    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
    blending:
      THREE.AdditiveBlending,
  });
}

function createSurfaceRing(
  radius: number,
  latitude: number,
  longitudeOffset: number,
  color: number,
  opacity: number,
  segments: number,
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
          Math.sin(
            longitude,
          ),
        y,
        ringRadius *
          Math.cos(
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
      depthTest: true,
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
  segments: number,
) {
  const points: THREE.Vector3[] =
    [];

  for (
    let i = 0;
    i <= segments;
    i += 1
  ) {
    const a =
      (i / segments) *
      TAU;

    const point =
      new THREE.Vector3(
        Math.cos(a) *
          radius,
        Math.sin(a) *
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
      depthWrite: false,
      depthTest: true,
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
  phase: number,
) {
  const middle =
    from
      .clone()
      .add(to)
      .normalize()
      .multiplyScalar(
        1.022,
      );

  const curve =
    new THREE.QuadraticBezierCurve3(
      from,
      middle,
      to,
    );

  const geometry =
    new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(22),
    );

  const material =
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      depthTest: true,
      blending:
        THREE.AdditiveBlending,
    });

  const line =
    new THREE.Line(
      geometry,
      material,
    );

  line.userData = {
    phase,
    baseOpacity: 0.10,
  };

  return line;
}

function buildLandSampler(
  image: HTMLImageElement |
    ImageBitmap |
    HTMLCanvasElement,
): LandSampler | null {
  const sourceWidth =
    image instanceof HTMLCanvasElement
      ? image.width
      : 'naturalWidth' in image
        ? image.naturalWidth
        : image.width;

  const sourceHeight =
    image instanceof HTMLCanvasElement
      ? image.height
      : 'naturalHeight' in image
        ? image.naturalHeight
        : image.height;

  if (
    !sourceWidth ||
    !sourceHeight
  ) {
    return null;
  }

  const width =
    Math.min(
      1024,
      sourceWidth,
    );

  const height =
    Math.min(
      512,
      sourceHeight,
    );

  const canvas =
    document.createElement(
      'canvas',
    );

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext('2d', {
      willReadFrequently: true,
    });

  if (!context) {
    return null;
  }

  try {
    context.drawImage(
      image as CanvasImageSource,
      0,
      0,
      width,
      height,
    );

    return {
      data:
        context.getImageData(
          0,
          0,
          width,
          height,
        ).data,
      width,
      height,
    };
  } catch {
    /*
     * Cross-origin/canvas sampling failure should never break the globe.
     * Curated geographic points will still render.
     */
    return null;
  }
}

function sampleLandSignal(
  sampler: LandSampler,
  latitude: number,
  longitude: number,
) {
  const normalizedLongitude =
    (
      (
        longitude + 180
      ) %
        360 +
      360
    ) % 360;

  const u =
    normalizedLongitude /
    360;

  const v =
    THREE.MathUtils.clamp(
      (
        90 -
        latitude
      ) / 180,
      0,
      1,
    );

  const centerX =
    Math.round(
      u *
        (
          sampler.width -
          1
        ),
    );

  const centerY =
    Math.round(
      v *
        (
          sampler.height -
          1
        ),
    );

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
      const x =
        (
          centerX +
          ox +
          sampler.width
        ) %
        sampler.width;

      const y =
        THREE.MathUtils.clamp(
          centerY + oy,
          0,
          sampler.height - 1,
        );

      const index =
        (
          y *
            sampler.width +
          x
        ) *
        4;

      const r =
        sampler.data[
          index
        ] / 255;

      const g =
        sampler.data[
          index + 1
        ] / 255;

      const b =
        sampler.data[
          index + 2
        ] / 255;

      best =
        Math.max(
          best,
          Math.max(
            r - b * 0.78,
            g - b * 0.68,
          ),
        );
    }
  }

  return best;
}

function isConfidentOcean(
  sampler: LandSampler | null,
  latitude: number,
  longitude: number,
) {
  if (!sampler) {
    return false;
  }

  /*
   * Only classify as ocean when the sampled signal is decisively low.
   * This avoids suppressing city lights because the holographic shader
   * intentionally uses a blue/low-contrast land treatment.
   */
  return (
    sampleLandSignal(
      sampler,
      latitude,
      longitude,
    ) <
    -0.003
  );
}

function createCityLightGroup(
  mobile: boolean,
  glowTexture: THREE.Texture | null,
  sampler: LandSampler | null,
) {
  const group =
    new THREE.Group();

  if (!glowTexture) {
    return group;
  }

  const list =
    mobile
      ? CITY_LIGHTS.filter(
          (_, index) =>
            index % 2 === 0,
        )
      : CITY_LIGHTS;

  list.forEach(
    (city, index) => {
      if (
        isConfidentOcean(
          sampler,
          city.lat,
          city.lon,
        )
      ) {
        return;
      }

      const position =
        latLonToVector3(
          city.lat,
          city.lon,
          1.022,
        );

      const sprite =
        new THREE.Sprite(
          new THREE.SpriteMaterial({
            map:
              glowTexture,
            color:
              0xffe5a0,
            transparent:
              true,
            opacity:
              0.22 +
              city.intensity *
                0.34,
            depthWrite:
              false,
            depthTest:
              true,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      const size =
        city.size *
        (mobile
          ? 1.55
          : 1.82);

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
          0.22 +
          city.intensity *
            0.34,
        phase:
          city.phase +
          index * 0.093,
        region:
          city.region,
      };

      group.add(
        sprite,
      );
    },
  );

  return group;
}

function createRegionCluster(
  region: Region,
  mobile: boolean,
) {
  const group =
    new THREE.Group();

  const primaryPosition =
    latLonToVector3(
      region.lat,
      region.lon,
      1.022,
    );

  const primary =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.020,
        8,
        8,
      ),
      new THREE.MeshBasicMaterial({
        color:
          region.color,
        transparent:
          true,
        opacity:
          0.78,
        depthWrite:
          false,
        depthTest:
          true,
        blending:
          THREE.AdditiveBlending,
      }),
    );

  primary.position.copy(
    primaryPosition,
  );

  group.add(
    primary,
  );

  const offsets =
    mobile
      ? [
          [-1.3, 0.8],
          [1.1, -0.6],
        ]
      : [
          [-2.0, 1.2],
          [1.7, -0.9],
          [-0.9, -1.4],
        ];

  offsets.forEach(
    ([latOffset, lonOffset], index) => {
      const position =
        latLonToVector3(
          region.lat +
            latOffset,
          region.lon +
            lonOffset,
          1.023,
        );

      const secondary =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.0105,
            7,
            7,
          ),
          new THREE.MeshBasicMaterial({
            color:
              region.color,
            transparent:
              true,
            opacity:
              0.40,
            depthWrite:
              false,
            depthTest:
              true,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      secondary.position.copy(
        position,
      );

      group.add(
        secondary,
      );

      group.add(
        createConnector(
          primaryPosition,
          position,
          region.color,
          region.phase +
            index *
              0.55,
        ),
      );
    },
  );

  return {
    group,
    primary,
  };
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
      Math.random() *
      TAU;

    const z =
      THREE.MathUtils.randFloatSpread(
        2,
      );

    const xy =
      Math.sqrt(
        Math.max(
          0,
          1 - z * z,
        ),
      );

    const radius =
      THREE.MathUtils.randFloat(
        6.0,
        8.7,
      );

    positions[
      i * 3
    ] =
      radius *
      xy *
      Math.cos(
        theta,
      );

    positions[
      i * 3 + 1
    ] =
      radius *
      z;

    positions[
      i * 3 + 2
    ] =
      radius *
      xy *
      Math.sin(
        theta,
      );
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
      color:
        0x5daeff,
      size:
        0.009,
      sizeAttenuation:
        true,
      transparent:
        true,
      opacity:
        0.20,
      depthWrite:
        false,
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
      const candidate =
        child as
          | THREE.Mesh
          | THREE.Line
          | THREE.LineLoop
          | THREE.Points
          | THREE.Sprite;

      if (
        'geometry' in candidate &&
        candidate.geometry
      ) {
        candidate.geometry.dispose();
      }

      if (
        'material' in candidate &&
        candidate.material
      ) {
        if (
          Array.isArray(
            candidate.material,
          )
        ) {
          candidate.material.forEach(
            (material) =>
              material.dispose(),
          );
        } else {
          candidate.material.dispose();
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

  const cityLightsRef =
    useRef<
      THREE.Group
    >(
      new THREE.Group(),
    );

  metricsRef.current =
    metrics;

  const regionList =
    useMemo(
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

    let animationFrame =
      0;

    let disposed =
      false;

    let mobile =
      window.innerWidth < 760;

    let reducedMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    let dragging =
      false;

    let pointerId:
      | number
      | null =
      null;

    let lastPointerX =
      0;

    let lastPointerY =
      0;

    let angularVelocity =
      0;

    let rotationY =
      THREE.MathUtils.degToRad(
        0,
      );

    let targetRotationY =
      rotationY;

    let rotationX =
      THREE.MathUtils.degToRad(
        -4,
      );

    let targetRotationX =
      rotationX;

    let lastTime =
      performance.now();

    let landSampler:
      LandSampler | null =
      null;

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
        1.0;

      const scene =
        new THREE.Scene();

      const camera =
        new THREE.PerspectiveCamera(
          mobile
            ? 32
            : 29,
          1,
          0.1,
          30,
        );

      camera.position.set(
        0,
        0.01,
        mobile
          ? 4.34
          : 4.02,
      );

      /*
       * Single master transform. Nothing associated with Earth gets
       * an independent rotation loop.
       */
      const master3DSystem =
        new THREE.Group();

      master3DSystem.scale.setScalar(
        mobile
          ? 0.875
          : 0.95,
      );

      master3DSystem.rotation.x =
        rotationX;

      scene.add(
        master3DSystem,
      );

      const keyLight =
        new THREE.DirectionalLight(
          0xd8fbff,
          2.05,
        );

      keyLight.position.set(
        -4,
        4,
        6,
      );

      scene.add(
        keyLight,
      );

      const fillLight =
        new THREE.DirectionalLight(
          0x7552ff,
          0.28,
        );

      fillLight.position.set(
        3,
        -2,
        -3,
      );

      scene.add(
        fillLight,
      );

      scene.add(
        new THREE.AmbientLight(
          0x3baeff,
          0.74,
        ),
      );

      const stars =
        makeStars(
          mobile
            ? 64
            : 112,
        );

      scene.add(
        stars,
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

      const textureLoader =
        new THREE.TextureLoader();

      const earthTexture =
        textureLoader.load(
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

            landSampler =
              buildLandSampler(
                texture.image,
              );

            const cityLights =
              createCityLightGroup(
                mobile,
                glowTexture,
                landSampler,
              );

            cityLights.position.y =
              0.10;

            synchronizedSystem.add(
              cityLights,
            );

            cityLightsRef.current =
              cityLights;
          },
          undefined,
          () => {
            console.warn(
              '[HomeEarth] Earth texture failed to load; geographic light anchors retained without texture sampling.',
            );

            const cityLights =
              createCityLightGroup(
                mobile,
                glowTexture,
                null,
              );

            cityLights.position.y =
              0.10;

            synchronizedSystem.add(
              cityLights,
            );

            cityLightsRef.current =
              cityLights;
          },
        );

      /*
       * Earth core.
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
       * Extremely subtle grid. The Earth texture remains visually dominant.
       */
      const earthGrid =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.006,
            mobile ? 30 : 44,
            mobile ? 20 : 28,
          ),
          new THREE.MeshBasicMaterial({
            color:
              0x5adfff,
            wireframe:
              true,
            transparent:
              true,
            opacity:
              0.010,
            depthWrite:
              false,
            depthTest:
              true,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      earthGrid.position.y =
        0.10;

      synchronizedSystem.add(
        earthGrid,
      );

      /*
       * Thin atmosphere/rim. The shell is intentionally only a few percent
       * outside the Earth — never a thick cyan band.
       */
      const atmosphere =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            1.048,
            mobile ? 42 : 58,
            mobile ? 28 : 40,
          ),
          createAtmosphereMaterial(
            0x35e9ff,
            0.19,
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
            1.032,
            mobile ? 38 : 52,
            mobile ? 24 : 36,
          ),
          createAtmosphereMaterial(
            0xa763ff,
            0.030,
          ),
        );

      violetAtmosphere.position.y =
        0.10;

      synchronizedSystem.add(
        violetAtmosphere,
      );

      /*
       * Two thin surface rings + one subtle orbit.
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
          1.009,
          30,
          0.13,
          0x47eaff,
          0.055,
          mobile ? 112 : 144,
        );

      const ringB =
        createSurfaceRing(
          1.009,
          -16,
          -0.28,
          0xa763ff,
          0.038,
          mobile ? 112 : 144,
        );

      surfaceRings.add(
        ringA,
        ringB,
      );

      const subtleOrbit =
        new THREE.Group();

      subtleOrbit.position.y =
        0.10;

      synchronizedSystem.add(
        subtleOrbit,
      );

      const orbit =
        createOrbitBand(
          1.075,
          new THREE.Euler(
            THREE.MathUtils.degToRad(
              53,
            ),
            THREE.MathUtils.degToRad(
              10,
            ),
            THREE.MathUtils.degToRad(
              -12,
            ),
          ),
          0x52eaff,
          0.075,
          mobile ? 120 : 160,
        );

      subtleOrbit.add(
        orbit,
      );

      /*
       * Five controlled surface network clusters.
       */
      const surfaceNetwork =
        new THREE.Group();

      surfaceNetwork.position.y =
        0.10;

      synchronizedSystem.add(
        surfaceNetwork,
      );

      const regionRuntime =
        new Map<
          RegionKey,
          {
            primary: THREE.Mesh;
            anchor: THREE.Object3D;
            region: Region;
          }
        >();

      REGIONS.forEach(
        (region) => {
          const cluster =
            createRegionCluster(
              region,
              mobile,
            );

          surfaceNetwork.add(
            cluster.group,
          );

          const anchor =
            new THREE.Object3D();

          anchor.position.copy(
            latLonToVector3(
              region.lat,
              region.lon,
              1.024,
            ),
          );

          surfaceNetwork.add(
            anchor,
          );

          regionRuntime.set(
            region.key,
            {
              primary:
                cluster.primary,
              anchor,
              region,
            },
          );
        },
      );

      /*
       * Small central core halo.
       */
      const coreHalo =
        new THREE.Mesh(
          new THREE.RingGeometry(
            0.105,
            0.115,
            mobile ? 32 : 48,
          ),
          new THREE.MeshBasicMaterial({
            color:
              0x5beaff,
            transparent:
              true,
            opacity:
              0.11,
            side:
              THREE.DoubleSide,
            depthWrite:
              false,
            depthTest:
              true,
            blending:
              THREE.AdditiveBlending,
          }),
        );

      coreHalo.position.set(
        0,
        0.105,
        1.018,
      );

      synchronizedSystem.add(
        coreHalo,
      );

      const projectRegions =
        (now: number) => {
          const center =
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

              const outward =
                world
                  .clone()
                  .sub(center)
                  .normalize();

              const towardCamera =
                camera.position
                  .clone()
                  .sub(world)
                  .normalize();

              const depth =
                outward.dot(
                  towardCamera,
                );

              const projected =
                world
                  .clone()
                  .project(camera);

              const x =
                (
                  projected.x *
                    0.5 +
                  0.5
                ) *
                100;

              const y =
                (
                  -projected.y *
                    0.5 +
                  0.5
                ) *
                100;

              const viewportSafe =
                projected.z <
                  1 &&
                x >
                  -8 &&
                x <
                  108 &&
                y >
                  7 &&
                y <
                  93;

              const topHud =
                y <
                (
                  mobile
                    ? 20
                    : 14
                );

              const bottomHud =
                y >
                (
                  mobile
                    ? 82
                    : 87
                );

              const alpha =
                THREE.MathUtils.clamp(
                  (
                    depth -
                    0.075
                  ) /
                    0.22,
                  0,
                  1,
                );

              const visible =
                viewportSafe &&
                !topHud &&
                !bottomHud &&
                alpha >
                  0.008;

              element.style.left =
                `${x}%`;

              element.style.top =
                `${y}%`;

              element.style.opacity =
                visible
                  ? (
                      0.22 +
                      alpha *
                        0.78
                    ).toFixed(
                      3,
                    )
                  : '0';

              element.style.visibility =
                visible
                  ? 'visible'
                  : 'hidden';

              element.style.transform =
                `translate(-50%, -50%) scale(${(
                  0.90 +
                  alpha *
                    0.10
                ).toFixed(3)})`;

              element.dataset.status =
                metricsRef.current.status.toLowerCase();

              const pulse =
                0.88 +
                0.12 *
                  (
                    0.5 +
                    0.5 *
                      Math.sin(
                        now *
                          0.0021 +
                          region.phase,
                      )
                  );

              element.style.setProperty(
                '--region-pulse',
                pulse.toFixed(
                  3,
                ),
              );

              runtime.primary.scale.setScalar(
                0.84 +
                  (
                    pulse -
                    0.88
                  ) *
                    1.8,
              );

              (
                runtime.primary.material as THREE.MeshBasicMaterial
              ).opacity =
                0.43 +
                (
                  pulse -
                  0.88
                ) *
                  1.35;
            },
          );
        };

      const animateLights =
        (now: number) => {
          /*
           * A fixed virtual sun creates a gentle day/night transition
           * as the master Earth rotates.
           */
          const sun =
            new THREE.Vector3(
              -0.46,
              0.25,
              0.86,
            ).normalize();

          cityLightsRef.current.children.forEach(
            (child) => {
              const sprite =
                child as THREE.Sprite;

              const material =
                sprite.material as
                  THREE.SpriteMaterial;

              const baseOpacity =
                Number(
                  sprite.userData
                    .baseOpacity ??
                    0.24,
                );

              const phase =
                Number(
                  sprite.userData
                    .phase ??
                    0,
                );

              const world =
                sprite.getWorldPosition(
                  new THREE.Vector3(),
                );

              const normal =
                world.normalize();

              const daylight =
                Math.max(
                  0,
                  normal.dot(sun),
                );

              const nightStrength =
                0.54 +
                0.72 *
                  (
                    1 -
                    daylight
                  );

              const individualPulse =
                0.84 +
                0.16 *
                  (
                    0.5 +
                    0.5 *
                      Math.sin(
                        now *
                          0.0019 +
                          phase,
                      )
                  );

              const regionalPulse =
                0.93 +
                0.07 *
                  Math.sin(
                    now *
                      0.00085,
                  );

              material.opacity =
                baseOpacity *
                nightStrength *
                individualPulse *
                regionalPulse;
            },
          );
        };

      const animateConnectors =
        (now: number) => {
          surfaceNetwork.traverse(
            (child) => {
              if (
                !(
                  child instanceof
                  THREE.Line
                )
              ) {
                return;
              }

              const material =
                child.material as
                  THREE.LineBasicMaterial;

              const phase =
                Number(
                  child.userData
                    .phase ??
                    0,
                );

              const base =
                Number(
                  child.userData
                    .baseOpacity ??
                    0.10,
                );

              const pulse =
                0.72 +
                0.28 *
                  (
                    0.5 +
                    0.5 *
                      Math.sin(
                        now *
                          0.0016 +
                          phase,
                      )
                  );

              material.opacity =
                base *
                pulse;
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
            width /
            height;

          camera.fov =
            mobile
              ? 32
              : 29;

          camera.position.z =
            mobile
              ? 4.34
              : 4.02;

          camera.updateProjectionMatrix();

          /*
           * Keep the Earth smaller on phones without changing the
           * scale every frame.
           */
          master3DSystem.scale.setScalar(
            mobile
              ? 0.875
              : 0.95,
          );

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

          dragging =
            true;

          pointerId =
            event.pointerId;

          lastPointerX =
            event.clientX;

          lastPointerY =
            event.clientY;

          angularVelocity =
            0;

          try {
            canvas.setPointerCapture(
              event.pointerId,
            );
          } catch {
            // Optional browser feature.
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
            dx *
            0.0056;

          targetRotationX =
            THREE.MathUtils.clamp(
              targetRotationX +
                dy *
                  0.0019,
              THREE.MathUtils.degToRad(
                -17,
              ),
              THREE.MathUtils.degToRad(
                17,
              ),
            );

          angularVelocity =
            dx *
            0.00088;
        };

      const pointerUp =
        (event: PointerEvent) => {
          if (
            pointerId !==
              event.pointerId
          ) {
            return;
          }

          dragging =
            false;

          pointerId =
            null;

          try {
            canvas.releasePointerCapture(
              event.pointerId,
            );
          } catch {
            // No-op.
          }
        };

      const wheel =
        (event: WheelEvent) => {
          camera.position.z =
            THREE.MathUtils.clamp(
              camera.position.z +
                event.deltaY *
                  0.00115,
              mobile
                ? 3.72
                : 3.45,
              mobile
                ? 4.86
                : 4.68,
            );

          camera.updateProjectionMatrix();
        };

      const motionChange =
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
              (
                now -
                lastTime
              ) /
                1000,
            );

          lastTime =
            now;

          if (
            !dragging
          ) {
            if (
              !reducedMotion
            ) {
              targetRotationY +=
                delta *
                (
                  mobile
                    ? 0.044
                    : 0.032
                );
            }

            if (
              Math.abs(
                angularVelocity,
              ) >
                0.00001
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
                  0.00065,
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

          master3DSystem.rotation.y =
            rotationY;

          master3DSystem.rotation.x =
            rotationX;

          earthMaterial.uniforms.uTime.value =
            now * 0.001;

          if (
            !reducedMotion
          ) {
            const pulse =
              0.5 +
              0.5 *
                Math.sin(
                  now *
                    0.0018,
                );

            (
              atmosphere.material as
                THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.17 +
              pulse *
                0.025;

            (
              violetAtmosphere.material as
                THREE.ShaderMaterial
            ).uniforms.uOpacity.value =
              0.024 +
              pulse *
                0.010;

            (
              ringA.material as
                THREE.LineBasicMaterial
            ).opacity =
              0.050 +
              pulse *
                0.010;

            (
              ringB.material as
                THREE.LineBasicMaterial
            ).opacity =
              0.034 +
              pulse *
                0.008;

            (
              orbit.material as
                THREE.LineBasicMaterial
            ).opacity =
              0.060 +
              pulse *
                0.016;

            (
              coreHalo.material as
                THREE.MeshBasicMaterial
            ).opacity =
              0.085 +
              pulse *
                0.040;
          }

          animateLights(
            now,
          );

          animateConnectors(
            now,
          );

          projectRegions(
            now,
          );

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
        wheel,
        {
          passive: true,
        },
      );

      motionQuery.addEventListener(
        'change',
        motionChange,
      );

      animationFrame =
        window.requestAnimationFrame(
          render,
        );

      return () => {
        disposed =
          true;

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
          wheel,
        );

        motionQuery.removeEventListener(
          'change',
          motionChange,
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
      className={
        styles.host
      }
      data-live={
        live
          ? 'true'
          : 'false'
      }
      aria-label="Interactive holographic global mining network Earth"
    >
      <canvas
        ref={canvasRef}
        className={
          styles.canvas
        }
        aria-hidden="true"
      />

      <div
        className={
          styles.scanline
        }
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
        className={
          styles.topHud
        }
        aria-hidden="true"
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            GLOBAL MINING NETWORK
          </span>

          <span
            className={
              styles.subline
            }
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
        className={
          styles.centerHud
        }
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
        className={
          styles.regionLayer
        }
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
              ref={(element) => {
                regionRefs.current[
                  index
                ] =
                  element;
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
        className={
          styles.coreHud
        }
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
        className={
          styles.liveBadge
        }
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
