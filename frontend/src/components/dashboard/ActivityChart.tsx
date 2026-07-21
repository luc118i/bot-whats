import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart2, ZoomOut } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts'
import { Card } from '../ui/Card'
import { FAIXAS_ATIVIDADE } from '../../hooks/useAtividade'
import type { AtividadePonto } from '../../types'

interface ActivityChartProps {
  pontos: AtividadePonto[]
  granularidadeMinutos: number
  horas: number
  onHorasChange: (horas: number) => void
  loading?: boolean
}

function formatarRotulo(ts: string, granularidadeMinutos: number): string {
  const d = new Date(ts)
  if (granularidadeMinutos >= 60 * 24) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  if (granularidadeMinutos >= 60) {
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function ActivityChart({ pontos, granularidadeMinutos, horas, onHorasChange, loading }: ActivityChartProps) {
  const data = useMemo(
    () => pontos.map(p => ({ ...p, rotulo: formatarRotulo(p.ts, granularidadeMinutos) })),
    [pontos, granularidadeMinutos]
  )

  const [range, setRange] = useState<[number, number]>([0, 0])
  const containerRef = useRef<HTMLDivElement>(null)
  const prevHorasRef = useRef(horas)
  const prevMaxIdxRef = useRef(0)

  // Troca de faixa (1h/24h/7d/30d) reseta o zoom pra ver o período inteiro.
  // Uma atualização normal de polling (mesma faixa, dado só cresceu um pouco)
  // não deve resetar um zoom que o usuário ajustou manualmente — mas também
  // precisa "seguir" o crescimento dos dados enquanto o usuário estiver vendo
  // o período inteiro (senão, ao carregar pela primeira vez, o range nasce
  // como "visão completa de 0 pontos" e nunca se expande quando os dados
  // chegam — ele só encolhe, nunca cresce de volta).
  useEffect(() => {
    const horasMudou = prevHorasRef.current !== horas
    prevHorasRef.current = horas
    const maxIdx = Math.max(0, data.length - 1)

    setRange(([s, e]) => {
      const eraViewCompleta = s === 0 && e === prevMaxIdxRef.current
      prevMaxIdxRef.current = maxIdx
      if (data.length === 0) return [0, 0]
      if (horasMudou || eraViewCompleta || s < 0 || e < 0 || s > maxIdx) return [0, maxIdx]
      return [Math.min(s, maxIdx), Math.min(e, maxIdx)]
    })
  }, [horas, data.length])

  // Zoom com scroll do mouse: roda pra cima aproxima, pra baixo afasta — em
  // torno do centro da janela visível atual (não da posição do cursor, pra não
  // depender de medir pixels do gráfico).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      if (data.length < 4) return
      e.preventDefault()
      setRange(([start, end]) => {
        const span = end - start
        const centro = (start + end) / 2
        const fator = e.deltaY < 0 ? 0.85 : 1 / 0.85
        const novoSpan = Math.min(data.length - 1, Math.max(3, span * fator))
        let novoStart = Math.round(centro - novoSpan / 2)
        let novoEnd = Math.round(centro + novoSpan / 2)
        novoStart = Math.max(0, novoStart)
        novoEnd = Math.min(data.length - 1, novoEnd)
        return [novoStart, novoEnd]
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [data.length])

  const zoomAtivo = range[0] > 0 || range[1] < data.length - 1

  // 1h/24h: barras — cada uma é a quantidade exata daquele intervalo, sem
  // interpolação, pra não passar a impressão de acúmulo quando na verdade
  // cada bucket é uma contagem independente.
  // 7d/30d: linha — nessas janelas mais longas (granularidade de hora/dia) o
  // interesse é a tendência/análise de acumulado ao longo do período, e uma
  // linha comunica isso melhor do que uma barra por hora/dia.
  const usarLinha = horas > 24

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-gray-400" />
          <h2 className="font-bold text-gray-800">Atividade de Envio</h2>
          {zoomAtivo && (
            <button
              onClick={() => setRange([0, Math.max(0, data.length - 1)])}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-1"
              title="Restaurar zoom"
            >
              <ZoomOut size={12} /> Restaurar
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {FAIXAS_ATIVIDADE.map(f => (
            <button
              key={f.horas}
              onClick={() => onHorasChange(f.horas)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                horas === f.horas ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} title="Use o scroll do mouse para dar zoom">
        <ResponsiveContainer width="100%" height={220}>
          {usarLinha ? (
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
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
                isAnimationActive={false}
              />
              {data.length > 6 && (
                <Brush
                  dataKey="rotulo"
                  height={24}
                  stroke="#F56600"
                  travellerWidth={8}
                  startIndex={range[0]}
                  endIndex={range[1]}
                  onChange={(r: { startIndex?: number; endIndex?: number }) => {
                    if (r.startIndex != null && r.endIndex != null) setRange([r.startIndex, r.endIndex])
                  }}
                />
              )}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: '#F566000d' }}
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #f0f0f0',
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(v: number) => [`${v} enviados`, 'Enviados']}
              />
              {/* Barras: cada uma é a quantidade enviada NAQUELE intervalo, isolada —
                  sem interpolação passando a impressão errada de acúmulo. */}
              <Bar dataKey="enviados" fill="#F56600" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              {data.length > 6 && (
                <Brush
                  dataKey="rotulo"
                  height={24}
                  stroke="#F56600"
                  travellerWidth={8}
                  startIndex={range[0]}
                  endIndex={range[1]}
                  onChange={(r: { startIndex?: number; endIndex?: number }) => {
                    if (r.startIndex != null && r.endIndex != null) setRange([r.startIndex, r.endIndex])
                  }}
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {loading && data.length === 0 && (
        <p className="text-xs text-gray-400 text-center mt-2">Carregando...</p>
      )}
    </Card>
  )
}
