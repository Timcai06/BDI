"use client";

import { ReactNode, useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";

// ============================================
// 懒加载包装组件
// ============================================

interface LazyLoadProps {
  children: ReactNode;
  className?: string;
  placeholder?: ReactNode;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function LazyLoad({
  children,
  className = "",
  placeholder,
  threshold = 0,
  rootMargin = "100px",
  triggerOnce = true
}: LazyLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: triggerOnce,
    amount: threshold,
    margin: rootMargin as `${number}px`
  });
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isInView && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isInView, hasLoaded]);

  return (
    <div ref={ref} className={className}>
      {hasLoaded ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      ) : (
        placeholder || <DefaultPlaceholder />
      )}
    </div>
  );
}

function DefaultPlaceholder() {
  return (
    <div className="w-full h-48 bg-white/5 rounded-2xl animate-pulse" />
  );
}

// ============================================
// 分阶段加载组件（渐进式加载）
// ============================================

interface ProgressiveLoadProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ProgressiveLoad({
  children,
  className = "",
  delay = 0
}: ProgressiveLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className={className}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 虚拟列表基础组件（用于长列表）
// ============================================

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  className?: string;
  overscan?: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  className = "",
  overscan = 5
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight } = container;
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const end = Math.min(
        items.length,
        Math.ceil((scrollTop + clientHeight) / itemHeight) + overscan
      );
      setVisibleRange({ start, end });
    };

    handleScroll(); // 初始计算
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [items.length, itemHeight, overscan]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ willChange: "transform" }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={visibleRange.start + index} style={{ height: itemHeight }}>
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 优先级加载组件（优先加载可见内容）
// ============================================

interface PriorityLoadProps {
  children: ReactNode;
  className?: string;
  priority?: "high" | "low";
}

export function PriorityLoad({
  children,
  className = "",
  priority = "low"
}: PriorityLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { 
    once: true, 
    amount: priority === "high" ? 0.5 : 0.1 
  });

  if (priority === "high") {
    // 高优先级：立即渲染
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={ref} className={className}>
      {isInView && children}
    </div>
  );
}
