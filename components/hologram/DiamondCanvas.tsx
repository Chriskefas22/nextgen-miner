'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

function RotatingDiamond() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const opacityRef = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame((state, delta) => {
    meshRef.current.rotation.y += delta * 0.4;
    meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.8) * 0.1;

    if (opacityRef.current) {
      opacityRef.current.opacity = 0.15 + Math.sin(state.clock.getElapsedTime() * 2) * 0.05;
    }
  });

  return (
    <group>
      {/* Inti Diamond Kaca/Cyan */}
      <mesh ref={meshRef} position={[0, 0, 0]} scale={1.35}>
        <octahedronGeometry args={[1, 2]} />
        <meshPhysicalMaterial
          color="#06b6d4"
          emissive="#0891b2"
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          transmission={0.6}
          thickness={1.2}
        />
      </mesh>

      {/* Wireframe Cyberpunk Hologram */}
      <mesh position={[0, 0, 0]} scale={1.38}>
        <octahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color="#22d3ee" wireframe={true} transparent opacity={0.35} />
      </mesh>

      {/* Aura Glow Outermost */}
      <mesh position={[0, 0, 0]} scale={1.55}>
        <octahedronGeometry args={[1, 2]} />
        <meshBasicMaterial ref={opacityRef} color="#00f0ff" transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function HolographicPedestal() {
  const ringRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.3;
    }
  });

  return (
    <group position={[0, -1.6, 0]}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.2, 1.8, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      
      <group ref={ringRef} rotation-x={-Math.PI / 2}>
        <mesh>
          <ringGeometry args={[1.85, 1.95, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export default function DiamondCanvas() {
  return (
    <div className="relative w-full h-[380px] bg-[#030712] rounded-2xl border border-cyan-500/30 overflow-hidden shadow-[0_0_35px_rgba(6,182,212,0.15)]">
      
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(6,182,212,0.25)_0%,rgba(3,7,18,0.95)_75%)] pointer-events-none" />

      {/* Render WebGL 3D */}
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00f0ff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#a855f7" />
        
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
          <RotatingDiamond />
        </Float>
        
        <HolographicPedestal />
        <Sparkles count={50} scale={4} size={2.5} speed={0.4} color="#22d3ee" />

        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 3} />
      </Canvas>

      {/* Info Badge Blueprint Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase">3D CORE REALTIME</span>
      </div>

      <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center pointer-events-none">
        <div className="px-4 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-400/50 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.4)]">
          <span className="text-xs font-extrabold text-cyan-200 tracking-wider uppercase">
            HOLOGRAPHIC CORE • MINING NETWORK ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}
