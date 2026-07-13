import { useQuery } from '@tanstack/react-query'
import { fetchStatus } from '../services/api'
import { STATUS_REFETCH_INTERVAL } from '../constants'

export function useBotStatus() {
  return useQuery({
    queryKey: ['botStatus'],
    queryFn: fetchStatus,
    refetchInterval: STATUS_REFETCH_INTERVAL,
  })
}
