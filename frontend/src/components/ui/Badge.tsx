import type { ReactNode } from 'react'

type Color = 'green' | 'orange' | 'yellow' | 'purple' | 'red' | 'gray' | 'blue'

interface BadgeProps {
  color: Color
  children: ReactNode
  dot?: boolean
}

const colorClasses: Record<Color, string> = {
  green:  'bg-emerald-100 text-emerald-700',
  orange: 'bg-orange-100 text-orange-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  purple: 'bg-purple-100 text-purple-700',
  red:    'bg-red-100 text-red-600',
  gray:   'bg-gray-100 text-gray-600',
  blue:   'bg-blue-100 text-blue-700',
}

const dotColors: Record<Color, string> = {
  green:  'bg-emerald-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  red:    'bg-red-500',
  gray:   'bg-gray-400',
  blue:   'bg-blue-500',
}

export function Badge({ color, children, dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClasses[color]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />}
      {children}
    </span>
  )
}
