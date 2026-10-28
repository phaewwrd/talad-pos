import { ImageOff } from "lucide-react";
import Image from "next/image";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

export function ProductThumb({
  src,
  size = 40,
  className,
}: {
  src: string | null;
  size?: number;
  className?: string;
}) {
  const url = cloudinaryUrl(src, size * 2);
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <ImageOff className="size-4" aria-hidden />
      )}
    </span>
  );
}
