import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'blue' | 'green' | 'purple' | 'danger' | 'ghost' | 'outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand hover:bg-brand-dark text-white',
  blue:    'bg-blue-600 hover:bg-blue-700 text-white',
  green:   'bg-emerald-600 hover:bg-emerald-700 text-white',
  purple:  'bg-purple-700 hover:bg-purple-800 text-white',
  danger:  'bg-red-500 hover:bg-red-600 text-white',
  ghost:   'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200',
  outline: 'bg-white hover:bg-orange-50 text-brand border-2 border-brand',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 font-semibold rounded-xl
        transition-all duration-150 whitespace-nowrap
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
