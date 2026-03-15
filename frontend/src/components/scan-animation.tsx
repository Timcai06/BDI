"use client";

import { useEffect, useState } from "react";

type ScanPhase = "uploading" | "analyzing" | "detecting" | "complete";

interface ScanAnimationProps {
  phase: ScanPhase;
  progress?: number;
}

export function ScanAnimation({ phase, progress = 0 }: ScanAnimationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);

  useEffect(() => {
    // Generate random scan line particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2
    }));
    setParticles(newParticles);
  }, []);

  const phaseConfig = {
    uploading: {
      primaryColor: "#38bdf8",
      secondaryColor: "#0ea5e9",
      label: "文件传输",
      glowIntensity: 0.5
    },
    analyzing: {
      primaryColor: "#f59e0b",
      secondaryColor: "#d97706",
      label: "图像预处理",
      glowIntensity: 0.7
    },
    detecting: {
      primaryColor: "#8b5cf6",
      secondaryColor: "#7c3aed",
      label: "病害检测",
      glowIntensity: 1
    },
    complete: {
      primaryColor: "#10b981",
      secondaryColor: "#059669",
      label: "分析完成",
      glowIntensity: 0.3
    }
  };

  const config = phaseConfig[phase];
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="relative w-full h-full min-h-[200px] overflow-hidden rounded-2xl">
      {/* Base gradient background */}
      <div 
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse at center, ${config.primaryColor}08 0%, transparent 70%)`
        }}
      />

      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${config.primaryColor}20 1px, transparent 1px),
            linear-gradient(to bottom, ${config.primaryColor}20 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Animated scan line */}
      <div 
        className="absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{
          top: `${clampedProgress}%`,
          background: `linear-gradient(90deg, transparent, ${config.primaryColor}, transparent)`,
          boxShadow: `0 0 20px ${config.primaryColor}, 0 0 40px ${config.primaryColor}`,
          transition: 'top 0.3s ease-out'
        }}
      />

      {/* Scan beam effect */}
      <div 
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: `${clampedProgress}%`,
          height: '60px',
          background: `linear-gradient(180deg, ${config.primaryColor}30 0%, transparent 100%)`,
          transform: 'translateY(-100%)',
          transition: 'top 0.3s ease-out'
        }}
      />

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full pointer-events-none"
          style={{
            left: `${particle.x}%`,
            backgroundColor: config.primaryColor,
            boxShadow: `0 0 6px ${config.primaryColor}`,
            animation: `float-particle 3s ease-in-out ${particle.delay}s infinite`,
            opacity: phase === 'complete' ? 0 : 0.6
          }}
        />
      ))}

      {/* Corner brackets */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 pointer-events-none"
        style={{ borderColor: config.primaryColor, opacity: 0.5 }}
      />
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 pointer-events-none"
        style={{ borderColor: config.primaryColor, opacity: 0.5 }}
      />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 pointer-events-none"
        style={{ borderColor: config.primaryColor, opacity: 0.5 }}
      />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 pointer-events-none"
        style={{ borderColor: config.primaryColor, opacity: 0.5 }}
      />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Rotating ring */}
        <div className="relative mb-6">
          <div 
            className="w-20 h-20 rounded-full border-2 border-dashed animate-spin"
            style={{ 
              borderColor: config.primaryColor,
              animationDuration: '8s'
            }}
          />
          <div 
            className="absolute inset-2 rounded-full border-2 animate-spin"
            style={{ 
              borderColor: config.secondaryColor,
              borderStyle: 'dotted',
              animationDuration: '6s',
              animationDirection: 'reverse'
            }}
          />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {phase === 'uploading' && (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={config.primaryColor}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            {phase === 'analyzing' && (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={config.primaryColor}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {phase === 'detecting' && (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={config.primaryColor}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {phase === 'complete' && (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={config.primaryColor}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Phase label */}
        <p 
          className="text-sm font-medium tracking-widest uppercase mb-2"
          style={{ color: config.primaryColor }}
        >
          {config.label}
        </p>

        {/* Progress percentage */}
        <p className="text-3xl font-light font-mono text-white">
          {Math.round(clampedProgress)}<span className="text-lg text-white/50">%</span>
        </p>
      </div>

      {/* Pulse effect at bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.primaryColor}, transparent)`,
          opacity: 0.5,
          animation: 'pulse-glow 2s ease-in-out infinite'
        }}
      />

      <style jsx>{`
        @keyframes float-particle {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          50% {
            transform: translateY(-100px) scale(1.5);
            opacity: 0.8;
          }
        }
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
