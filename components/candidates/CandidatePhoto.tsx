"use client";
import { useState, useEffect } from "react";
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

  useEffect(() => {
    let cancelled = false;
    getCandidatePhotoUrl(candidateId).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => { cancelled = true; };
  }, [candidateId]);

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
      <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={candidateName}
          className={`${baseClass} hover:opacity-90 transition-opacity`}
        />
      </a>
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
