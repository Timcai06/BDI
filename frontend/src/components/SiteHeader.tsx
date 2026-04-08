"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);

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
    { href: "#technology", label: "TECH_STACK" },
    { href: "#features", label: "ALGO_CORE" },
    { href: "#workflow", label: "SYSTEM_FLOW" },
    { href: "#launch", label: "DEPLOY" },
  ];

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 transition-all duration-300"
      initial={{ y: 0, opacity: 1 }}
      animate={{
        y: isVisible ? 0 : -100,
        opacity: isVisible ? 1 : 0
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background with VoltAgent Carbon Surface & Border */}
      <motion.div
        className="absolute inset-0 -z-10"
        initial={false}
        animate={{
          backgroundColor: isScrolled ? "rgba(10, 10, 10, 0.8)" : "transparent",
          backdropFilter: isScrolled ? "blur(12px)" : "blur(0px)",
          borderBottom: isScrolled ? "1px solid #3d3a39" : "1px solid transparent",
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Logo: Minimalist Bolt with Signal Green Glow */}
      <motion.div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80 group">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-[#00d992] shadow-[0_0_10px_#00d992] animate-pulse" />
            <div className="absolute inset-0 h-2 w-2 rounded-full bg-[#00d992] blur-sm opacity-50" />
          </div>
          <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-[#f2f2f2] font-bold">
            BDI_NEXUS <span className="text-[#00d992]/40 ml-1">v.0.9</span>
          </span>
        </Link>
      </motion.div>

      {/* Navigation: Compressed Terminal Style Items */}
      <nav className="hidden md:flex items-center gap-10">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative flex items-center gap-2"
          >
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#b8b3b0] transition-colors duration-300 group-hover:text-[#00d992]">
              {item.label}
            </span>
            <div className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[#00d992] transition-all duration-300 group-hover:w-full opacity-50" />
          </Link>
        ))}
      </nav>

      {/* Terminal Action */}
      <div className="flex items-center gap-6 font-mono text-[10px] tracking-widest">
        <span className="hidden lg:inline text-[#8b949e] opacity-40">UTC: {new Date().getHours()}:00</span>
        <Link href="/dashboard" className="px-4 py-1.5 border border-[#3d3a39] rounded text-[#00d992] hover:bg-[#00d992]/5 transition-colors">
          OPEN_CONSOLE
        </Link>
      </div>
    </motion.header>
  );
}
