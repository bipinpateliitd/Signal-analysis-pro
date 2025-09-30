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