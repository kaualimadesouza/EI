import type { Product } from '../domain/menu'

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

const CATEGORY_PATHS: Record<Product['category'], string> = {
  combos: 'M3 11h8l-1 9H4zM13 13c0-1.7 1.8-3 4-3s4 1.3 4 3zM13 15.5h8M13 18h8v.5c0 .8-.7 1.5-1.5 1.5h-5c-.8 0-1.5-.7-1.5-1.5z',
  lanches: 'M4 11c0-3.3 3.6-6 8-6s8 2.7 8 6zM3 14h18M4 17h16v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z',
  salgados: 'M3 16c0-5 4-9 9-9s9 4 9 9zM7 16v2.5M12 16v2.5M17 16v2.5',
  bebidas: 'M6 8h12l-1.5 13h-9zM14 8l2-5h3',
  doces: 'M6 12h12l-1.5 8h-9zM5 12c0-2.8 3.1-5 7-5s7 2.2 7 5M12 4v3',
}

export function CategoryIcon({ category, ...props }: IconProps & { category: Product['category'] }) {
  return <Stroke d={CATEGORY_PATHS[category]} {...props} />
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

export function StoreMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" className="fill-ink" />
      <path d="M1 27c0 12.7 10.3 23 23 23s23-10.3 23-23z" className="fill-teal" />
      <path d="M9 19c6-6 24-6 30 0" strokeWidth="3.5" fill="none" strokeLinecap="round" className="stroke-white" />
      <circle cx="31" cy="22" r="2.5" className="fill-white" />
    </svg>
  )
}

export const ClockIcon = (props: IconProps) => <Stroke d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" {...props} />
export const UndoIcon = (props: IconProps) => <Stroke d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" {...props} />
export const AlertIcon = (props: IconProps) => (
  <Stroke d="M12 3l10 18H2zM12 10v5M12 18v.01" {...props} />
)
export const BoardIcon = (props: IconProps) => <Stroke d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z" {...props} />
export const ChartIcon = (props: IconProps) => <Stroke d="M4 20h16M7 16v-4M12 16V7M17 16v-7" {...props} />
export const ListIcon = (props: IconProps) => <Stroke d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" {...props} />
export const ExternalIcon = (props: IconProps) => <Stroke d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" {...props} />
