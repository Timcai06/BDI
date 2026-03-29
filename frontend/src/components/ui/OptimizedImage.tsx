"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";

// ============================================
// 懒加载图片组件
// ============================================

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  className?: string;
  containerClassName?: string;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  onLoad?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  quality = 85,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  className = "",
  containerClassName = "",
  placeholder = "empty",
  blurDataURL,
  onLoad
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority); // priority 图片立即加载
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用 Intersection Observer 实现懒加载
  useEffect(() => {
    if (priority) return; // priority 图片不需要懒加载

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "50px", // 提前 50px 开始加载
        threshold: 0
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${containerClassName}`}
      style={!fill ? { width, height } : undefined}
    >
      {/* 占位符/加载状态 */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      
      {/* 实际图片 - 只在进入视口时加载 */}
      {isInView && (
        <Image
          src={src}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          priority={priority}
          quality={quality}
          sizes={sizes}
          className={`transition-opacity duration-500 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          placeholder={placeholder}
          blurDataURL={blurDataURL}
          onLoad={handleLoad}
          loading={priority ? "eager" : "lazy"}
        />
      )}
    </div>
  );
}

// ============================================
// 响应式图片组件
// ============================================

interface ResponsiveImageProps {
  src: string;
  alt: string;
  aspectRatio?: string; // e.g., "16/9", "4/3", "1/1"
  priority?: boolean;
  quality?: number;
  className?: string;
  containerClassName?: string;
}

export function ResponsiveImage({
  src,
  alt,
  aspectRatio = "16/9",
  priority = false,
  quality = 85,
  className = "",
  containerClassName = ""
}: ResponsiveImageProps) {
  return (
    <div 
      className={`relative w-full ${containerClassName}`}
      style={{ aspectRatio }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={quality}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={`object-cover ${className}`}
      />
    </div>
  );
}

// ============================================
// 图片对比滑块组件（用于展示 AI 识别前后对比）
// ============================================

import { useState as useStateReact, useCallback } from "react";

interface CompareSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function CompareSlider({
  beforeImage,
  afterImage,
  beforeLabel = "原始图像",
  afterLabel = "AI 识别",
  className = ""
}: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useStateReact(50);
  const [isDragging, setIsDragging] = useStateReact(false);

  const handleMove = useCallback(
    (clientX: number, rect: DOMRect) => {
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
      setSliderPosition(percent);
    },
    [setSliderPosition]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      handleMove(e.clientX, rect);
    },
    [isDragging, handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      handleMove(e.touches[0].clientX, rect);
    },
    [isDragging, handleMove]
  );

  return (
    <div
      className={`relative select-none overflow-hidden rounded-2xl ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDragging(false)}
      style={{ aspectRatio: "16/9" }}
    >
      {/* 原图 (右侧) */}
      <div className="absolute inset-0">
        <OptimizedImage
          src={beforeImage}
          alt={beforeLabel}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
        <span className="absolute bottom-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white/80">
          {beforeLabel}
        </span>
      </div>

      {/* AI 识别结果 (左侧，通过 clipPath 控制显示范围) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <OptimizedImage
          src={afterImage}
          alt={afterLabel}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
        <span className="absolute bottom-4 left-4 px-3 py-1 bg-accent/80 backdrop-blur-sm rounded-full text-xs text-white">
          {afterLabel}
        </span>
      </div>

      {/* 滑块控制器 */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      >
        {/* 滑块按钮 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l-7 7 7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
