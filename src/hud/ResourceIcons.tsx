/** Original inline resource icons (simple geometric shapes, no external art). */
import React from "react";

interface IconProps {
  className?: string;
}

export const IconSnacc: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const IconAtp: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M13 2 6 13h4l-1 9 7-11h-4l1-9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.25" />
  </svg>
);

export const IconSpore: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.25" />
    <circle cx="17" cy="17" r="3" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.25" />
  </svg>
);

export const IconEnzyme: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M6 18 18 6M6 6l4 12M18 6l-4 12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconElixir: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M9 3h6M10 3v5l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3L14 8V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconTemp: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M10 3v10a4 4 0 1 0 4 0V3a1 1 0 0 0-2 0v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="2" fill="currentColor" />
  </svg>
);
