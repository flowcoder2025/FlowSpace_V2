import Image from "next/image";

type ImageSlotProps = {
  src?: string;
  alt: string;
  /** Aspect ratio Tailwind class, e.g. "aspect-[4/3]" */
  aspect?: string;
  /** Wireframe placeholder caption (shown when src is not provided) */
  caption?: string;
  className?: string;
  rounded?: string;
  border?: boolean;
  priority?: boolean;
};

/**
 * 랜딩 이미지 슬롯.
 * - src 있으면 next/image 렌더링 (실제 스크린샷)
 * - src 없으면 와이어프레임 placeholder + 캡션
 */
export function ImageSlot({
  src,
  alt,
  aspect = "aspect-[4/3]",
  caption,
  className = "",
  rounded = "rounded-2xl",
  border = true,
  priority = false,
}: ImageSlotProps) {
  const baseClasses = `${aspect} ${rounded} ${border ? "border border-line" : ""} overflow-hidden ${className}`;

  if (src) {
    return (
      <div className={`${baseClasses} relative`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 600px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`landing-placeholder ${baseClasses}`}>
      <div className="flex h-full items-center justify-center text-ink-muted">
        <p className="font-serif text-lg">{caption ? `[ ${caption} ]` : "[ 이미지 ]"}</p>
      </div>
    </div>
  );
}
