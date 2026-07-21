import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import type { LogLine, ActivityPoint } from '../types'
import { MAX_LOG_LINES, ACTIVITY_WINDOW_MINUTES } from '../constants'

let globalId = 0

function nowHHMM(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function minuteKeyFor(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function classifyLog(text: string): LogLine['type'] {
  if (text.includes('Enviado') || text.includes('✅')) return 'SUCCESS'
  if (text.includes('Erro') || text.includes('❌')) return 'ERROR'
  return 'LOG'
}

// Só a linha exata de um envio individual concluído ("[CONTA N]   ✅ Enviado!")
// conta como atividade real. Um match frouxo em "Enviado"/"✅" (o que classifyLog
// usa pra colorir a linha) também bate em "✅ Autenticado!", "✅ Concluído!" e no
// resumo "✅ Enviados: N" — isso inflava o gráfico de Atividade de Envio com
// eventos que não são envios de fato (até 4x mais alto que o real).
function isEnvioReal(text: string): boolean {
  return /✅\s*Enviado!/.test(text)
}

function mapHistoryKind(kind: string): LogLine['type'] {
  if (kind === 'START' || kind === 'END' || kind === 'SUCCESS' || kind === 'ERROR') return kind
  return 'LOG'
}

export function useLogs() {
  const [lines, setLines] = useState<LogLine[]>([])
  const [activity, setActivity] = useState<ActivityPoint[]>([])
  const activityRef = useRef<Map<string, number>>(new Map())

  const addLine = useCallback((line: Omit<LogLine, 'id' | 'time'>, time?: string) => {
    const entry: LogLine = { ...line, id: ++globalId, time: time ?? nowHHMM() }
    setLines(prev => {
      const next = [...prev, entry]
      return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
    })
  }, [])

  const recomputeActivity = useCallback(() => {
    const now = new Date()
    const points: ActivityPoint[] = []
    for (let i = ACTIVITY_WINDOW_MINUTES - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60_000)
      const k = minuteKeyFor(d)
      points.push({ minute: k, enviados: activityRef.current.get(k) ?? 0 })
    }
    setActivity(points)
  }, [])

  const bumpActivity = useCallback((at: Date = new Date()) => {
    const key = minuteKeyFor(at)
    activityRef.current.set(key, (activityRef.current.get(key) ?? 0) + 1)
    recomputeActivity()
  }, [recomputeActivity])

  const clearLogs = useCallback(() => setLines([]), [])

  useEffect(() => {
    let cancelled = false
    let sse: EventSource | undefined

    // Recupera o que já aconteceu antes desta página carregar (persistido em
    // logs/bot.log via logService) — sem isso, um F5 zera o log ao vivo e o
    // gráfico de atividade, mesmo com o bot tendo rodado minutos antes.
    async function hydrate() {
      try {
        const { data } = await axios.get('/api/logs/history', { params: { limit: MAX_LOG_LINES } })
        if (cancelled) return
        const historico = [...(data.logs || [])].reverse() // API retorna do mais recente pro mais antigo
        historico.forEach((h: { ts: string; kind: string; type: string; command: string | null; text: string | null; code: number | null }) => {
          const d = new Date(h.ts)
          const valido = !isNaN(d.getTime())
          const time = valido
            ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : nowHHMM()
          const text = h.text
            ?? (h.type === 'start' ? `Iniciando: ${h.command ?? ''}` : h.type === 'end' ? (h.code === 0 ? 'Concluido (codigo 0)' : `Encerrado (codigo ${h.code ?? '—'})`) : '')
          addLine({ type: mapHistoryKind(h.kind), text }, time)
          if (valido && isEnvioReal(text) && Date.now() - d.getTime() <= ACTIVITY_WINDOW_MINUTES * 60_000) {
            bumpActivity(d)
          }
        })
      } catch (_) { /* histórico indisponível — segue só com o que chegar ao vivo */ }
    }

    function connect() {
      sse = new EventSource('/api/logs')

      sse.onmessage = (e: MessageEvent) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const msg = JSON.parse(e.data as string)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (msg.type === 'start') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            addLine({ type: 'START', text: `Iniciando: ${String(msg.command ?? '')}` })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (msg.type === 'end') {
            const code = msg.code as number | undefined
            addLine({ type: 'END', text: code === 0 ? 'Concluido (codigo 0)' : `Encerrado (codigo ${code ?? '—'})` })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (msg.type === 'log') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const text = String(msg.text ?? '')
            const type = classifyLog(text)
            addLine({ type, text })
            if (isEnvioReal(text)) bumpActivity()
          }
        } catch (_) { /* ignore parse errors */ }
      }

      sse.onerror = () => {
        sse?.close()
        setTimeout(() => { if (!cancelled) connect() }, 3000)
      }
    }

    recomputeActivity() // zera o gráfico imediatamente, antes da hidratação chegar
    void hydrate().then(() => { if (!cancelled) connect() })

    return () => { cancelled = true; sse?.close() }
  }, [addLine, bumpActivity, recomputeActivity])

  return { lines, logs: lines, activity, clearLogs }
}
