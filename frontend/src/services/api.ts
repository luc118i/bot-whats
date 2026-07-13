import axios from 'axios'
import type { Stats, BotStatus } from '../types'

const http = axios.create({ baseURL: '' })

export async function fetchStats(): Promise<Stats> {
  const { data } = await http.get<Stats>('/api/stats')
  return data
}

export async function fetchStatus(): Promise<BotStatus> {
  const { data } = await http.get<BotStatus>('/api/status')
  return data
}

export async function runCommand(cmd: string): Promise<{ ok: boolean; erro?: string }> {
  const { data } = await http.post(`/api/run/${cmd}`)
  return data
}

export async function stopBot(): Promise<void> {
  await http.post('/api/stop')
}

export async function atualizarNumeros(
  motoristas: { matricula: string; nome: string; celular: string }[]
): Promise<{ ok: boolean; atualizados?: number; naoEncontrados?: number; erro?: string }> {
  const { data } = await http.post('/api/atualizar', { motoristas })
  return data
}
