'use client';

import { useEffect, useRef } from 'react';
import styles from './HolographicEarth.module.css';

type HudNode = {
  lat: number;
  lon: number;
  label: string;
  value: string;
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
  uTime: WebGLUniformLocation | null;
};

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const continentPolygons: number[][][] = [
  [[-168,72],[-145,70],[-130,60],[-124,52],[-115,48],[-105,32],[-93,20],[-82,22],[-79,10],[-92,12],[-106,23],[-121,34],[-140,43],[-154,54]],
  [[-82,12],[-58,12],[-38,4],[-44,-7],[-49,-20],[-57,-37],[-67,-55],[-77,-50],[-82,-30],[-79,-10]],
  [[-12,36],[8,35],[24,38],[31,48],[46,53],[63,61],[82,69],[115,71],[145,64],[166,53],[154,39],[134,28],[119,18],[104,10],[87,15],[73,25],[57,28],[44,19],[31,21],[21,29],[9,33],[-2,34]],
  [[-19,35],[-1,37],[18,35],[33,31],[39,16],[34,3],[40,-11],[30,-24],[23,-35],[9,-36],[-4,-27],[-10,-10],[-17,6]],
  [[111,-10],[129,-11],[149,-18],[156,-31],[151,-40],[132,-44],[116,-36],[111,-22]],
  [[-55,58],[-41,61],[-25,73],[-39,82],[-56,77],[-64,67]],
  [[-55,-60],[-20,-70],[20,-72],[58,-67],[100,-72],[145,-74],[165,-79],[-160,-79],[-112,-72]],
];

const hudNodes: HudNode[] = [
  { lat: 52, lon: -100, label: 'N. AMERICA', value: '428 NODES', color: 'cyan' },
  { lat: 49, lon: 16, label: 'EUROPE', value: '312 NODES', color: 'cyan' },
  { lat: 5, lon: 105, label: 'ASIA', value: '289 NODES', color: 'cyan' },
  { lat: 2, lon: 23, label: 'AFRICA', value: '109 NODES', color: 'violet' },
  { lat: -31, lon: 136, label: 'AUSTRALIA', value: '68 NODES', color: 'violet' },
  { lat: -18, lon: -60, label: 'S. AMERICA', value: '186 NODES', color: 'violet' },
];

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProjection;
uniform float uRotation;
uniform float uPitch;
varying vec3 vNormal;
varying vec2 vUv;
varying float vZ;
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0.,0.,c,-s,0.,s,c); }
void main(){
  mat3 r = rotX(uPitch) * rotY(uRotation);
  vec3 p = r * aPosition;
  p.z -= 2.6;
  vec3 n = r * aNormal;
  vNormal = n;
  vUv = aUv;
  vZ = p.z;
  gl_Position = uProjection * vec4(p,1.0);
}
`;

const fragmentShader = `
precision mediump float;
uniform sampler2D uLand;
uniform float uTime;
varying vec3 vNormal;
varying vec2 vUv;
varying float vZ;
void main(){
  vec3 view = normalize(vec3(0.,0.,-1.));
  float light = max(dot(normalize(vNormal), normalize(vec3(-0.35,0.45,1.0))),0.0);
  float fresnel = pow(1.0-max(dot(normalize(vNormal),view),0.0),2.35);
  vec4 land = texture2D(uLand, vUv);
  float lonGrid = abs(sin(vUv.x * 3.1415926 * 18.0));
  float latGrid = abs(sin((vUv.y - .5) * 3.1415926 * 18.0));
  float grid = smoothstep(.965,.999,max(lonGrid,latGrid));
  vec3 ocean = vec3(0.012,0.060,0.115) + light * vec3(0.015,0.095,0.18);
  vec3 landCol = mix(vec3(0.04,0.35,0.58),vec3(0.14,0.82,0.95),land.r);
  landCol += vec3(0.15,0.05,0.30) * (0.5 + 0.5*sin(uTime*0.65 + vUv.x*6.0));
  vec3 col = mix(ocean, landCol, land.a);
  col += grid * vec3(0.06,0.32,0.52) * (0.30 + 0.25*light);
  col += fresnel * vec3(0.08,0.60,0.95);
  float alpha = 0.72 + fresnel * 0.26;
  gl_FragColor = vec4(col, alpha);
}
`;

function pointInPolygon(x: number, y: number, poly: number[][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function buildLandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 512, 256);
  ctx.fillStyle = '#63e8ff';
  ctx.globalAlpha = 0.95;
  for (const poly of continentPolygons) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * 512;
      const y = ((90 - lat) / 180) * 256;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  // Add a restrained dot matrix so the land reads as holographic data.
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#d8fbff';
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 512; x += 4) {
      const lon = (x / 512) * 360 - 180;
      const lat = 90 - (y / 256) * 180;
      let land = false;
      for (const poly of continentPolygons) {
        if (pointInPolygon(lon, lat, poly)) { land = true; break; }
      }
      if (land) ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function makeProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader, src);
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
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

function buildSphere(gl: WebGLRenderingContext, segments = 64, rings = 32) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = Math.PI * (v - 0.5);
    const cp = Math.cos(phi), sp = Math.sin(phi);
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const theta = u * TAU;
      const p = [cp * Math.sin(theta), sp, cp * Math.cos(theta)];
      positions.push(...p); normals.push(...p); uvs.push(u, 1 - v);
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
  const upload = (target: number, data: number[] | Uint16Array) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('WebGL buffer allocation failed');
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data instanceof Uint16Array ? data : new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
  };
  return {
    position: upload(gl.ARRAY_BUFFER, positions),
    normal: upload(gl.ARRAY_BUFFER, normals),
    uv: upload(gl.ARRAY_BUFFER, uvs),
    index: upload(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices)),
    indexCount: indices.length,
  };
}

function perspective(fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect,0,0,0,0,f,0,0,0,0,(far + near) * nf,-1,0,0,(2 * far * near) * nf,0]);
}

function projectNode(node: HudNode, rotation: number, pitch: number, width: number, height: number) {
  const phi = node.lat * DEG;
  const lambda = node.lon * DEG + rotation;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const x0 = cp * Math.sin(lambda), y0 = sp, z0 = cp * Math.cos(lambda);
  const cx = x0, cy = y0 * Math.cos(pitch) - z0 * Math.sin(pitch), cz = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
  const radius = Math.min(width, height) * 0.31;
  return { x: width / 2 + cx * radius, y: height * 0.52 - cy * radius, visible: cz > 0.22, z: cz };
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

export function HolographicEarth() {
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = glRef.current;
    const hud = hudRef.current;
    if (!canvas || !hud) return;
    const gl = (canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    const hudCtx = hud.getContext('2d');
    if (!hudCtx) return;
    if (!gl) {
      const rect = hud.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2);
      hud.width = Math.max(1, Math.round(rect.width * dpr));
      hud.height = Math.max(1, Math.round(rect.height * dpr));
      hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = Math.min(rect.width, rect.height) * 0.30;
      hudCtx.clearRect(0, 0, rect.width, rect.height);
      hudCtx.fillStyle = 'rgba(4,16,31,.78)';
      hudCtx.beginPath(); hudCtx.arc(rect.width/2, rect.height*.52, r, 0, TAU); hudCtx.fill();
      hudCtx.strokeStyle = 'rgba(58,229,255,.55)'; hudCtx.lineWidth = 2; hudCtx.stroke();
      hudCtx.strokeStyle = 'rgba(95,155,255,.22)'; hudCtx.lineWidth = 1;
      for (let i=-60;i<=60;i+=20){ hudCtx.beginPath(); hudCtx.ellipse(rect.width/2, rect.height*.52, r*Math.cos(i*DEG), r, 0, 0, TAU); hudCtx.stroke(); }
      hudCtx.fillStyle = '#f5ffff'; hudCtx.font = `800 ${rect.width < 700 ? 56 : 68}px Orbitron, sans-serif`; hudCtx.textAlign='center'; hudCtx.textBaseline='middle'; hudCtx.shadowColor='rgba(70,225,255,.8)'; hudCtx.shadowBlur=18; hudCtx.fillText('N',rect.width/2,rect.height*.52);
      return;
    }

    let width = 1, height = 1, dpr = 1, reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start = performance.now();
    let frame = 0;
    let parallaxX = 0;
    let parallaxY = 0;
    let state: GLState;

    try {
      const program = makeProgram(gl);
      const sphere = buildSphere(gl, window.innerWidth < 700 ? 44 : 64, window.innerWidth < 700 ? 22 : 32);
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture allocation failed');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildLandTexture());
      state = {
        gl, program, position: sphere.position, normal: sphere.normal, uv: sphere.uv, index: sphere.index,
        indexCount: sphere.indexCount, texture,
        uProjection: gl.getUniformLocation(program, 'uProjection'),
        uRotation: gl.getUniformLocation(program, 'uRotation'),
        uPitch: gl.getUniformLocation(program, 'uPitch'),
        uTime: gl.getUniformLocation(program, 'uTime'),
      };
    } catch {
      return;
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2);
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      hud.width = Math.round(width * dpr); hud.height = Math.round(height * dpr);
      hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const handleMotion = () => { reduced = motion.matches; if (!reduced) start = performance.now(); };
    const handlePointer = (event: PointerEvent) => {
      if (window.innerWidth < 700) return;
      const rect = canvas.getBoundingClientRect();
      parallaxX = clamp((event.clientX - (rect.left + rect.width / 2)) / rect.width, -0.5, 0.5) * 18;
      parallaxY = clamp((event.clientY - (rect.top + rect.height / 2)) / rect.height, -0.5, 0.5) * 12;
    };
    const clearPointer = () => { parallaxX = 0; parallaxY = 0; };

    const drawHud = (time: number, rotation: number, pitch: number) => {
      hudCtx.clearRect(0, 0, width, height);
      hudCtx.save();
      hudCtx.translate(parallaxX, parallaxY);
      const cx = width / 2, cy = height * 0.52, radius = Math.min(width, height) * 0.31;
      hudCtx.globalCompositeOperation = 'lighter';
      const orbit = (rx: number, ry: number, rot: number, phase: number, col: string) => {
        hudCtx.save(); hudCtx.translate(cx, cy); hudCtx.rotate(rot);
        hudCtx.strokeStyle = col; hudCtx.lineWidth = 1;
        hudCtx.beginPath(); hudCtx.ellipse(0, 0, rx, ry, 0, 0, TAU); hudCtx.stroke();
        const a = phase + time * 0.58;
        const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
        hudCtx.beginPath(); hudCtx.arc(x, y, 3.8, 0, TAU); hudCtx.fillStyle = col; hudCtx.shadowColor = col; hudCtx.shadowBlur = 14; hudCtx.fill();
        hudCtx.restore();
      };
      orbit(radius * 1.55, radius * 0.40, -0.30, .3, 'rgba(45,224,255,.55)');
      orbit(radius * 1.34, radius * 0.31, 0.95, 1.8, 'rgba(169,87,255,.45)');
      orbit(radius * 1.16, radius * 0.22, -1.28, 3.1, 'rgba(81,145,255,.30)');

      hudCtx.globalCompositeOperation = 'source-over';
      hudCtx.strokeStyle = 'rgba(72,219,255,.10)';
      hudCtx.lineWidth = 1;
      hudCtx.beginPath(); hudCtx.ellipse(cx, cy, radius * 1.18, radius * 1.18, 0, 0, TAU); hudCtx.stroke();
      hudCtx.beginPath(); hudCtx.ellipse(cx, cy + radius * .94, radius * 1.14, radius * .22, 0, 0, TAU); hudCtx.stroke();
      hudCtx.strokeStyle = 'rgba(168,82,255,.13)';
      hudCtx.beginPath(); hudCtx.ellipse(cx, cy + radius * .94, radius * .87, radius * .16, 0, 0, TAU); hudCtx.stroke();

      const centerR = width < 700 ? 56 : 69;
      hudCtx.beginPath(); hudCtx.arc(cx, cy, centerR, 0, TAU); hudCtx.fillStyle = 'rgba(2,10,22,.72)'; hudCtx.fill();
      const g = hudCtx.createLinearGradient(cx-centerR, cy-centerR, cx+centerR, cy+centerR);
      g.addColorStop(0,'rgba(58,239,255,.95)'); g.addColorStop(.56,'rgba(91,116,255,.75)'); g.addColorStop(1,'rgba(181,70,255,.95)');
      hudCtx.strokeStyle = g; hudCtx.lineWidth = 2; hudCtx.shadowColor = 'rgba(60,220,255,.65)'; hudCtx.shadowBlur = 18; hudCtx.stroke(); hudCtx.shadowBlur = 0;
      hudCtx.fillStyle = '#f5ffff'; hudCtx.textAlign = 'center'; hudCtx.textBaseline = 'middle'; hudCtx.font = `800 ${width < 700 ? 54 : 64}px Orbitron, sans-serif`; hudCtx.shadowColor = 'rgba(64,230,255,.85)'; hudCtx.shadowBlur = 16; hudCtx.fillText('N', cx, cy + 2);
      hudCtx.shadowBlur = 0;

      for (const node of hudNodes) {
        const p = projectNode(node, rotation, pitch, width, height);
        if (!p.visible) continue;
        const w = width < 700 ? 100 : 120, h = 36;
        const left = clamp(p.x + (node.lon < 0 ? -w - 10 : 10), 8, width - w - 8);
        const top = clamp(p.y - h / 2, 10, height - h - 10);
        const pulse = 0.72 + 0.18 * Math.sin(time * 2 + node.lat);
        const accent = node.color === 'cyan' ? `rgba(55,228,255,${pulse})` : `rgba(174,91,255,${pulse})`;
        roundedRect(hudCtx, left, top, w, h, 8);
        hudCtx.fillStyle = 'rgba(2,11,23,.85)'; hudCtx.fill(); hudCtx.strokeStyle = accent; hudCtx.lineWidth = 1; hudCtx.stroke();
        hudCtx.beginPath(); hudCtx.arc(left + 11, top + 11, 3, 0, TAU); hudCtx.fillStyle = accent; hudCtx.fill();
        hudCtx.font = '700 8px Orbitron, sans-serif'; hudCtx.fillStyle = '#e5faff'; hudCtx.fillText(node.label, left + 20, top + 13);
        hudCtx.font = '600 8px Rajdhani, sans-serif'; hudCtx.fillStyle = '#86b0c4'; hudCtx.fillText(node.value, left + 20, top + 26);
        hudCtx.strokeStyle = accent.replace(/0\.[0-9]+\)$/, '0.20)'); hudCtx.beginPath(); hudCtx.moveTo(p.x, p.y); hudCtx.lineTo(node.lon < 0 ? left + w : left, top + h / 2); hudCtx.stroke();
      }
      hudCtx.restore();
    };

    const render = (now: number) => {
      const time = reduced ? 0.4 : (now - start) / 1000;
      const rotation = reduced ? 0.22 : time * 0.38;
      const pitch = reduced ? 0.02 : Math.sin(time * 0.15) * 0.035;
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.useProgram(state.program);
      const posLoc = gl.getAttribLocation(state.program, 'aPosition');
      const normLoc = gl.getAttribLocation(state.program, 'aNormal');
      const uvLoc = gl.getAttribLocation(state.program, 'aUv');
      gl.bindBuffer(gl.ARRAY_BUFFER, state.position); gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.normal); gl.enableVertexAttribArray(normLoc); gl.vertexAttribPointer(normLoc,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.uv); gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc,2,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.index);
      gl.uniformMatrix4fv(state.uProjection,false,perspective(0.95, Math.max(width/height, 0.5), 0.1, 10));
      gl.uniform1f(state.uRotation, rotation);
      gl.uniform1f(state.uPitch, pitch);
      gl.uniform1f(state.uTime, time);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.texture); gl.uniform1i(gl.getUniformLocation(state.program,'uLand'),0);
      gl.drawElements(gl.TRIANGLES,state.indexCount,gl.UNSIGNED_SHORT,0);
      drawHud(time, rotation, pitch);
      frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas); resize();
    motion.addEventListener?.('change', handleMotion);
    canvas.addEventListener('pointermove', handlePointer, { passive: true });
    canvas.addEventListener('pointerleave', clearPointer, { passive: true });
    frame = window.requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      motion.removeEventListener?.('change', handleMotion);
      canvas.removeEventListener('pointermove', handlePointer);
      canvas.removeEventListener('pointerleave', clearPointer);
      window.cancelAnimationFrame(frame);
      gl.deleteTexture(state.texture); gl.deleteBuffer(state.position); gl.deleteBuffer(state.normal); gl.deleteBuffer(state.uv); gl.deleteBuffer(state.index); gl.deleteProgram(state.program);
    };
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      <canvas ref={glRef} className={styles.glCanvas} />
      <canvas ref={hudRef} className={styles.hudCanvas} />
      <div className={styles.hudTop}><span>GLOBAL NETWORK</span><b><i /> LIVE</b></div>
      <div className={styles.hudBottom}><span>REAL-TIME CORE VISUAL</span><em>3D / 360°</em></div>
      <div className={`${styles.corner} ${styles.cornerTL}`} /><div className={`${styles.corner} ${styles.cornerTR}`} /><div className={`${styles.corner} ${styles.cornerBL}`} /><div className={`${styles.corner} ${styles.cornerBR}`} />
    </div>
  );
}
