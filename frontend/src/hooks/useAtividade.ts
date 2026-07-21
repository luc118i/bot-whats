import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAtividade } from '../services/api'

// Faixas de período disponíveis no seletor do gráfico "Atividade de Envio".
export const FAIXAS_ATIVIDADE = [
  { label: '1h', horas: 1 },
  { label: '24h', horas: 24 },
  { label: '7d', horas: 24 * 7 },
  { label: '30d', horas: 24 * 30 },
] as const

export function useAtividade() {
  const [horas, setHoras] = useState<number>(24)

  const query = useQuery({
    queryKey: ['atividade', horas],
    queryFn: () => fetchAtividade(horas),
    refetchInterval: 20_000,
  })

  return {
    horas,
    setHoras,
    granularidadeMinutos: query.data?.granularidadeMinutos ?? 1,
    pontos: query.data?.pontos ?? [],
    loading: query.isLoading,
  }
}
