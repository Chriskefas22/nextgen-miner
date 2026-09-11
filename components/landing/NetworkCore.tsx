'use client';
import { useEffect, useRef } from 'react';
function drawGlobe(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) { const dpr = window.devicePixelRatio || 1; const w = width / dpr; const h = height / dpr; const cx = w * 0.5; const cy = h * 0.5; const r = Math.min(w, h) * 0.34; const rotation = time * 0.00018;
ctx.clearRect(0, 0, width, height); ctx.save(); ctx.scale(dpr, dpr);
// Outer hologram glow. const glow = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.5); glow.addColorStop(0, 'rgba(39,234,255,.20)'); glow.addColorStop(.45, 'rgba(74,96,255,.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2); ctx.fill();
// Globe sphere. const sphere = ctx.createRadialGradient(cx - r * .35, cy - r * .38, r * .08, cx, cy, r); sphere.addColorStop(0, 'rgba(113,251,255,.28)'); sphere.addColorStop(.42, 'rgba(27,113,255,.14)'); sphere.addColorStop(.78, 'rgba(33,54,145,.10)'); sphere.addColorStop(1, 'rgba(2,7,17,.02)'); ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
// Latitude. ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(39,234,255,.25)'; for (let i = -4; i <= 4; i += 1) { const y = cy + (i / 4) * r * 0.9; const curve = Math.cos((i / 4) * Math.PI * 0.5) * r * 0.42; ctx.beginPath(); ctx.ellipse(cx, y, r * (0.95 - Math.abs(i) * 0.06), Math.max(7, curve * 0.23), 0, 0, Math.PI * 2); ctx.stroke(); }
// Longitude, animated horizontally. for (let i = -5; i <= 5; i += 1) { const x = cx + (i / 5) * r * 0.92; const phase = rotation + i * 0.28; const squash = Math.max(0.10, Math.abs(Math.cos(phase))); ctx.beginPath(); ctx.ellipse(x, cy, r * squash, r, 0, 0, Math.PI * 2); ctx.stroke(); }
// Holographic land points, not a pasted bitmap. const continents = [ [-0.34, -0.14], [-0.28, -0.25], [-0.20, -0.34], [-0.12, -0.18], [0.02, -0.28], [0.13, -0.20], [0.23, -0.06], [0.30, 0.08], [0.18, 0.17], [0.07, 0.30], [-0.06, 0.23], [-0.22, 0.13], [0.36, -0.20], [0.42, -0.02], [0.12, -0.42], ];
for (let i = 0; i < continents.length; i += 1) { const [nx, ny] = continents[i]; const sway = Math.sin(time * 0.001 + i) * 0.006; const px = cx + (nx + sway) * r; const py = cy + ny * r;
const pulse = 0.55 + 0.45 * Math.sin(time * 0.003 + i * 0.7);
ctx.fillStyle = `rgba(66,241,255,${0.18 + pulse * 0.20})`;
ctx.beginPath();
ctx.arc(px, py, 2.2 + pulse * 1.2, 0, Math.PI * 2);
ctx.fill();
}
// Orbit / network arcs. ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(151,71,255,.55)'; for (let i = 0; i < 3; i += 1) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation * (i % 2 ? -1 : 1) + i * 1.4); ctx.beginPath(); ctx.ellipse(0, 0, r * (1.15 + i * .05), r * (.36 + i * .07), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
// Orbital nodes. for (let i = 0; i < 8; i += 1) { const a = rotation * 2.2 + i * (Math.PI * 2 / 8); const x = cx + Math.cos(a) * r * 1.11; const y = cy + Math.sin(a) * r * 0.42; const pulse = 0.7 + 0.3 * Math.sin(time * 0.004 + i); ctx.fillStyle = rgba(72,246,190,${0.35 + pulse * .45}); ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(39,234,255,.8)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + pulse * .9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
// Scan line. const scanY = cy - r + ((time * 0.09) % (r * 2)); const scan = ctx.createLinearGradient(0, scanY - 24, 0, scanY + 24); scan.addColorStop(0, 'rgba(39,234,255,0)'); scan.addColorStop(.5, 'rgba(39,234,255,.18)'); scan.addColorStop(1, 'rgba(39,234,255,0)'); ctx.fillStyle = scan; ctx.fillRect(cx - r, scanY - 24, r * 2, 48);
// Globe rim. ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(39,234,255,.54)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
// Centre core. const core = ctx.createRadialGradient(cx - 3, cy - 4, 2, cx, cy, 24); core.addColorStop(0, '#fff'); core.addColorStop(.12, 'rgba(119,247,255,.95)'); core.addColorStop(.45, 'rgba(52,133,255,.82)'); core.addColorStop(.82, 'rgba(126,60,255,.40)'); core.addColorStop(1, 'rgba(126,60,255,0)'); ctx.fillStyle = core; ctx.shadowBlur = 22; ctx.shadowColor = 'rgba(39,234,255,.85)'; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
ctx.restore(); }
export default function NetworkCore() { const canvasRef = useRef<HTMLCanvasElement | null>(null);
useEffect(() => { const canvas = canvasRef.current; if (!canvas) return;
const ctx = canvas.getContext('2d');
if (!ctx) return;

let raf = 0;
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  drawGlobe(ctx, canvas.width, canvas.height, performance.now());
};

const media = window.matchMedia('(prefers-reduced-motion: reduce)');
const onMotion = () => { reduced = media.matches; };

const tick = (time: number) => {
  drawGlobe(ctx, canvas.width, canvas.height, reduced ? 0 : time);
  if (!reduced) raf = requestAnimationFrame(tick);
};

const observer = new ResizeObserver(resize);
observer.observe(canvas);
media.addEventListener?.('change', onMotion);
resize();
raf = reduced ? 0 : requestAnimationFrame(tick);

return () => {
  observer.disconnect();
  media.removeEventListener?.('change', onMotion);
  if (raf) cancelAnimationFrame(raf);
};
}, []);
return (  ); } 
