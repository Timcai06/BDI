'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseX: number;
  baseY: number;
  color: string;
  mass: number; // For variable inertia
}

const colors = ['rgba(0, 217, 146,', 'rgba(16, 185, 129,', 'rgba(0, 255, 170,'];

export const ParticleWave: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    let mouse = { x: -1000, y: -1000, active: false, speed: 0 };
    let lastMousePos = { x: 0, y: 0 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const density = window.innerWidth < 768 ? 12000 : 8000;
      const particleCount = Math.min(Math.floor((window.innerWidth * window.innerHeight) / density), 400);

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 1.5 + 0.6;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          size,
          alpha: Math.random() * 0.5 + 0.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          mass: size * 1.5, // Larger = heavier
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      
      const time = performance.now() * 0.0005;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 1. Coordinated Fluid Drift (Flow Field logic)
        const flowX = Math.sin(time + p.baseY * 0.005) * 0.3;
        const flowY = Math.cos(time + p.baseX * 0.005) * 0.2;
        p.vx += flowX / p.mass;
        p.vy += flowY / p.mass;

        // 2. Swirl/Vortex Physics (Magnetic Interaction)
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 300;

          if (dist < maxDist) {
            const force = (maxDist - dist) / maxDist;
            
            // Attract force
            const pull = force * 0.6;
            p.vx += (dx / dist) * pull / p.mass;
            p.vy += (dy / dist) * pull / p.mass;

            // Swirl force (Tangential) - Creates liquid vortex
            const swirl = force * 0.8;
            p.vx += (dy / dist) * swirl / p.mass;
            p.vy -= (dx / dist) * swirl / p.mass;
          }
        }

        // 3. Elastic return to base (Flow stabilization)
        p.vx += (p.baseX - p.x) * 0.01;
        p.vy += (p.baseY - p.y) * 0.01;

        // Apply friction & movement
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.x += p.vx;
        p.y += p.vy;

        const dynamicAlpha = p.alpha; // Consitently dim

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${dynamicAlpha})`;
        ctx.fill();

        // 5. High-Energy Mesh Connections
        if (i % 2 === 0) { // Optimize line count
          for (let j = i + 1; j < particles.length; j += 4) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const connectDist = mouse.active ? 180 : 120;

            if (dist < connectDist) {
              ctx.beginPath();
              const opacity = (1 - dist / connectDist) * 0.12;
              ctx.strokeStyle = `rgba(0, 217, 146, ${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
      }
      
      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      mouse.speed = Math.sqrt(dx * dx + dy * dy);
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      lastMousePos = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', () => { mouse.active = false; });

    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 3 }}
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block opacity-45"
      />
      {/* Dynamic Grid Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,7,0.8)_100%)] pointer-events-none" />
      <div className="bg-grid absolute inset-0 opacity-[0.05] pointer-events-none" />
    </motion.div>
  );
};
