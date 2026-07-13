import { useEffect, useRef } from 'react'
import { Terminal, Trash2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { LogLine } from '../../types'

interface ActivityTimelineProps {
  lines: LogLine[]
  onClear: () => void
}

const TYPE_STYLES: Record<LogLine['type'], { tag: string; tagCls: string; textCls: string }> = {
  START:   { tag: 'START',   tagCls: 'bg-blue-900 text-blue-300',    textCls: 'text-blue-300' },
  LOG:     { tag: 'LOG',     tagCls: 'bg-gray-700 text-gray-300',    textCls: 'text-gray-300' },
  SUCCESS: { tag: 'OK',      tagCls: 'bg-emerald-900 text-emerald-400', textCls: 'text-emerald-400' },
  ERROR:   { tag: 'ERR',     tagCls: 'bg-red-900 text-red-400',      textCls: 'text-red-400' },
  END:     { tag: 'END',     tagCls: 'bg-orange-900 text-orange-400', textCls: 'text-orange-400' },
}

export function ActivityTimeline({ lines, onClear }: ActivityTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-gray-400" />
          <h2 className="font-bold text-gray-800">Log em Tempo Real</h2>
          {lines.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500 font-mono">
              {lines.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 size={13} />
          Limpar
        </Button>
      </div>

      <div
        className="bg-[#1a1a1a] rounded-xl p-4 h-80 overflow-y-auto font-mono text-xs leading-relaxed"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
      >
        {lines.length === 0 ? (
          <span className="text-gray-600">Aguardando inicio de um processo...</span>
        ) : (
          lines.map((line) => {
            const s = TYPE_STYLES[line.type]
            return (
              <div key={line.id} className="flex items-start gap-2 mb-0.5">
                <span className="text-gray-600 flex-shrink-0 w-16">{line.time}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${s.tagCls}`}>
                  {s.tag}
                </span>
                <span className={s.textCls}>{line.text}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </Card>
  )
}
