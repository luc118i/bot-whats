import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

const ICON = {
  danger:  AlertTriangle,
  warning: AlertTriangle,
  info:    Info,
}

const COLORS = {
  danger:  { icon: 'text-red-500', bg: 'bg-red-50',    btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'text-amber-500', bg: 'bg-amber-50', btn: 'bg-amber-500 hover:bg-amber-600' },
  info:    { icon: 'text-blue-500', bg: 'bg-blue-50',   btn: 'bg-blue-600 hover:bg-blue-700' },
}

export function ConfirmModal({
  open, title, message,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  variant = 'info',
  onConfirm, onCancel,
}: ConfirmModalProps) {
  const Icon = ICON[variant]
  const c    = COLORS[variant]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Card */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={   { scale: 0.95, opacity: 0, y: 8  }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          >
            {/* Ícone */}
            <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center mb-4`}>
              <Icon size={22} className={c.icon} />
            </div>

            {/* Texto */}
            <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{message}</p>

            {/* Ações */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-colors ${c.btn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
