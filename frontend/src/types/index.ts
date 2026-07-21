export interface Stats {
  total: number
  enviados: number
  pendentes: number
  semNumero: number
  semWhatsapp: number
}

export interface BotStatus {
  running: boolean
  command: string | null
}

export type LogType = 'start' | 'log' | 'end'

export interface LogEvent {
  type: LogType
  text?: string
  command?: string
  code?: number
}

export interface LogLine {
  id: number
  time: string
  type: 'START' | 'LOG' | 'SUCCESS' | 'ERROR' | 'END'
  text: string
}

export interface AtividadePonto {
  ts: string
  enviados: number
}

export interface AtividadeResponse {
  granularidadeMinutos: number
  pontos: AtividadePonto[]
}

export interface DriverRow {
  matricula: string
  nome: string
  celularRaw: string
  celular: string | null
}

export type Page = 'dashboard' | 'imports' | 'logs' | 'contatos' | 'configuracoes' | 'envios' | 'relatorios' | 'campanhas' | 'templates' | 'nova-campanha'
