"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useEffect } from "react";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const { scrollY } = useScroll();
  
  // 背景模糊程度随滚动增加
  const backdropBlur = useTransform(scrollY, [0, 100], [0, 12]);
  const backgroundOpacity = useTransform(scrollY, [0, 100], [0, 0.8]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // 检测是否滚动超过阈值
      setIsScrolled(currentScrollY > 50);
      
      // 向下滚动超过 100px 时隐藏 header，向上滚动时显示
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const navItems = [
    { href: "#features", label: "Features" },
    { href: "#technology", label: "Technology" },
    { href: "/dashboard", label: "Console" },
  ];

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      initial={{ y: 0, opacity: 1 }}
      animate={{ 
        y: isVisible ? 0 : -100,
        opacity: isVisible ? 1 : 0
      }}
      transition={{ 
        duration: 0.35,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      style={{ willChange: "transform, opacity" }}
    >
      {/* 动态背景 */}
      <motion.div 
        className="absolute inset-0 -z-10"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${isScrolled ? 0.8 : 0})`,
          backdropFilter: `blur(${isScrolled ? 12 : 0}px)`,
          WebkitBackdropFilter: `blur(${isScrolled ? 12 : 0}px)`,
          borderBottom: `1px solid ${isScrolled ? 'rgba(255,255,255,0.05)' : 'transparent'}`
        }}
        initial={false}
        animate={{
          backgroundColor: isScrolled ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0)"
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Logo */}
      <motion.div 
        className="flex items-center gap-6 pointer-events-auto"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80 group">
          <motion.div 
            className="h-8 w-8 rounded-lg bg-black border border-white/20 flex items-center justify-center"
            whileHover={{ scale: 1.05, borderColor: "rgba(255,255,255,0.4)" }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-white font-bold font-mono text-xs">BDI</span>
          </motion.div>
          <span className="font-semibold tracking-[0.2em] uppercase text-white/90 text-sm">
            INFRA-SCAN
          </span>
        </Link>
      </motion.div>

      {/* Navigation */}
      <motion.nav 
        className="hidden md:flex items-center gap-8 pointer-events-auto"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {navItems.map((item, index) => (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
          >
            <Link 
              href={item.href} 
              className="relative text-xs font-semibold tracking-widest uppercase text-white/60 transition-colors hover:text-white group py-2"
            >
              {item.label}
              {/* 悬停下划线动画 */}
              <motion.span
                className="absolute bottom-0 left-0 w-full h-px bg-white/60 origin-left"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3 }}
              />
            </Link>
          </motion.div>
        ))}
      </motion.nav>

      {/* CTA Button - 修复按钮样式，确保hover时文字颜色变化正确 */}
      <motion.div 
        className="pointer-events-auto"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Link 
          href="/dashboard"
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 text-[10px] font-bold tracking-widest uppercase text-white backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:border-white"
        >
          Enter
        </Link>
      </motion.div>
    </motion.header>
  );
}
