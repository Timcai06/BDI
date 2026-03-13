import Image from "next/image";
import type { SyntheticEvent } from "react";

interface AdaptiveImageProps {
  alt: string;
  className: string;
  src: string;
  sizes?: string;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}

export function AdaptiveImage({
  alt,
  className,
  src,
  sizes = "100vw",
  onLoad
}: AdaptiveImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill
      onLoad={onLoad}
      sizes={sizes}
      src={src}
      unoptimized
    />
  );
}
