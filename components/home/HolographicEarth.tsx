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
  accent: 'cyan' | 'violet';
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
  uTime: WebGLUniformLocation | null;
  uParallax: WebGLUniformLocation | null;
  uTexture: WebGLUniformLocation | null;
};

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const regionNodes: RegionNode[] = [
  { lat: 42, lon: -100, label: 'AMERICAS', accent: 'cyan' },
  { lat: 48, lon: 16, label: 'EUROPE', accent: 'violet' },
  { lat: 13, lon: 104, label: 'ASIA', accent: 'cyan' },
  { lat: 1, lon: 24, label: 'AFRICA', accent: 'violet' },
  { lat: -28, lon: 135, label: 'AUSTRALIA', accent: 'cyan' },
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
varying float vDepth;
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0.,0.,c,-s,0.,s,c); }
void main(){
  mat3 r = rotX(uPitch + uParallax.y * 0.045) * rotY(uRotation + uParallax.x * 0.06);
  vec3 p = r * aPosition;
  p.xy += uParallax * 0.003;
  p.z -= 2.72;
  vNormal = r * aNormal;
  vUv = aUv;
  vDepth = p.z;
  gl_Position = uProjection * vec4(p,1.0);
}
`;

const fragmentShader = `
precision mediump float;
uniform sampler2D uTexture;
uniform float uTime;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main(){
  vec3 view = normalize(vec3(0.0,0.0,-1.0));
  vec3 lightDir = normalize(vec3(-0.35,0.50,1.0));
  float light = max(dot(normalize(vNormal), lightDir), 0.0);
  float fresnel = pow(1.0-max(dot(normalize(vNormal),view),0.0),2.4);
  vec4 tex = texture2D(uTexture, vUv);
  float luminance = dot(tex.rgb, vec3(0.2126,0.7152,0.0722));
  float scan = smoothstep(0.0,1.0,0.5+0.5*sin((vUv.y*8.0-uTime*0.55)*6.28318));
  vec3 base = tex.rgb;
  base *= 0.72 + 0.28 * light;
  base += vec3(0.0,0.10,0.18) * (1.0-luminance);
  base += vec3(0.06,0.26,0.42) * fresnel;
  base += vec3(0.02,0.10,0.14) * scan * 0.18;
  float alpha = 0.82 + fresnel * 0.15;
  gl_FragColor = vec4(base, alpha);
}
`;

function makeProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
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

  const uploadFloat = (data: number[]) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('WebGL buffer allocation failed');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
  };
  const uploadIndex = (data: number[]) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('WebGL index allocation failed');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
    return buffer;
  };

  return {
    position: uploadFloat(positions),
    normal: uploadFloat(normals),
    uv: uploadFloat(uvs),
    index: uploadIndex(indices),
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
  const x0 = cp * Math.sin(lambda);
  const y0 = sp;
  const z0 = cp * Math.cos(lambda);
  const cy = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
  const cz = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
  const radius = Math.min(width, height) * 0.30;
  return {
    x: width / 2 + x0 * radius,
    y: height * 0.51 - cy * radius,
    visible: cz > 0.16,
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

export function HolographicEarth({ metrics }: { metrics: EarthMetrics }) {
  const metricsRef = useRef<EarthMetrics>(metrics);
  metricsRef.current = metrics;
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    const canvas = glRef.current;
    const hud = hudRef.current;
    if (!canvas || !hud) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    const hudCtx = hud.getContext('2d');
    if (!gl || !hudCtx) return;

    let state: GLState;
    try {
      const program = makeProgram(gl);
      const sphere = buildSphere(gl, window.innerWidth < 700 ? 48 : 72, window.innerWidth < 700 ? 24 : 36);
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture allocation failed');
      const image = new Image();
      image.decoding = 'async';
      image.src = '/assets/home/earth-hologram-map.webp';
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
        uTime: gl.getUniformLocation(program, 'uTime'),
        uParallax: gl.getUniformLocation(program, 'uParallax'),
        uTexture: gl.getUniformLocation(program, 'uTexture'),
      };
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 25, 45, 255]));
      image.onload = () => {
        if (disposed || !gl.isTexture(state.texture)) return;
        gl.bindTexture(gl.TEXTURE_2D, state.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      };
      image.onerror = () => {};
    } catch {
      return;
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motion.matches;
    reducedRef.current = reduced;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let startedAt = performance.now();
    let parallaxX = 0;
    let parallaxY = 0;
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      hud.width = Math.max(1, Math.round(width * dpr));
      hud.height = Math.max(1, Math.round(height * dpr));
      hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const handleMotion = () => {
      reduced = motion.matches;
      reducedRef.current = reduced;
      startedAt = performance.now();
    };

    const handlePointer = (event: PointerEvent) => {
      if (window.innerWidth < 760) return;
      const rect = canvas.getBoundingClientRect();
      parallaxX = clamp((event.clientX - (rect.left + rect.width / 2)) / rect.width, -0.5, 0.5) * 12;
      parallaxY = clamp((event.clientY - (rect.top + rect.height / 2)) / rect.height, -0.5, 0.5) * 8;
    };
    const clearPointer = () => { parallaxX = 0; parallaxY = 0; };

    const drawHud = (time: number, rotation: number, pitch: number) => {
      hudCtx.clearRect(0, 0, width, height);
      hudCtx.save();
      const cx = width / 2;
      const cy = height * 0.51;
      const radius = Math.min(width, height) * 0.30;
      const currentMetrics = metricsRef.current;

      const glow = hudCtx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.45);
      glow.addColorStop(0, 'rgba(36, 220, 255, .07)');
      glow.addColorStop(.52, 'rgba(64, 91, 255, .045)');
      glow.addColorStop(1, 'rgba(130, 50, 255, 0)');
      hudCtx.fillStyle = glow;
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, radius * 1.45, 0, TAU);
      hudCtx.fill();

      hudCtx.strokeStyle = 'rgba(61,224,255,.20)';
      hudCtx.lineWidth = 1;
      hudCtx.beginPath();
      hudCtx.ellipse(cx, cy + radius * 1.00, radius * 1.28, radius * .24, 0, 0, TAU);
      hudCtx.stroke();
      hudCtx.strokeStyle = 'rgba(163,82,255,.18)';
      hudCtx.beginPath();
      hudCtx.ellipse(cx, cy + radius * 1.03, radius * .98, radius * .17, 0.05, 0, TAU);
      hudCtx.stroke();

      hudCtx.globalCompositeOperation = 'lighter';
      const orbit = (rx: number, ry: number, rot: number, phase: number, accent: string) => {
        hudCtx.save();
        hudCtx.translate(cx, cy);
        hudCtx.rotate(rot);
        hudCtx.strokeStyle = accent;
        hudCtx.lineWidth = 1;
        hudCtx.beginPath();
        hudCtx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        hudCtx.stroke();
        const a = phase + time * 0.48;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        hudCtx.beginPath();
        hudCtx.arc(x, y, 3.1, 0, TAU);
        hudCtx.fillStyle = accent;
        hudCtx.shadowColor = accent;
        hudCtx.shadowBlur = 13;
        hudCtx.fill();
        hudCtx.restore();
      };
      orbit(radius * 1.60, radius * .43, -.30, .2, 'rgba(48,231,255,.52)');
      orbit(radius * 1.35, radius * .32, .90, 1.9, 'rgba(167,83,255,.45)');
      orbit(radius * 1.18, radius * .24, -1.20, 3.6, 'rgba(78,156,255,.32)');
      hudCtx.globalCompositeOperation = 'source-over';

      const centerR = width < 700 ? 44 : 58;
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, centerR, 0, TAU);
      hudCtx.fillStyle = 'rgba(3,12,24,.72)';
      hudCtx.fill();
      const edge = hudCtx.createLinearGradient(cx-centerR, cy-centerR, cx+centerR, cy+centerR);
      edge.addColorStop(0, 'rgba(55,240,255,.95)');
      edge.addColorStop(.55, 'rgba(86,124,255,.82)');
      edge.addColorStop(1, 'rgba(186,73,255,.95)');
      hudCtx.strokeStyle = edge;
      hudCtx.lineWidth = 1.8;
      hudCtx.shadowColor = 'rgba(66,231,255,.72)';
      hudCtx.shadowBlur = 16;
      hudCtx.stroke();
      hudCtx.shadowBlur = 0;
      hudCtx.textAlign = 'center';
      hudCtx.textBaseline = 'middle';
      hudCtx.font = `800 ${width < 700 ? 40 : 54}px Orbitron, sans-serif`;
      hudCtx.fillStyle = '#f6ffff';
      hudCtx.shadowColor = 'rgba(80,231,255,.88)';
      hudCtx.shadowBlur = 13;
      hudCtx.fillText('N', cx, cy + 1);
      hudCtx.shadowBlur = 0;

      for (const node of regionNodes) {
        const point = projectNode(node, rotation, pitch, width, height);
        if (!point.visible) continue;
        const cardW = width < 700 ? 86 : 102;
        const cardH = 31;
        const left = clamp(point.x + (node.lon < 0 ? -cardW - 7 : 7), 7, width - cardW - 7);
        const top = clamp(point.y - cardH / 2, 24, height - cardH - 24);
        const pulse = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2.1 + node.lat));
        const accent = node.accent === 'cyan' ? `rgba(47,231,255,${pulse.toFixed(3)})` : `rgba(170,88,255,${pulse.toFixed(3)})`;
        roundedRect(hudCtx, left, top, cardW, cardH, 8);
        hudCtx.fillStyle = 'rgba(2,10,21,.82)';
        hudCtx.fill();
        hudCtx.strokeStyle = accent;
        hudCtx.lineWidth = 1;
        hudCtx.stroke();
        hudCtx.beginPath();
        hudCtx.arc(left + 10, top + 10, 2.6, 0, TAU);
        hudCtx.fillStyle = accent;
        hudCtx.fill();
        hudCtx.font = '800 7px Orbitron, sans-serif';
        hudCtx.fillStyle = '#eafcff';
        hudCtx.textAlign = 'left';
        hudCtx.fillText(node.label, left + 17, top + 11);
        hudCtx.font = '600 7px Rajdhani, sans-serif';
        hudCtx.fillStyle = '#79a9bd';
        const stateLabel = currentMetrics.status === 'LIVE' ? `${currentMetrics.asset} · LIVE` : `${currentMetrics.asset} · PAUSED`;
        hudCtx.fillText(stateLabel, left + 17, top + 22);
        hudCtx.strokeStyle = node.accent === 'cyan' ? 'rgba(47,231,255,.22)' : 'rgba(170,88,255,.20)';
        hudCtx.beginPath();
        hudCtx.moveTo(point.x, point.y);
        hudCtx.lineTo(node.lon < 0 ? left + cardW : left, top + cardH / 2);
        hudCtx.stroke();
      }

      const metricW = width < 700 ? 102 : 124;
      const metricH = 38;
      const metricsY = height - metricH - (width < 700 ? 38 : 46);
      const boxes = [
        { label: 'HASHRATE', value: `${currentMetrics.activeHashrate} H/s`, x: width < 700 ? 10 : 18 },
        { label: 'MINERS', value: currentMetrics.activeMiners, x: width < 700 ? width - metricW - 10 : width - metricW - 18 },
      ];
      for (const box of boxes) {
        roundedRect(hudCtx, box.x, metricsY, metricW, metricH, 8);
        hudCtx.fillStyle = 'rgba(2,10,21,.72)';
        hudCtx.fill();
        hudCtx.strokeStyle = 'rgba(50,187,239,.17)';
        hudCtx.stroke();
        hudCtx.textAlign = 'left';
        hudCtx.font = '700 6.5px Orbitron, sans-serif';
        hudCtx.fillStyle = '#64889a';
        hudCtx.fillText(box.label, box.x + 9, metricsY + 12);
        hudCtx.font = '800 10px Orbitron, sans-serif';
        hudCtx.fillStyle = '#eefcff';
        hudCtx.fillText(box.value, box.x + 9, metricsY + 26);
      }

      hudCtx.textAlign = 'left';
      hudCtx.font = '700 7px Rajdhani, sans-serif';
      hudCtx.fillStyle = '#6f95a7';
      hudCtx.fillText('GLOBAL NETWORK', width < 700 ? 15 : 22, 18);
      hudCtx.textAlign = 'right';
      hudCtx.fillStyle = currentMetrics.status === 'LIVE' ? '#63f2c0' : '#ffd66d';
      hudCtx.fillText(currentMetrics.status === 'LIVE' ? 'LIVE' : 'PAUSED', width < 700 ? width - 15 : width - 22, 18);

      hudCtx.restore();
    };

    const render = (now: number) => {
      const time = reduced ? 0.8 : (now - startedAt) / 1000;
      const rotation = reduced ? 0.30 : time * 0.26;
      const pitch = reduced ? 0.02 : Math.sin(time * 0.16) * 0.025;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(state.program);

      const posLoc = gl.getAttribLocation(state.program, 'aPosition');
      const normLoc = gl.getAttribLocation(state.program, 'aNormal');
      const uvLoc = gl.getAttribLocation(state.program, 'aUv');
      gl.bindBuffer(gl.ARRAY_BUFFER, state.position);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.normal);
      gl.enableVertexAttribArray(normLoc);
      gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.uv);
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.index);
      gl.uniformMatrix4fv(state.uProjection, false, perspective(0.90, Math.max(width / height, 0.55), 0.1, 10));
      gl.uniform1f(state.uRotation, rotation);
      gl.uniform1f(state.uPitch, pitch);
      gl.uniform1f(state.uTime, time);
      gl.uniform2f(state.uParallax, parallaxX, parallaxY);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, state.texture);
      gl.uniform1i(state.uTexture, 0);
      gl.drawElements(gl.TRIANGLES, state.indexCount, gl.UNSIGNED_SHORT, 0);
      drawHud(time, rotation, pitch);
      if (!reduced) frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    motion.addEventListener?.('change', handleMotion);
    canvas.addEventListener('pointermove', handlePointer, { passive: true });
    canvas.addEventListener('pointerleave', clearPointer, { passive: true });
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener?.('change', handleMotion);
      canvas.removeEventListener('pointermove', handlePointer);
      canvas.removeEventListener('pointerleave', clearPointer);
      window.cancelAnimationFrame(frame);
      gl.deleteTexture(state.texture);
      gl.deleteBuffer(state.position);
      gl.deleteBuffer(state.normal);
      gl.deleteBuffer(state.uv);
      gl.deleteBuffer(state.index);
      gl.deleteProgram(state.program);
    };
  }, []);

  return (
    <div className={styles.root} aria-label="Animated NextGen global network visual">
      <div className={styles.atmosphere} />
      <canvas ref={glRef} className={styles.glCanvas} />
      <canvas ref={hudRef} className={styles.hudCanvas} />
      <div className={styles.corner + ' ' + styles.cornerTL} />
      <div className={styles.corner + ' ' + styles.cornerTR} />
      <div className={styles.corner + ' ' + styles.cornerBL} />
      <div className={styles.corner + ' ' + styles.cornerBR} />
      <div className={styles.baseGlow} />
    </div>
  );
}
