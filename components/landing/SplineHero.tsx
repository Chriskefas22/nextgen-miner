'use client';

import { useEffect, useState } from 'react';

export default function SplineHero() {
  const [visualState, setVisualState] = useState<'loading' | 'video' | 'spline'>('loading');

  useEffect(() => {
    // 1. Cek ketersediaan WebGL (Syarat mutlak untuk grafis 3D)
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    // 2. Cek perkiraan spesifikasi perangkat (Contoh: RAM di bawah 4GB dianggap perangkat lemah)
    const isLowEnd = typeof navigator !== 'undefined' && 
                      ('deviceMemory' in navigator && (navigator as any).deviceMemory < 4);

    if (!gl || isLowEnd) {
      // Jika perangkat lemah/jadul, langsung gunakan video loop yang ringan
      setVisualState('video');
    } else {
      // Jika perangkat kuat, aktifkan fitur Spline 3D
      setVisualState('spline');
    }
  }, []);

  return (
    <div className="ng-stage-wrapper" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '350px' }}>
      
      {/* ⚡ DETIK 0: GAMBAR STATIS PLACEHOLDER (Selalu muncul di awal agar tidak kosong) */}
      {visualState === 'loading' && (
        <div 
          className="ng-3d-placeholder" 
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: "url('/hero-bg.webp')",
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderRadius: '24px', border: '1px solid rgba(36,232,255,0.15)'
          }}
        />
      )}

      {/* 📱 PERANGKAT LEMAH/JADUL: Menggunakan Video Loop Ringan */}
      {visualState === 'video' && (
        <video 
          autoPlay loop muted playsInline 
          poster="/hero-bg.webp"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '24px' }}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
      )}

      {/* 🖥️ PERANGKAT KUAT/PC: Memuat Spline Viewer secara Lazy-Load */}
      {visualState === 'spline' && (
        <script 
          type="module" 
          src="https://unpkg.com"
          async
        />
      )}
      {visualState === 'spline' && (
        // @ts-ignore - Mengabaikan error tipe data tag kustom spline di Next.js
        <spline-viewer 
          url="https://spline.design" // GANTI 'xxxx' dengan ID file Spline Anda
          style={{ width: '100%', height: '100%', borderRadius: '24px' }}
        />
      )}
    </div>
  );
}
