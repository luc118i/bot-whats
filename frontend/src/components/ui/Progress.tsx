import { motion } from 'framer-motion'

interface ProgressProps {
  value: number // 0-100
  className?: string
}

export function Progress({ value, className = '' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={`h-3 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-brand to-orange-400 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}
