import Image from "next/image";

interface AdaptiveImageProps {
  alt: string;
  className: string;
  src: string;
  sizes?: string;
}

export function AdaptiveImage({
  alt,
  className,
  src,
  sizes = "100vw"
}: AdaptiveImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill
      sizes={sizes}
      src={src}
      unoptimized
    />
  );
}
