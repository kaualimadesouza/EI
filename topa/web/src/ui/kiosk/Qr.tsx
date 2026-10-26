import QRCode from 'qrcode'

interface QrProps {
  value: string
  size: number
  label: string
}

/** A real, scannable code drawn as SVG rects, so it stays sharp at any size and needs no canvas. */
export function Qr({ value, size, label }: QrProps) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
  const cells: string[] = []
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) cells.push(`M${col + 4} ${row + 4}h1v1h-1z`)
    }
  }
  const box = modules.size + 8
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${box} ${box}`} shapeRendering="crispEdges">
      <rect width={box} height={box} className="fill-white" />
      <path d={cells.join('')} className="fill-ink" />
    </svg>
  )
}
