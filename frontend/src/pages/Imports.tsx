import { NumberImport } from '../components/imports/NumberImport'
import { KpiCards } from '../components/dashboard/KpiCards'
import { useStats } from '../hooks/useStats'

export function Imports() {
  const { data: stats, isLoading } = useStats()
  return (
    <div className="space-y-5 max-w-screen-xl">
      <KpiCards stats={stats} loading={isLoading} />
      <NumberImport />
    </div>
  )
}
