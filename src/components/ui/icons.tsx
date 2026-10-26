// Stroke icons (24px grid) that inherit currentColor

function Svg({ size = 16, children, strokeWidth = 1.75 }: { size?: number; children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const Icon = {
  Logo: ({ size = 18 }: P) => (
    <Svg size={size} strokeWidth={2}>
      <path d="M4 8.5 12 4l8 4.5-8 4.5z" />
      <path d="m4 15.5 8 4.5 8-4.5" />
    </Svg>
  ),
  ChevronDown: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  ChevronLeft: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  ),
  ChevronRight: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  Calendar: ({ size = 16 }: P) => (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  ),
  Check: ({ size = 16 }: P) => (
    <Svg size={size} strokeWidth={2}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  ),
  Alert: ({ size = 16 }: P) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5M12 16h.01" />
    </Svg>
  ),
  Refresh: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M20 11a8 8 0 0 0-14.9-3.9L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.9 3.9L20 15" />
      <path d="M20 20v-5h-5" />
    </Svg>
  ),
  Download: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Svg>
  ),
  Logout: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 16-4-4 4-4M6 12h10" />
    </Svg>
  ),
  Play: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M8 5.5v13l10-6.5z" />
    </Svg>
  ),
  More: ({ size = 16 }: P) => (
    <Svg size={size} strokeWidth={2.4}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" />
    </Svg>
  ),
  Copy: ({ size = 16 }: P) => (
    <Svg size={size}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </Svg>
  ),
  Clock: ({ size = 16 }: P) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  ),
  Sun: ({ size = 16 }: P) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Svg>
  ),
  Moon: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </Svg>
  ),
  Lock: ({ size = 16 }: P) => (
    <Svg size={size}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </Svg>
  ),
  ArrowRight: ({ size = 16 }: P) => (
    <Svg size={size} strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  File: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5" />
    </Svg>
  ),
  Trash: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </Svg>
  ),
  Stop: ({ size = 16 }: P) => (
    <Svg size={size}>
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
    </Svg>
  ),
  Search: ({ size = 16 }: P) => (
    <Svg size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </Svg>
  ),
  Plus: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Pencil: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </Svg>
  ),
  ArrowDown: ({ size = 16 }: P) => (
    <Svg size={size} strokeWidth={2}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  ),
  Upload: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M12 15V4M7 9l5-5 5 5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </Svg>
  ),
  Gear: ({ size = 16 }: P) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  Folder: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  ),
  Sheet: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8.5 12.5h7M8.5 16h7M12 11v7" />
    </Svg>
  ),
  Archive: ({ size = 16 }: P) => (
    <Svg size={size}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" />
    </Svg>
  ),
  Plug: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5" />
    </Svg>
  ),
  Grid: ({ size = 16 }: P) => (
    <Svg size={size}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Svg>
  ),
  List: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Svg>
  ),
  Brush: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M18.4 3.6a2 2 0 0 1 2.8 2.8L12 15.6 8.4 12z" />
      <path d="M8.4 12C6 12 4.5 13.6 4.5 16c0 1.5-.8 2.6-1.5 3 3.5.9 9 .3 9-4.4" />
    </Svg>
  ),
  X: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  User: ({ size = 16 }: P) => (
    <Svg size={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  ),
  Inbox: ({ size = 16 }: P) => (
    <Svg size={size}>
      <path d="M4 13.5 6.2 5.6A2 2 0 0 1 8.1 4h7.8a2 2 0 0 1 1.9 1.6L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" />
    </Svg>
  ),
};
