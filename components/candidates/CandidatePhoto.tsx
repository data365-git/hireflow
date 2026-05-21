"use client";
import { useState, useEffect, useCallback } from "react";
import { getCandidatePhotoUrl } from "@/app/actions/telegram-files";
import { hashColor, initials } from "@/lib/utils";

type Props = {
  candidateId: string;
  candidateName: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: { px: 40, className: "w-10 h-10 text-xs" },
  md: { px: 80, className: "w-20 h-20 text-body-sm" },
  lg: { px: 160, className: "w-40 h-40 text-xl" },
};

export function CandidatePhoto({ candidateId, candidateName, size = "md" }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null | undefined>(undefined);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCandidatePhotoUrl(candidateId).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => { cancelled = true; };
  }, [candidateId]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox]);

  const { className } = sizeMap[size];
  const baseClass = `${className} rounded-lg object-cover shrink-0`;

  // Loading state
  if (photoUrl === undefined) {
    return (
      <div
        className={`${className} rounded-lg bg-surface-2 shrink-0 animate-pulse`}
        aria-hidden="true"
      />
    );
  }

  // Photo loaded
  if (photoUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block shrink-0 cursor-zoom-in"
          aria-label={`View ${candidateName} photo full size`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={candidateName}
            className={`${baseClass} hover:opacity-90 transition-opacity`}
          />
        </button>
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-full bg-black/30"
              aria-label="Close"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={candidateName}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  // Fallback: initials avatar
  return (
    <div
      className={`${className} rounded-lg flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: hashColor(candidateId) }}
      title={candidateName}
    >
      {initials(candidateName)}
    </div>
  );
}
