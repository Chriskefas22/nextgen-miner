'use client';

import { useEffect, useRef } from 'react';
import styles from './HolographicEarth.module.css';

type EarthMetrics = {
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
  color: 'cyan' | 'violet';
};

type GLState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  position: WebGLBuffer;
  normal: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
  indexCount: number;
  texture: WebGLTexture;
  uProjection: WebGLUniformLocation | null;
  uRotation: WebGLUniformLocation | null;
  uPitch: WebGLUniformLocation | null;
  uParallax: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uTexture: WebGLUniformLocation | null;
};

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const nodes: RegionNode[] = [
  { lat: 41, lon: -100, label: 'AMERICAS', color: 'cyan' },
  { lat: 50, lon: 12, label: 'EUROPE', color: 'violet' },
  { lat: 17, lon: 103, label: 'ASIA', color: 'cyan' },
  { lat: 3, lon: 24, label: 'AFRICA', color: 'violet' },
  { lat: -26, lon: 136, label: 'AUSTRALIA', color: 'cyan' },
  { lat: -18, lon: -63, label: 'S. AMERICA', color: 'violet' },
];

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

uniform mat4 uProjection;
uniform float uRotation;
uniform float uPitch;
uniform vec2 uParallax;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorld;

mat3 rotY(float a){
  float c=cos(a), s=sin(a);
  return mat3(c,0.,-s,0.,1.,0.,s,0.,c);
}
mat3 rotX(float a){
  float c=cos(a), s=sin(a);
  return mat3(1.,0.,0.,0.,c,-s,0.,s,c);
}

void main(){
  mat3 r = rotX(uPitch + uParallax.y * 0.045) * rotY(uRotation + uParallax.x * 0.06);
  vec3 p = r * aPosition;
  p.xy += uParallax * 0.0024;
  p.z -= 2.75;

  vNormal = r * aNormal;
  vUv = aUv;
  vWorld = p;

  gl_Position = uProjection * vec4(p, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

uniform sampler2D uTexture;
uniform float uTime;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorld;

void main(){
  vec3 view = normalize(vec3(0.0,0.0,-1.0));
  vec3 lightDir = normalize(vec3(-0.42,0.54,1.0));
  float light = max(dot(normalize(vNormal), lightDir), 0.0);
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), view), 0.0), 2.35);

  vec3 tex = texture2D(uTexture, vUv).rgb;

  // Preserve the photographic night-earth texture while lifting city lights.
  float lum = dot(tex, vec3(0.2126,0.7152,0.0722));
  float bright = smoothstep(0.47, 0.92, lum);
  float warm = smoothstep(0.50, 0.95, tex.r - tex.b * 0.36);

  vec3 color = tex * (0.82 + 0.24 * light);
  color += bright * vec3(0.14,0.20,0.26);
  color += warm * vec3(0.34,0.15,0.015);

  // Restrained latitude/longitude grid.
  float gx = pow(abs(sin(vUv.x * 3.1415926 * 16.0)), 22.0);
  float gy = pow(abs(sin((vUv.y - 0.5) * 3.1415926 * 12.0)), 22.0);
  float grid = max(gx, gy);
  color += grid * vec3(0.025,0.15,0.25) * (0.35 + 0.45 * light);

  // Scanning shimmer.
  float scan = 0.5 + 0.5 * sin((vUv.y * 15.0 - uTime * 0.22) * 6.2831853);
  color += scan * vec3(0.0,0.045,0.075) * 0.12;

  // Electric atmosphere around the silhouette.
  color += fresnel * vec3(0.05,0.48,0.90);
  color += pow(fresnel, 2.4) * vec3(0.12,0.15,0.44);

  float alpha = 0.93 + fresnel * 0.055;
  gl_FragColor = vec4(color, alpha);
}
`;

function createProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || 'Unknown shader error';
      gl.deleteShader(shader);
      throw new Error(info);
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, vertexShader);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!program) throw new Error('WebGL program allocation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

function buildSphere(gl: WebGLRenderingContext, segments: number, rings: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = Math.PI * (v - 0.5);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);

    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const theta = u * TAU;
      const p = [cp * Math.sin(theta), sp, cp * Math.cos(theta)];
      positions.push(...p);
      normals.push(...p);
      uvs.push(u, 1 - v);
    }
  }

  const row = segments + 1;
  for (let y = 0; y < rings; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = y * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const floatBuffer = (data: number[]) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('WebGL buffer allocation failed');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
  };

  const indexBuffer = gl.createBuffer();
  if (!indexBuffer) throw new Error('WebGL index allocation failed');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: floatBuffer(positions),
    normal: floatBuffer(normals),
    uv: floatBuffer(uvs),
    index: indexBuffer,
    indexCount: indices.length,
  };
}

function perspective(fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

function projectNode(node: RegionNode, rotation: number, pitch: number, width: number, height: number) {
  const phi = node.lat * DEG;
  const lambda = node.lon * DEG + rotation;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);

  const x = cp * Math.sin(lambda);
  const y = sp;
  const z = cp * Math.cos(lambda);

  const cy = y * Math.cos(pitch) - z * Math.sin(pitch);
  const cz = y * Math.sin(pitch) + z * Math.cos(pitch);
  const radius = Math.min(width, height) * 0.29;

  return {
    x: width / 2 + x * radius,
    y: height * 0.49 - cy * radius,
    visible: cz > 0.03,
    depth: cz,
  };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: 'cyan' | 'violet',
  align: 'left' | 'right',
) {
  const boxW = 118;
  const boxH = 36;
  const bx = align === 'left' ? x + 11 : x - boxW - 11;
  const by = y - boxH / 2;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = color === 'cyan' ? 'rgba(64,220,255,.42)' : 'rgba(165,93,255,.40)';
  ctx.fillStyle = 'rgba(3,17,30,.88)';
  ctx.shadowColor = color === 'cyan' ? 'rgba(36,224,255,.14)' : 'rgba(154,76,255,.12)';
  ctx.shadowBlur = 12;

  roundedRect(ctx, bx, by, boxW, boxH, 9);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = color === 'cyan' ? '#48eaff' : '#b58bff';
  ctx.beginPath();
  ctx.arc(bx + 12, by + 12, 3.2, 0, TAU);
  ctx.fill();

  ctx.font = '700 9px Orbitron, sans-serif';
  ctx.fillStyle = '#eafcff';
  ctx.textAlign = 'left';
  ctx.fillText(label, bx + 21, by + 14);

  ctx.font = '600 8px Rajdhani, sans-serif';
  ctx.fillStyle = '#7695a9';
  ctx.fillText('NETWORK NODE', bx + 12, by + 27);

  ctx.strokeStyle = color === 'cyan' ? 'rgba(64,220,255,.32)' : 'rgba(165,93,255,.28)';
  ctx.beginPath();
  ctx.moveTo(align === 'left' ? x : bx + boxW, y);
  ctx.lineTo(align === 'left' ? bx : bx + boxW + 7, y);
  ctx.stroke();
  ctx.restore();
}

export function HolographicEarth({ metrics }: { metrics: EarthMetrics }) {
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const glRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = glRef.current;
    const hud = hudRef.current;
    if (!canvas || !hud) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    const hudCtx = hud.getContext('2d');
    if (!gl || !hudCtx) return;

    let state: GLState;
    try {
      const program = createProgram(gl);
      const mobile = window.innerWidth < 760;
      const sphere = buildSphere(gl, mobile ? 56 : 88, mobile ? 28 : 44);

      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture allocation failed');

      const image = new Image();
      image.decoding = 'async';
      image.src = '/assets/home/earth-hologram-map.webp';

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([4, 13, 24, 255]),
      );

      state = {
        gl,
        program,
        position: sphere.position,
        normal: sphere.normal,
        uv: sphere.uv,
        index: sphere.index,
        indexCount: sphere.indexCount,
        texture,
        uProjection: gl.getUniformLocation(program, 'uProjection'),
        uRotation: gl.getUniformLocation(program, 'uRotation'),
        uPitch: gl.getUniformLocation(program, 'uPitch'),
        uParallax: gl.getUniformLocation(program, 'uParallax'),
        uTime: gl.getUniformLocation(program, 'uTime'),
        uTexture: gl.getUniformLocation(program, 'uTexture'),
      };

      let disposed = false;
      image.onload = () => {
        if (disposed) return;
        gl.bindTexture(gl.TEXTURE_2D, state.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      };

      image.onerror = () => {
        // Keep the dark WebGL placeholder if the local texture cannot load.
      };

      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let reduced = motion.matches;
      let width = 1;
      let height = 1;
      let dpr = 1;
      let frame = 0;
      let start = performance.now();
      let parallaxX = 0;
      let parallaxY = 0;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.8);

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        hud.width = Math.round(width * dpr);
        hud.height = Math.round(height * dpr);

        hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      const onMotion = () => {
        reduced = motion.matches;
        start = performance.now();
      };

      const onPointerMove = (event: PointerEvent) => {
        if (mobile || reduced) return;
        const rect = canvas.getBoundingClientRect();
        parallaxX = clamp((event.clientX - (rect.left + rect.width / 2)) / rect.width, -0.5, 0.5) * 10;
        parallaxY = clamp((event.clientY - (rect.top + rect.height / 2)) / rect.height, -0.5, 0.5) * 7;
      };

      const onPointerLeave = () => {
        parallaxX = 0;
        parallaxY = 0;
      };

      const draw = (now: number) => {
        if (disposed) return;

        const elapsed = reduced ? 0 : (now - start) / 1000;
        const rotation = elapsed * 0.16;
        const pitch = -0.10 + Math.sin(elapsed * 0.21) * 0.018;

        const current = metricsRef.current;

        gl.useProgram(state.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        const positionLoc = gl.getAttribLocation(state.program, 'aPosition');
        const normalLoc = gl.getAttribLocation(state.program, 'aNormal');
        const uvLoc = gl.getAttribLocation(state.program, 'aUv');

        gl.bindBuffer(gl.ARRAY_BUFFER, state.position);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, state.normal);
        gl.enableVertexAttribArray(normalLoc);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, state.uv);
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.index);
        gl.uniformMatrix4fv(
          state.uProjection,
          false,
          perspective(52 * DEG, width / Math.max(height, 1), 0.1, 100),
        );
        gl.uniform1f(state.uRotation, rotation);
        gl.uniform1f(state.uPitch, pitch);
        gl.uniform2f(state.uParallax, parallaxX, parallaxY);
        gl.uniform1f(state.uTime, elapsed);
        gl.uniform1i(state.uTexture, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.texture);
        gl.drawElements(gl.TRIANGLES, state.indexCount, gl.UNSIGNED_SHORT, 0);

        hudCtx.clearRect(0, 0, width, height);

        // Ambient field / particles.
        const grd = hudCtx.createRadialGradient(width * 0.5, height * 0.48, height * 0.06, width * 0.5, height * 0.48, Math.min(width, height) * 0.63);
        grd.addColorStop(0, 'rgba(47,214,255,.055)');
        grd.addColorStop(0.45, 'rgba(72,80,255,.035)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        hudCtx.fillStyle = grd;
        hudCtx.fillRect(0, 0, width, height);

        // Rotating orbital rings.
        const cx = width * 0.5;
        const cy = height * 0.49;
        const base = Math.min(width, height) * 0.29;

        hudCtx.save();
        for (let i = 0; i < 3; i += 1) {
          hudCtx.strokeStyle = i === 1 ? 'rgba(161,79,255,.17)' : 'rgba(45,223,255,.17)';
          hudCtx.lineWidth = 1;
          hudCtx.beginPath();
          hudCtx.ellipse(
            cx,
            cy + base * 0.05,
            base * (1.22 - i * 0.13),
            base * (0.28 - i * 0.035),
            -0.22 + elapsed * (0.08 + i * 0.025),
            0,
            TAU,
          );
          hudCtx.stroke();
        }
        hudCtx.restore();

        // Ground platform.
        hudCtx.save();
        hudCtx.strokeStyle = 'rgba(52,231,255,.18)';
        hudCtx.lineWidth = 1;
        hudCtx.beginPath();
        hudCtx.ellipse(cx, height * 0.865, Math.min(width * 0.42, base * 1.6), Math.min(height * 0.065, base * 0.24), 0, 0, TAU);
        hudCtx.stroke();

        hudCtx.strokeStyle = 'rgba(156,78,255,.14)';
        hudCtx.beginPath();
        hudCtx.ellipse(cx, height * 0.878, Math.min(width * 0.30, base * 1.28), Math.min(height * 0.04, base * 0.15), 0, 0, TAU);
        hudCtx.stroke();
        hudCtx.restore();

        // Central N badge.
        hudCtx.save();
        hudCtx.fillStyle = 'rgba(2,12,24,.58)';
        hudCtx.strokeStyle = 'rgba(73,226,255,.48)';
        hudCtx.shadowColor = 'rgba(66,230,255,.30)';
        hudCtx.shadowBlur = 18;
        hudCtx.beginPath();
        hudCtx.roundRect(cx - base * 0.22, cy - base * 0.22, base * 0.44, base * 0.44, base * 0.075);
        hudCtx.fill();
        hudCtx.stroke();

        hudCtx.shadowColor = 'rgba(129,76,255,.34)';
        hudCtx.shadowBlur = 22;
        hudCtx.strokeStyle = 'rgba(152,83,255,.34)';
        hudCtx.beginPath();
        hudCtx.roundRect(cx - base * 0.19, cy - base * 0.19, base * 0.38, base * 0.38, base * 0.06);
        hudCtx.stroke();

        hudCtx.shadowColor = 'rgba(70,236,255,.85)';
        hudCtx.shadowBlur = 18;
        hudCtx.fillStyle = '#efffff';
        hudCtx.font = `800 ${Math.max(44, base * 0.33)}px Orbitron, sans-serif`;
        hudCtx.textAlign = 'center';
        hudCtx.textBaseline = 'middle';
        hudCtx.fillText('N', cx, cy + 2);
        hudCtx.restore();

        // Region nodes follow the spinning Earth.
        const mobileNodes = window.innerWidth < 760;
        const activeNodes = mobileNodes ? nodes.filter((n) => ['ASIA', 'AUSTRALIA', 'EUROPE'].includes(n.label)) : nodes;
        const visible: Array<ReturnType<typeof projectNode> & { node: RegionNode }> = [];

        for (const node of activeNodes) {
          const p = projectNode(node, rotation, pitch, width, height);
          if (!p.visible) continue;
          visible.push({ ...p, node });
        }

        for (const point of visible) {
          const pulse = 0.72 + 0.28 * Math.sin(elapsed * 2.7 + point.node.lat);
          const color = point.node.color === 'cyan' ? 'rgba(65,231,255,' : 'rgba(171,91,255,';

          hudCtx.save();
          hudCtx.fillStyle = `${color}${(0.14 * pulse).toFixed(2)})`;
          hudCtx.beginPath();
          hudCtx.arc(point.x, point.y, 12 + 6 * pulse, 0, TAU);
          hudCtx.fill();

          hudCtx.fillStyle = point.node.color === 'cyan' ? '#4de9ff' : '#b06cff';
          hudCtx.shadowColor = point.node.color === 'cyan' ? '#4de9ff' : '#b06cff';
          hudCtx.shadowBlur = 11;
          hudCtx.beginPath();
          hudCtx.arc(point.x, point.y, 3.1 + pulse * 1.2, 0, TAU);
          hudCtx.fill();
          hudCtx.restore();

          const align = point.x < cx ? 'left' : 'right';
          drawLabel(hudCtx, point.x, point.y, point.node.label, point.node.color, align);
        }

        // Bracket corners.
        hudCtx.save();
        hudCtx.strokeStyle = 'rgba(221,247,255,.80)';
        hudCtx.lineWidth = 1.4;
        const c = 22;
        const m = 15;
        const corners = [
          [m, m, 1, 1],
          [width - m, m, -1, 1],
          [m, height - m, 1, -1],
          [width - m, height - m, -1, -1],
        ] as const;
        corners.forEach(([x, y, sx, sy]) => {
          hudCtx.beginPath();
          hudCtx.moveTo(x, y + c * sy);
          hudCtx.lineTo(x, y);
          hudCtx.lineTo(x + c * sx, y);
          hudCtx.stroke();
        });
        hudCtx.restore();

        // Live / paused indicator.
        hudCtx.save();
        hudCtx.fillStyle = current.status === 'LIVE' ? '#55f4bf' : '#ffd35c';
        hudCtx.shadowColor = hudCtx.fillStyle;
        hudCtx.shadowBlur = 11;
        hudCtx.beginPath();
        hudCtx.arc(width - 53, 31, 4, 0, TAU);
        hudCtx.fill();
        hudCtx.shadowBlur = 0;
        hudCtx.font = '800 10px Orbitron, sans-serif';
        hudCtx.fillStyle = current.status === 'LIVE' ? '#58efc1' : '#ffd35c';
        hudCtx.textAlign = 'right';
        hudCtx.fillText(current.status === 'LIVE' ? 'LIVE' : 'PAUSED', width - 15, 35);

        hudCtx.font = '800 9px Orbitron, sans-serif';
        hudCtx.fillStyle = 'rgba(172,215,233,.72)';
        hudCtx.textAlign = 'left';
        hudCtx.fillText('GLOBAL NETWORK', 15, 35);
        hudCtx.restore();

        // Small metrics pinned to the bottom corners.
        hudCtx.save();
        hudCtx.font = '800 8px Orbitron, sans-serif';
        hudCtx.fillStyle = 'rgba(132,165,181,.74)';
        hudCtx.textAlign = 'left';
        hudCtx.fillText('HASHRATE', 23, height - 56);
        hudCtx.font = '800 13px Orbitron, sans-serif';
        hudCtx.fillStyle = '#f0fdff';
        hudCtx.fillText(`${current.activeHashrate} H/S`, 23, height - 38);

        hudCtx.textAlign = 'right';
        hudCtx.font = '800 8px Orbitron, sans-serif';
        hudCtx.fillStyle = 'rgba(132,165,181,.74)';
        hudCtx.fillText('MINERS', width - 23, height - 56);
        hudCtx.font = '800 13px Orbitron, sans-serif';
        hudCtx.fillStyle = '#f0fdff';
        hudCtx.fillText(current.activeMiners, width - 23, height - 38);
        hudCtx.restore();

        frame = window.requestAnimationFrame(draw);
      };

      resize();
      frame = window.requestAnimationFrame(draw);
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerLeave);
      motion.addEventListener('change', onMotion);

      return () => {
        disposed = true;
        observer.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
        motion.removeEventListener('change', onMotion);
        window.cancelAnimationFrame(frame);
        gl.deleteTexture(state.texture);
        gl.deleteBuffer(state.position);
        gl.deleteBuffer(state.normal);
        gl.deleteBuffer(state.uv);
        gl.deleteBuffer(state.index);
        gl.deleteProgram(state.program);
      };
    } catch {
      return;
    }
  }, []);

  return (
    <div className={styles.root} aria-label="Live holographic global network">
      <div className={styles.atmosphere} />
      <canvas ref={glRef} className={styles.glCanvas} aria-hidden="true" />
      <canvas ref={hudRef} className={styles.hudCanvas} aria-hidden="true" />
      <div className={styles.topScan} aria-hidden="true" />
      <div className={styles.baseGlow} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTL}`} />
      <span className={`${styles.corner} ${styles.cornerTR}`} />
      <span className={`${styles.corner} ${styles.cornerBL}`} />
      <span className={`${styles.corner} ${styles.cornerBR}`} />
      <div className={styles.caption}>REAL-TIME CORE VISUAL</div>
      <div className={styles.mode}>3D / 360°</div>
    </div>
  );
}
