'use client';

export default function SplineHero() {
  // Menggunakan gambar server mining bernuansa cyan yang sudah masuk
  const imageUrl = "landingpage.jpg";

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
          border: 2px solid rgba(36, 232, 255, 0.4);
          box-shadow: 0 0 35px rgba(36, 232, 255, 0.2), inset 0 0 20px rgba(36, 232, 255, 0.15);
          animation: neonGlowBreathing 3s ease-in-out infinite alternate;
        }

        /* ⚡ ANIMASI GAMBAR BERDENYUT HALUS SEPERTI MESIN JALAN */
        .ng-hero-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.2) brightness(0.85);
          animation: engineVibration 4s ease-in-out infinite alternate;
        }

        /* 🌌 OVERLAY EFEK KILATAN NEON DIGITAL DI ATAS GAMBAR */
        .ng-overlay-energy {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(36, 232, 255, 0.15) 0%, transparent 50%, rgba(139, 61, 255, 0.1) 100%);
          pointer-events: none;
          z-index: 2;
        }

        /* 🎇 SCANLINE ANIMATION: EFEK GARIS SCANNER RADAR FUTURISTIK */
        .ng-scanline {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(to bottom, transparent, #24e8ff, transparent);
          opacity: 0.6;
          z-index: 3;
          pointer-events: none;
          animation: scanMove 6s linear infinite;
        }

        .ng-overlay-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(2, 7, 17, 0.8) 0%, transparent 60%);
          pointer-events: none;
          z-index: 4;
        }

        /* KEYFRAMES ANIMASI */
        @keyframes neonGlowBreathing {
          0% {
            border-color: rgba(36, 232, 255, 0.3);
            box-shadow: 0 0 25px rgba(36, 232, 255, 0.15), inset 0 0 15px rgba(36, 232, 255, 0.1);
          }
          100% {
            border-color: rgba(36, 232, 255, 0.8);
            box-shadow: 0 0 50px rgba(36, 232, 255, 0.45), inset 0 0 30px rgba(36, 232, 255, 0.3);
          }
        }

        @keyframes engineVibration {
          0% { transform: scale(1) rotate(0deg); filter: brightness(0.85) saturate(1.2); }
          100% { transform: scale(1.02) rotate(0.5deg); filter: brightness(0.95) saturate(1.4); }
        }

        @keyframes scanMove {
          0% { top: -10%; }
          100% { top: 110%; }
        }
      `}</style>
      
      {/* Garis laser scan futuristik yang bergerak turun naik */}
      <div className="ng-scanline" />
      
      {/* Efek kilatan energi neon */}
      <div className="ng-overlay-energy" />
      
      {/* Gambar utama dengan efek getaran mesin halus */}
      <img 
        src={imageUrl} 
        alt="Crypto Mining Hardware Core" 
        className="ng-hero-image"
        loading="eager" 
      />
      
      <div className="ng-overlay-glow" />
    </div>
  );
}
