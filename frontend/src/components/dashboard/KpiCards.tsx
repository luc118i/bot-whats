import { Users, CheckCircle2, Clock, PhoneOff, MessageSquareOff, TrendingUp } from 'lucide-react'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Spinner'
import type { Stats } from '../../types'

interface KpiCardsProps {
  stats: Stats | undefined
  loading: boolean
}

interface KpiDef {
  key: keyof Stats | 'taxa'
  label: string
  icon: React.ElementType
  color: string
  bg: string
  iconColor: string
}

const KPI_DEFS: KpiDef[] = [
  { key: 'total',       label: 'Total de Contatos', icon: Users,             color: 'text-blue-700',    bg: 'bg-blue-50',    iconColor: 'text-blue-500' },
  { key: 'enviados',    label: 'Enviados',           icon: CheckCircle2,      color: 'text-emerald-700', bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  { key: 'pendentes',   label: 'Pendentes',          icon: Clock,             color: 'text-orange-700',  bg: 'bg-orange-50',  iconColor: 'text-brand' },
  { key: 'semNumero',   label: 'Sem Número',         icon: PhoneOff,          color: 'text-yellow-700',  bg: 'bg-yellow-50',  iconColor: 'text-yellow-500' },
  { key: 'semWhatsapp', label: 'Sem WhatsApp',       icon: MessageSquareOff,  color: 'text-purple-700',  bg: 'bg-purple-50',  iconColor: 'text-purple-500' },
  { key: 'taxa',        label: 'Taxa de Sucesso',    icon: TrendingUp,        color: 'text-teal-700',    bg: 'bg-teal-50',    iconColor: 'text-teal-500' },
]

function getValue(kpi: KpiDef, stats: Stats): string {
  if (kpi.key === 'taxa') {
    if (!stats.total) return '0%'
    return `${((stats.enviados / stats.total) * 100).toFixed(1)}%`
  }
  return String(stats[kpi.key])
}

export function KpiCards({ stats, loading }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {KPI_DEFS.map((kpi) => {
        if (kpi.key === 'semWhatsapp' && stats && !stats.semWhatsapp) return null
        const Icon = kpi.icon
        return (
          <Card key={kpi.key} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <Icon size={18} className={kpi.iconColor} />
              </div>
            </div>
            {loading || !stats ? (
              <>
                <Skeleton className="h-7 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <p className={`text-2xl font-extrabold ${kpi.color}`}>{getValue(kpi, stats)}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">{kpi.label}</p>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
