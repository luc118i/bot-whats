import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '../services/api'
import { STATS_REFETCH_INTERVAL } from '../constants'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: STATS_REFETCH_INTERVAL,
  })
}
