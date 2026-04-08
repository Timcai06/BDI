"use client";

import { motion, useInView, Variants } from "framer-motion";
import { useRef, ReactNode, useEffect, useState } from "react";

// ============================================
// 基础动画变体
// ============================================

export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 40
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] // cubic-bezier for smooth deceleration
    }
  }
};

export const fadeIn: Variants = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -60
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 60
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// 交错子元素动画
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

// 卡片进入动画（带弹性）
export const cardEnter: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.98
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// ============================================
// 滚动触发动画组件
// ============================================

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  once?: boolean;
  amount?: number;
  as?: "div" | "section" | "article" | "span";
}

export function ScrollReveal({
  children,
  className = "",
  variants = fadeInUp,
  delay = 0,
  once = true,
  amount = 0.2,
  as = "div"
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once,
    amount // 元素进入视口 20% 时触发
  });

  const MotionComponent = motion[as];

  return (
    <MotionComponent
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{ delay }}
      className={className}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </MotionComponent>
  );
}

// ============================================
// 交错动画容器
// ============================================

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
}

export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.1,
  once = true
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 交错子元素
interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = "" }: StaggerItemProps) {
  return (
    <motion.div
      variants={cardEnter}
      className={className}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 视差效果组件
// ============================================

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  speed?: number; // 0.5 = 慢速, 1 = 正常, 2 = 快速
}

export function Parallax({ children, className = "", speed = 0.5 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 使用简单的 transform 实现视差
  // 注意：实际项目中可以使用 useScroll + useTransform 实现更复杂的效果

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ y: 0 }}
      whileInView={{ y: -20 * speed }}
      transition={{ duration: 0.3 }}
      viewport={{ once: false, amount: 0.5 }}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 鼠标跟随聚光灯效果
// ============================================

export function SpotlightEffect() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isVisible]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
      style={{
        opacity: isVisible ? 1 : 0,
        background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59,130,246,0.04), transparent 40%)`
      }}
    />
  );
}

// ============================================
// 数字增长动画
// ============================================

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function CountUp({
  end,
  duration = 2,
  decimals = 0,
  suffix = "",
  prefix = "",
  className = ""
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      // easeOutExpo 缓动函数
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);
      const currentCount = easeOutExpo * end;
      setCount(currentCount as any);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isInView, end, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {typeof count === 'number' ? count.toFixed(decimals) : count}
      {suffix}
    </span>
  );
}

// ============================================
// 镜头聚焦动效 (Blur/Focus Reveal)
// ============================================

interface BlurRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  blur?: number;
}

export function BlurReveal({
  children,
  className = "",
  delay = 0,
  duration = 0.8,
  blur = 10
}: BlurRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ 
        opacity: 0, 
        filter: `blur(${blur}px)`,
        scale: 1.1,
        y: 20
      }}
      animate={isInView ? { 
        opacity: 1, 
        filter: "blur(0px)",
        scale: 1,
        y: 0 
      } : {}}
      transition={{
        duration,
        delay,
        ease: [0.34, 1.56, 0.64, 1] // Custom elastic ease
      }}
      className={className}
      style={{ willChange: "filter, opacity, transform" }}
    >
      {children}
    </motion.div>
  );
}

interface StaggeredBlurRevealProps {
  text: string;
  className?: string;
  delay?: number;
}

export function StaggeredBlurReveal({
  text,
  className = "",
  delay = 0
}: StaggeredBlurRevealProps) {
  const words = text.split(""); // Split by character for Chinese compatibility
  
  return (
    <div className={`flex flex-wrap items-center justify-center ${className}`}>
      {words.map((char, i) => (
        <BlurReveal
          key={i}
          delay={delay + i * 0.05}
          blur={8}
          duration={0.6}
          className={char === " " ? "mr-4" : ""}
        >
          {char}
        </BlurReveal>
      ))}
    </div>
  );
}
