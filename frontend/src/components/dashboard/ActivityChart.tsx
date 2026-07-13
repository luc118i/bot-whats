import { BarChart2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/Card'
import type { ActivityPoint } from '../../types'

interface ActivityChartProps {
  data: ActivityPoint[]
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart2 size={18} className="text-gray-400" />
        <h2 className="font-bold text-gray-800">Atividade de Envio</h2>
        <span className="text-xs text-gray-400 ml-1">(últimos 10 min)</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="minute"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #f0f0f0',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(v: number) => [`${v} enviados`, 'Enviados']}
          />
          <Line
            type="monotone"
            dataKey="enviados"
            stroke="#F56600"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#F56600' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
