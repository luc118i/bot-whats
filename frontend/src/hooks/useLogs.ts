import { useEffect, useRef, useState, useCallback } from 'react'
import type { LogLine, ActivityPoint } from '../types'
import { MAX_LOG_LINES, ACTIVITY_WINDOW_MINUTES } from '../constants'

let globalId = 0

function nowHHMM(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function minuteKey(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function classifyLog(text: string): LogLine['type'] {
  if (text.includes('Enviado') || text.includes('✅')) return 'SUCCESS'
  if (text.includes('Erro') || text.includes('❌')) return 'ERROR'
  return 'LOG'
}

export function useLogs() {
  const [lines, setLines] = useState<LogLine[]>([])
  const [activity, setActivity] = useState<ActivityPoint[]>([])
  const activityRef = useRef<Map<string, number>>(new Map())

  const addLine = useCallback((line: Omit<LogLine, 'id' | 'time'>) => {
    const entry: LogLine = { ...line, id: ++globalId, time: nowHHMM() }
    setLines(prev => {
      const next = [...prev, entry]
      return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
    })
  }, [])

  const bumpActivity = useCallback(() => {
    const key = minuteKey()
    activityRef.current.set(key, (activityRef.current.get(key) ?? 0) + 1)

    const now = new Date()
    const points: ActivityPoint[] = []
    for (let i = ACTIVITY_WINDOW_MINUTES - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60_000)
      const k = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      points.push({ minute: k, enviados: activityRef.current.get(k) ?? 0 })
    }
    setActivity(points)
  }, [])

  const clearLogs = useCallback(() => setLines([]), [])

  useEffect(() => {
    // seed activity
    const now = new Date()
    const seed: ActivityPoint[] = []
    for (let i = ACTIVITY_WINDOW_MINUTES - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60_000)
      const k = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      seed.push({ minute: k, enviados: 0 })
    }
    setActivity(seed)

    let sse: EventSource

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const code = msg.code as number | undefined
            addLine({ type: 'END', text: code === 0 ? 'Concluido (codigo 0)' : `Encerrado (codigo ${code ?? '—'})` })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (msg.type === 'log') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const text = String(msg.text ?? '')
            const type = classifyLog(text)
            addLine({ type, text })
            if (type === 'SUCCESS') bumpActivity()
          }
        } catch (_) { /* ignore parse errors */ }
      }

      sse.onerror = () => {
        sse.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => { sse?.close() }
  }, [addLine, bumpActivity])

  return { lines, logs: lines, activity, clearLogs }
}
