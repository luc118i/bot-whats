import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  )
}
