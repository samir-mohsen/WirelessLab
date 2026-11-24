import React from 'react';
import type { ModuleId } from '../types/simulation';

export const ModulePreviewIcon: React.FC<{ id: ModuleId; className?: string }> = ({
  id,
  className = 'w-8 h-8',
}) => {
  switch (id) {
    case 'module1':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="14" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
          <circle cx="18" cy="18" r="9" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="18" cy="18" r="4" stroke="#2a78d6" strokeWidth="1.8" />
          <circle cx="18" cy="18" r="1.5" fill="#2a78d6" />
        </svg>
      );
    case 'module2':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M5 10 Q11 4 17 10 T29 10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
          <path d="M5 18 Q11 12 17 18 T29 18" stroke="#eb6834" strokeWidth="1.6" />
          <path d="M5 26 Q11 20 17 26 T29 26" stroke="#2a78d6" strokeWidth="2" />
          <path d="M30 10 L33 18 L30 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'module3':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <line x1="4" y1="28" x2="32" y2="28" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
          <path d="M7 28 V14 M12 28 V9 M17 28 V16 M22 28 V10 M27 28 V18" stroke="#2a78d6" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 14 Q12 6 17 16 T27 18" stroke="#1baf7a" strokeWidth="1.4" strokeDasharray="2 2" />
        </svg>
      );
    case 'module4':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M4 26 H10 L13 18 H23 L26 26 H32" stroke="#2a78d6" strokeWidth="1.8" />
          <line x1="18" y1="26" x2="18" y2="7" stroke="#eb6834" strokeWidth="2" />
          <circle cx="18" cy="7" r="2" fill="#eb6834" />
        </svg>
      );
    case 'module5':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="20" width="5" height="9" rx="1" fill="#2a78d6" />
          <rect x="15" y="13" width="5" height="16" rx="1" fill="#eb6834" />
          <rect x="24" y="16" width="5" height="13" rx="1" fill="#1baf7a" />
          <line x1="4" y1="15" x2="32" y2="15" stroke="currentColor" strokeDasharray="3 2" strokeWidth="1.5" />
        </svg>
      );
    case 'module6':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <polygon points="18,6 24,9.5 24,16.5 18,20 12,16.5 12,9.5" stroke="#2a78d6" strokeWidth="1.7" fill="#2a78d6" fillOpacity="0.12" />
          <polygon points="12,16.5 18,20 18,27 12,30.5 6,27 6,20" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.4" />
          <polygon points="24,16.5 30,20 30,27 24,30.5 18,27 18,20" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.4" />
        </svg>
      );
    case 'module7':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="8" cy="11" r="2.5" stroke="#2a78d6" strokeWidth="1.6" />
          <circle cx="8" cy="25" r="2.5" stroke="#2a78d6" strokeWidth="1.6" />
          <circle cx="28" cy="11" r="2.5" stroke="#1baf7a" strokeWidth="1.6" />
          <circle cx="28" cy="25" r="2.5" stroke="#1baf7a" strokeWidth="1.6" />
          <path d="M11 11 L25 11 M11 25 L25 25 M11 12 L25 24 M11 24 L25 12" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.3" />
        </svg>
      );
    case 'module8':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="8" width="7" height="7" rx="1" fill="#2a78d6" />
          <rect x="15" y="8" width="7" height="7" rx="1" fill="#1baf7a" />
          <rect x="24" y="8" width="6" height="7" rx="1" fill="#eda100" />
          <rect x="6" y="18" width="7" height="10" rx="1" fill="#eb6834" />
          <rect x="15" y="18" width="7" height="10" rx="1" fill="#2a78d6" />
          <rect x="24" y="18" width="6" height="10" rx="1" fill="#1baf7a" />
        </svg>
      );
  }
};
