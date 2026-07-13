import { Wifi, WifiOff, Cpu } from 'lucide-react'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Spinner'
import type { BotStatus } from '../../types'
import { CMD_LABELS } from '../../constants'

interface BotMonitorProps {
  botStatus: BotStatus | undefined
  loading: boolean
}

export function BotMonitor({ botStatus, loading }: BotMonitorProps) {
  const isRunning = botStatus?.running ?? false
  const lastUpdate = new Date().toLocaleTimeString('pt-BR')

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Cpu size={18} className="text-gray-400" />
        <h2 className="font-bold text-gray-800">Monitor do Bot</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Status</span>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  <Wifi size={14} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600">Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-500">Desconectado</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Processo ativo</span>
            <span className="text-sm font-semibold text-gray-700">
              {botStatus?.command ? (CMD_LABELS[botStatus.command] ?? botStatus.command) : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Última atualização</span>
            <span className="text-sm font-mono text-gray-500">{lastUpdate}</span>
          </div>
        </div>
      )}
    </Card>
  )
}
