/* components/landing/NetworkCore.tsx */
'use client';

import { useEffect, useRef } from 'react';

type Dot = [number, number];

const LAND_POINTS: Dot[] = [
  [-0.74, -0.28], [-0.67, -0.37], [-0.59, -0.43], [-0.51, -0.36],
  [-0.47, -0.18], [-0.39, -0.05], [-0.30, 0.08], [-0.23, 0.24],
  [-0.15, 0.31], [-0.07, 0.24], [0.02, 0.15], [0.12, 0.08],
  [0.21, 0.01], [0.30, -0.08], [0.40, -0.18], [0.49, -0.25],
  [0.58, -0.18], [0.66, -0.05], [0.70, 0.09], [0.60, 0.17],
  [0.49, 0.22], [0.36, 0.29], [0.22, 0.36], [0.09, 0.43],
  [-0.01, 0.47], [-0.13, 0.43], [-0.25, 0.39], [-0.37, 0.34],
  [-0.48, 0.25], [-0.58, 0.14], [-0.66, 0.02], [-0.72, -0.10],
];

function drawGlobe(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const dpr = window.devicePixelRatio || 1;
  const w = width / dpr;
  const h = height / dpr;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.30;
  const t = time * 0.00012;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const glow = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.55);
  glow.addColorStop(0, 'rgba(39,234,255,0.22)');
  glow.addColorStop(0.45, 'rgba(52,112,255,0.09)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  const sphere = ctx.createRadialGradient(
    cx - radius * 0.32,
    cy - radius * 0.34,
    radius * 0.05,
    cx,
    cy,
    radius
  );
  sphere.addColorStop(0, 'rgba(143,251,255,0.30)');
  sphere.addColorStop(0.38, 'rgba(38,140,255,0.16)');
  sphere.addColorStop(0.78, 'rgba(38,64,160,0.08)');
  sphere.addColorStop(1, 'rgba(1,7,18,0)');
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.995, 0, Math.PI * 2);
  ctx.clip();

  ctx.lineWidth = 0.75;
  ctx.strokeStyle = 'rgba(53,227,255,0.24)';
  for (let i = -4; i <= 4; i += 1) {
    const lat = (i / 4) * Math.PI * 0.46;
    const y = cy + Math.sin(lat) * radius;
    const widthFactor = Math.cos(lat);
    ctx.beginPath();
    ctx.ellipse(cx, y, radius * widthFactor, Math.max(4, radius * 0.09 * Math.cos(lat)), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = -6; i <= 6; i += 1) {
    const phase = t + i * 0.24;
    const squash = Math.max(0.07, Math.abs(Math.cos(phase)));
    const offsetX = Math.sin(phase) * radius * 0.05;
    ctx.beginPath();
    ctx.ellipse(cx + offsetX, cy, radius * squash, radius, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < LAND_POINTS.length; i += 1) {
    const [nx, ny] = LAND_POINTS[i];
    const longitude = nx + Math.sin(t * 1.4 + ny * 5) * 0.06;
    const depth = Math.sqrt(Math.max(0, 1 - longitude * longitude));
    const px = cx + longitude * radius;
    const py = cy + ny * radius * depth * 0.98;
    const pulse = 0.45 + 0.55 * Math.sin(time * 0.003 + i * 0.37);
    ctx.fillStyle = `rgba(77,242,255,${0.18 + pulse * 0.36})`;
    ctx.shadowBlur = 7 + pulse * 7;
    ctx.shadowColor = 'rgba(39,234,255,0.68)';
    ctx.beginPath();
    ctx.arc(px, py, 1.15 + pulse * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.lineWidth = 1.05;
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * (i % 2 === 0 ? 1 : -1) + i * 1.15);
    ctx.strokeStyle = i === 1 ? 'rgba(161,75,255,0.62)' : 'rgba(55,226,255,0.44)';
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (1.25 + i * 0.06), radius * (0.28 + i * 0.08), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(54,229,255,0.56)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const scanY = cy - radius + ((time * 0.065) % (radius * 2));
  const scan = ctx.createLinearGradient(0, scanY - 28, 0, scanY + 28);
  scan.addColorStop(0, 'rgba(39,234,255,0)');
  scan.addColorStop(0.5, 'rgba(39,234,255,0.18)');
  scan.addColorStop(1, 'rgba(39,234,255,0)');
  ctx.fillStyle = scan;
  ctx.fillRect(cx - radius, scanY - 28, radius * 2, 56);

  for (let i = 0; i < 8; i += 1) {
    const a = t * 2.7 + i * (Math.PI * 2 / 8);
    const x = cx + Math.cos(a) * radius * 1.27;
    const y = cy + Math.sin(a) * radius * 0.45;
    const pulse = 0.55 + 0.45 * Math.sin(time * 0.004 + i);
    ctx.fillStyle = `rgba(72,246,190,${0.35 + pulse * 0.50})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(72,246,190,0.78)';
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + pulse * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  const core = ctx.createRadialGradient(cx - 2, cy - 3, 2, cx, cy, 28);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.10, 'rgba(124,247,255,0.98)');
  core.addColorStop(0.38, 'rgba(53,143,255,0.84)');
  core.addColorStop(0.74, 'rgba(138,55,255,0.40)');
  core.addColorStop(1, 'rgba(138,55,255,0)');
  ctx.fillStyle = core;
  ctx.shadowBlur = 24;
  ctx.shadowColor = 'rgba(39,234,255,0.80)';
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

export default function NetworkCore() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      drawGlobe(ctx, canvas.width, canvas.height, reducedMotion ? 0 : performance.now());
    };

    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      if (reducedMotion && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        drawGlobe(ctx, canvas.width, canvas.height, 0);
      } else if (!reducedMotion && !raf) {
        raf = requestAnimationFrame(tick);
      }
    };

    const tick = (time: number) => {
      drawGlobe(ctx, canvas.width, canvas.height, time);
      if (!reducedMotion) raf = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    motionQuery.addEventListener?.('change', onMotionChange);
    resize();

    if (!reducedMotion) raf = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      motionQuery.removeEventListener?.('change', onMotionChange);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="network-globe-canvas"
      aria-hidden="true"
    />
  );
}
