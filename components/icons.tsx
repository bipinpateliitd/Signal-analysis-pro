import React from 'react';

export const UploadIcon: React.FC = () => (
  <svg className="w-16 h-16 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
  </svg>
);

export const DownloadIcon: React.FC = () => (
    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
    </svg>
);

export const InfoIcon: React.FC = () => (
    <svg className="w-5 h-5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
);

export const ChevronDownIcon: React.FC = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
    </svg>
);

export const PlayIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="#3b82f6" stroke="#fff" strokeWidth="2"/>
        <path d="M9 7l9 5-9 5V7z" fill="#fff"/>
    </svg>
);

export const PauseIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="#3b82f6" stroke="#fff" strokeWidth="2"/>
        <rect x="8" y="6" width="3" height="12" rx="1" fill="#fff"/>
        <rect x="13" y="6" width="3" height="12" rx="1" fill="#fff"/>
    </svg>
);

export const KairosFullLogo: React.FC<{ className?: string }> = ({ className = 'w-64 h-auto' }) => (
    <svg viewBox="0 0 200 80" className={className} xmlns="http://www.w3.org/2000/svg">
        <title>AiKairos Logo</title>
        {/* K Graphic */}
        <g transform="translate(70, 0)">
            {/* White parts */}
            <g stroke="white">
                <path d="M15 5 V 45" strokeWidth="2" />
                <path d="M15 10 H 5" strokeWidth="1" />
                <circle cx="3" cy="10" r="2" fill="white" />
                <path d="M15 25 H 5" strokeWidth="1" />
                <circle cx="3" cy="25" r="2" fill="white" />
                <path d="M15 40 H 5" strokeWidth="1" />
                <circle cx="3" cy="40" r="2" fill="white" />
            </g>
            {/* Yellow parts */}
            <g stroke="#facc15">
                <path d="M15 25 L 40 5" strokeWidth="2" />
                <path d="M15 25 L 40 45" strokeWidth="2" />
            </g>
            <circle cx="15" cy="25" r="3" fill="#facc15" />
        </g>
        {/* Text */}
        <text x="35" y="70" fontFamily="system-ui, sans-serif" fontSize="16" fill="white" fontWeight="300" letterSpacing="4">
            K<tspan dx="-3">Λ</tspan><tspan dx="-3.5">IROS</tspan>
        </text>
        <text x="148" y="65" fontFamily="system-ui, sans-serif" fontSize="9" fill="#facc15" fontWeight="600">
            AI
        </text>
    </svg>
);

export const KairosHeaderLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
     <svg viewBox="0 0 50 50" className={className} xmlns="http://www.w3.org/2000/svg">
        <title>AiKairos Logo Icon</title>
        {/* White parts */}
        <g stroke="white">
            <path d="M15 5 V 45" strokeWidth="2" />
            <path d="M15 10 H 5" strokeWidth="1" />
            <circle cx="3" cy="10" r="2" fill="white" />
            <path d="M15 25 H 5" strokeWidth="1" />
            <circle cx="3" cy="25" r="2" fill="white" />
            <path d="M15 40 H 5" strokeWidth="1" />
            <circle cx="3" cy="40" r="2" fill="white" />
        </g>
        {/* Yellow parts */}
        <g stroke="#facc15">
            <path d="M15 25 L 40 5" strokeWidth="2" />
            <path d="M15 25 L 40 45" strokeWidth="2" />
        </g>
        <circle cx="15" cy="25" r="3" fill="#facc15" />
    </svg>
);

export const SubmarineIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 80" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hull-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#9ca3af" />
        <stop offset="100%" stopColor="#4b5563" />
      </linearGradient>
    </defs>
    <g transform="translate(0, 10)">
      {/* Back Fins */}
      <path d="M170,30 L195,5 L195,55 L170,30 Z" fill="#6b7280"/>
      <path d="M175,30 L190,20 L190,40 Z" fill="#374151"/>

      {/* Main Hull */}
      <ellipse cx="100" cy="30" rx="100" ry="25" fill="url(#hull-gradient)" />

      {/* Conning Tower */}
      <path d="M60,6 L140,6 L130,-10 L70,-10 Z" fill="#6b7280" />
      <ellipse cx="100" cy="6" rx="40" ry="8" fill="#9ca3af" />

      {/* Front detail */}
      <circle cx="10" cy="30" r="5" fill="#374151" />
    </g>
  </svg>
);

export const ZoomResetIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h4m-2 2v-4"></path>
    </svg>
);