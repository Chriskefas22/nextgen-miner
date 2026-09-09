'use client';

export default function SplineHero() {
  // Menggunakan URL gambar internet langsung dengan foto PC Rig/Server bernuansa neon cyan untuk tema mining
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
          border: 2px solid rgba(36, 232, 255, 0.35);
          box-shadow: 0 0 35px rgba(36, 232, 255, 0.2), inset 0 0 20px rgba(36, 232, 255, 0.15);
          animation: neonPulse 4s ease-in-out infinite alternate;
        }
        .ng-hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.1) brightness(0.9);
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ng-hero-visual-wrapper:hover .ng-hero-image {
          transform: scale(1.04);
        }
        .ng-overlay-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(2, 7, 17, 0.7) 0%, transparent 50%);
          pointer-events: none;
        }
        @keyframes neonPulse {
          0% {
            border-color: rgba(36, 232, 255, 0.25);
            box-shadow: 0 0 25px rgba(36, 232, 255, 0.15), inset 0 0 15px rgba(36, 232, 255, 0.1);
          }
          100% {
            border-color: rgba(36, 232, 255, 0.7);
            box-shadow: 0 0 45px rgba(36, 232, 255, 0.35), inset 0 0 25px rgba(36, 232, 255, 0.25);
          }
        }
      `}</style>
      
      {/* Menampilkan foto server mining bernuansa cyan */}
      <img 
        src={imageUrl} 
        alt="Crypto Mining Hardware Core" 
        className="ng-hero-image"
        loading="eager" 
      />
      
      {/* Efek gradasi gelap agar menyatu dengan background landing page */}
      <div className="ng-overlay-glow" />
    </div>
  );
}
