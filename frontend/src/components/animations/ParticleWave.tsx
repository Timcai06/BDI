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
}

const colors = ['rgba(0, 217, 146,', 'rgba(16, 185, 129,', 'rgba(61, 58, 57,'];

export const ParticleWave: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    let mouse = { x: -1000, y: -1000, active: false };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const density = window.innerWidth < 768 ? 15000 : 10000;
      const particleCount = Math.min(Math.floor((window.innerWidth * window.innerHeight) / density), 300);

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.2 + 0.4,
          alpha: Math.random() * 0.4 + 0.05,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      
      const time = performance.now() * 0.0005;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Atmospheric drifting
        p.x += Math.sin(time + p.baseY * 0.01) * 0.2 + p.vx;
        p.y += Math.cos(time + p.baseX * 0.01) * 0.2 + p.vy;

        // Data Gravity (Mouse Interaction)
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 350;

          if (dist < maxDist) {
            const pullForce = (maxDist - dist) / maxDist;
            // Pull towards mouse - "Magnetic Attraction"
            p.x += (dx / dist) * pullForce * 1.2;
            p.y += (dy / dist) * pullForce * 1.2;
          }
        }

        // Elastic return to base (Flow stabilization)
        p.x += (p.baseX - p.x) * 0.02;
        p.y += (p.baseY - p.y) * 0.02;

        // Bound check
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.alpha})`;
        ctx.fill();

        // Connect nearby particles with refined logic
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const connectDist = mouse.active ? 150 : 100;

          if (dist < connectDist) {
            ctx.beginPath();
            const opacity = (1 - dist / connectDist) * 0.12;
            const mouseBoost = mouse.active ? 0.05 : 0;
            ctx.strokeStyle = `rgba(0, 217, 146, ${opacity + mouseBoost})`;
            ctx.lineWidth = 0.4;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      
      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
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
        className="w-full h-full block opacity-40"
      />
      {/* Dynamic Grid Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,7,0.8)_100%)] pointer-events-none" />
      <div className="bg-grid absolute inset-0 opacity-[0.05] pointer-events-none" />
    </motion.div>
  );
};
