import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import axios from 'axios'

export interface CampanhaResumo {
  id: string
  nome: string
  status: string
  iniciadoEm: string | null
  finalizadoEm: string | null
  stats: {
    total: number
    enviados: number
    entregues?: number
    processando?: number
    pendentes: number
    falhas: number
    semNumero?: number
    semWhatsapp?: number
    duplicados?: number
    validos?: number
    duracaoSegundos: number
  }
}

interface CampanhaCtx {
  campanhas: CampanhaResumo[]
  campanhaId: string | null
  campanha: CampanhaResumo | null
  setCampanhaId: (id: string | null) => void
  refetch: () => void
}

const Ctx = createContext<CampanhaCtx>({
  campanhas: [], campanhaId: null, campanha: null,
  setCampanhaId: () => {}, refetch: () => {},
})

export function CampanhaProvider({ children }: { children: ReactNode }) {
  const [campanhas, setCampanhas] = useState<CampanhaResumo[]>([])
  const [campanhaId, setCampanhaId] = useState<string | null>(null)

  async function carregar() {
    try {
      const { data } = await axios.get('/api/campanhas')
      const lista: CampanhaResumo[] = (data.campanhas ?? [])
        .filter((c: CampanhaResumo) => c.status !== 'rascunho' && c.status !== 'agendada')
        .sort((a: CampanhaResumo, b: CampanhaResumo) =>
          new Date(b.iniciadoEm ?? b.finalizadoEm ?? 0).getTime() -
          new Date(a.iniciadoEm ?? a.finalizadoEm ?? 0).getTime()
        )
      setCampanhas(lista)
      // Seleciona automaticamente: ativa/pausada ou mais recente
      setCampanhaId(prev => {
        if (prev && lista.find(c => c.id === prev)) return prev
        const ativa = lista.find(c => c.status === 'executando' || c.status === 'pausada')
        return ativa?.id ?? lista[0]?.id ?? null
      })
    } catch (_) {}
  }

  useEffect(() => { carregar() }, [])

  const campanha = campanhas.find(c => c.id === campanhaId) ?? null

  return (
    <Ctx.Provider value={{ campanhas, campanhaId, campanha, setCampanhaId, refetch: carregar }}>
      {children}
    </Ctx.Provider>
  )
}

export const useCampanha = () => useContext(Ctx)
