'use client';

export default function SplineHero() {
  // Gambar kota cyberpunk neon malam hari berkualitas tinggi yang stabil dari Unsplash
  const imageUrl = "https://unsplash.com";

  return (
    <div className="ng-hero-visual-wrapper">
      <style>{`
        .ng-hero-visual-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 380px;
          border-radius: 24px;
          overflow: hidden;
          border: 2px solid rgba(36, 232, 255, 0.3);
          box-shadow: 0 0 30px rgba(36, 232, 255, 0.15), inset 0 0 20px rgba(139, 61, 255, 0.2);
          animation: neonPulse 4s ease-in-out infinite alternate;
        }
        .ng-hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.2) brightness(0.85);
          transition: transform 0.5s ease;
        }
        .ng-hero-visual-wrapper:hover .ng-hero-image {
          transform: scale(1.03);
        }
        .ng-overlay-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(2, 7, 17, 0.8) 0%, transparent 60%);
          pointer-events: none;
        }
        @keyframes neonPulse {
          0% {
            border-color: rgba(36, 232, 255, 0.25);
            box-shadow: 0 0 25px rgba(36, 232, 255, 0.1), inset 0 0 15px rgba(139, 61, 255, 0.15);
          }
          100% {
            border-color: rgba(139, 61, 255, 0.6);
            box-shadow: 0 0 40px rgba(139, 61, 255, 0.3), inset 0 0 25px rgba(36, 232, 255, 0.25);
          }
        }
      `}</style>
      
      {/* Tampilan Gambar Utama */}
      <img 
        src={imageUrl} 
        alt="Futuristic Cyber City" 
        className="ng-hero-image"
        loading="eager" 
      />
      
      {/* Efek gradasi gelap di atas gambar agar teks bawaan Anda tetap kontras */}
      <div className="ng-overlay-glow" />
    </div>
  );
}
