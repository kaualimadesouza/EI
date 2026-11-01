interface IconProps {
  size?: number
  className?: string
}

function Stroke({ d, size = 32, className }: IconProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ''}`}
    >
      <path d={d} />
    </svg>
  )
}

const CATEGORY_PATHS: Record<string, string> = {
  combos: 'M3 11h8l-1 9H4zM13 13c0-1.7 1.8-3 4-3s4 1.3 4 3zM13 15.5h8M13 18h8v.5c0 .8-.7 1.5-1.5 1.5h-5c-.8 0-1.5-.7-1.5-1.5z',
  lanches: 'M4 11c0-3.3 3.6-6 8-6s8 2.7 8 6zM3 14h18M4 17h16v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z',
  salgados: 'M3 16c0-5 4-9 9-9s9 4 9 9zM7 16v2.5M12 16v2.5M17 16v2.5',
  bebidas: 'M6 8h12l-1.5 13h-9zM14 8l2-5h3',
  doces: 'M6 12h12l-1.5 8h-9zM5 12c0-2.8 3.1-5 7-5s7 2.2 7 5M12 4v3',
}

export function CategoryIcon({ category, ...props }: IconProps & { category: string }) {
  return <Stroke d={CATEGORY_PATHS[category] ?? CATEGORY_PATHS.lanches} {...props} />
}

export const DineInIcon = (props: IconProps) => (
  <Stroke d="M7 3v8M5 3v5c0 1.1.9 2 2 2s2-.9 2-2V3M7 11v10M17 3c-2.5 2-2.5 7 0 9v9" {...props} />
)
export const TakeAwayIcon = (props: IconProps) => (
  <Stroke d="M5 8h14l-1 13H6zM9 8V6c0-1.7 1.3-3 3-3s3 1.3 3 3v2" {...props} />
)
export const CloseIcon = (props: IconProps) => <Stroke d="M6 6l12 12M18 6L6 18" {...props} />
export const PlusIcon = (props: IconProps) => <Stroke d="M12 5v14M5 12h14" {...props} />
export const MinusIcon = (props: IconProps) => <Stroke d="M5 12h14" {...props} />
export const TrashIcon = (props: IconProps) => (
  <Stroke d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" {...props} />
)
export const CheckIcon = (props: IconProps) => <Stroke d="M5 12.5l4.5 4.5L19 7.5" {...props} />
export const ArrowDownIcon = (props: IconProps) => <Stroke d="M12 4v15M6 13l6 6 6-6" {...props} />
export const ArrowLeftIcon = (props: IconProps) => <Stroke d="M20 12H5M11 6l-6 6 6 6" {...props} />
export const CardIcon = (props: IconProps) => (
  <Stroke d="M3 6h18v12H3zM3 10h18M7 15h4" {...props} />
)
export const PixIcon = (props: IconProps) => (
  <Stroke d="M12 3l9 9-9 9-9-9zM8 12l4-4 4 4-4 4z" {...props} />
)
export const ContactlessIcon = (props: IconProps) => (
  <Stroke
    d="M5 9c1.5 1.8 1.5 4.2 0 6M8.5 7c2.6 2.9 2.6 7.1 0 10M12 5c3.6 4 3.6 10 0 14M15.5 3c4.6 5.2 4.6 12.8 0 18"
    {...props}
  />
)

export function StoreMark({ size = 40, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <circle cx="24" cy="24" r="24" className="fill-ink" />
      <path d="M1 27c0 12.7 10.3 23 23 23s23-10.3 23-23z" className="fill-teal" />
      <path d="M9 19c6-6 24-6 30 0" strokeWidth="3.5" fill="none" strokeLinecap="round" className="stroke-white" />
      <circle cx="31" cy="22" r="2.5" className="fill-white" />
    </svg>
  )
}

export const BellIcon = (props: IconProps) => <Stroke d="M12 3v2M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" {...props} />
export const ClockIcon = (props: IconProps) => <Stroke d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" {...props} />
export const UndoIcon = (props: IconProps) => <Stroke d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" {...props} />
export const AlertIcon = (props: IconProps) => (
  <Stroke d="M12 3l10 18H2zM12 10v5M12 18v.01" {...props} />
)
export const BoardIcon = (props: IconProps) => <Stroke d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z" {...props} />
export const ChartIcon = (props: IconProps) => <Stroke d="M4 20h16M7 16v-4M12 16V7M17 16v-7" {...props} />
export const ListIcon = (props: IconProps) => <Stroke d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" {...props} />
export const ExternalIcon = (props: IconProps) => <Stroke d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" {...props} />
export const LogoutIcon = (props: IconProps) => (
  <Stroke d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...props} />
)
export const MicIcon = (props: IconProps) => (
  <Stroke
    d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"
    {...props}
  />
)
export const PinIcon = (props: IconProps) => (
  <Stroke
    d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
    {...props}
  />
)
export const SearchIcon = (props: IconProps) => (
  <Stroke d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" {...props} />
)
export const GoogleIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
)
export const MarketIcon = (props: IconProps) => (
  <Stroke
    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"
    {...props}
  />
)
