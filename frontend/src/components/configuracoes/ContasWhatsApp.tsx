import { useEffect, useRef, useState } from 'react'
import { Smartphone, Wifi, WifiOff, Loader2, QrCode, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import axios from 'axios'

interface Conta {
  id: number
  nome: string
  temSessao: boolean
  status: 'idle' | 'conectando' | 'aguardando_qr' | 'conectado' | 'erro'
}

type LiveStatus = 'idle' | 'conectando' | 'aguardando_qr' | 'conectado' | 'erro'

// ─── Card de uma conta ────────────────────────────────────────────────────────

function ContaCard({ conta, onRefresh }: { conta: Conta; onRefresh: () => void }) {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(conta.status)
  const [qrDataUrl, setQrDataUrl]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [removendo, setRemovendo]   = useState(false)
  const esRef = useRef<EventSource | null>(null)

  // Abre SSE para receber QR e atualizações de status em tempo real
  function abrirSSE() {
    if (esRef.current) esRef.current.close()
    const es = new EventSource(`/api/contas/${conta.id}/eventos`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        setLiveStatus(evt.status)
        if (evt.qrDataUrl) setQrDataUrl(evt.qrDataUrl)
        if (evt.status === 'conectado') {
          setQrDataUrl(null)
          setTimeout(() => { onRefresh(); closeSSE() }, 1500)
        }
        if (evt.status === 'idle' || evt.status === 'erro') {
          setQrDataUrl(null)
        }
      } catch (_) {}
    }
    es.onerror = () => es.close()
  }

  function closeSSE() {
    esRef.current?.close()
    esRef.current = null
  }

  useEffect(() => {
    // Abre SSE se já estiver em processo de conexão (reload da página)
    if (conta.status === 'conectando' || conta.status === 'aguardando_qr') {
      abrirSSE()
    }
    return () => closeSSE()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConectar() {
    setLoading(true)
    try {
      await axios.post(`/api/contas/${conta.id}/conectar`)
      abrirSSE()
    } catch (_) {}
    finally { setLoading(false) }
  }

  async function handleCancelar() {
    await axios.post(`/api/contas/${conta.id}/cancelar`)
    setQrDataUrl(null)
    setLiveStatus('idle')
    closeSSE()
  }

  async function handleRemover() {
    if (!window.confirm(`Remover a sessão da ${conta.nome}? Será necessário escanear o QR novamente.`)) return
    setRemovendo(true)
    try {
      await axios.delete(`/api/contas/${conta.id}`)
      setLiveStatus('idle')
      setQrDataUrl(null)
      closeSSE()
      onRefresh()
    } catch (_) {}
    finally { setRemovendo(false) }
  }

  const isConnecting = liveStatus === 'conectando' || liveStatus === 'aguardando_qr'

  const STATUS_INFO: Record<LiveStatus, { label: string; color: string; icon: React.ReactNode }> = {
    idle:          { label: 'Sem sessão',     color: 'text-gray-400',   icon: <WifiOff size={14} /> },
    conectando:    { label: 'Conectando...',  color: 'text-blue-500',   icon: <Loader2 size={14} className="animate-spin" /> },
    aguardando_qr: { label: 'Aguardando QR', color: 'text-amber-500',  icon: <QrCode size={14} /> },
    conectado:     { label: 'Conectado',      color: 'text-green-600',  icon: <CheckCircle2 size={14} /> },
    erro:          { label: 'Erro',           color: 'text-red-500',    icon: <AlertTriangle size={14} /> },
  }

  const si = STATUS_INFO[liveStatus]
  const temSessao = conta.temSessao || liveStatus === 'conectado'

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header do card */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          liveStatus === 'conectado' ? 'bg-green-50' :
          isConnecting              ? 'bg-blue-50'  :
          liveStatus === 'erro'     ? 'bg-red-50'   : 'bg-gray-100'
        }`}>
          <Smartphone size={18} className={
            liveStatus === 'conectado' ? 'text-green-600' :
            isConnecting              ? 'text-blue-500'  :
            liveStatus === 'erro'     ? 'text-red-500'   : 'text-gray-400'
          } />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">{conta.nome}</p>
          <p className={`flex items-center gap-1.5 text-xs font-medium mt-0.5 ${si.color}`}>
            {si.icon} {si.label}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {liveStatus === 'conectado' && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-lg">
              <Wifi size={12} /> Sessão ativa
            </span>
          )}

          {temSessao && liveStatus !== 'conectado' && !isConnecting && (
            <button
              onClick={handleConectar}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Reconectar
            </button>
          )}

          {!temSessao && !isConnecting && (liveStatus as string) !== 'conectado' && (
            <button
              onClick={handleConectar}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ background: '#F56600' }}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <QrCode size={12} />}
              Conectar
            </button>
          )}

          {isConnecting && (
            <button
              onClick={handleCancelar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={12} /> Cancelar
            </button>
          )}

              {temSessao && liveStatus !== ('conectado' as string) && !isConnecting && (
            <button
              onClick={handleRemover}
              disabled={removendo}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Remover sessão"
            >
              {removendo ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* QR Code */}
      {liveStatus === 'aguardando_qr' && qrDataUrl && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-5">
          <p className="text-xs font-semibold text-gray-600 mb-3 text-center">
            Abra o WhatsApp no celular → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong>
          </p>
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 inline-block">
              <img src={qrDataUrl} alt="QR Code WhatsApp" width={200} height={200} className="block" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-3">
            O QR Code expira em 60 segundos. Um novo será gerado automaticamente.
          </p>
        </div>
      )}

      {/* Aguardando autenticação após scan */}
      {liveStatus === 'conectando' && !qrDataUrl && (
        <div className="border-t border-gray-100 bg-blue-50 px-5 py-4 flex items-center justify-center gap-3">
          <Loader2 size={18} className="animate-spin text-blue-500" />
          <p className="text-sm text-blue-700 font-medium">Autenticando... aguarde</p>
        </div>
      )}

      {/* Sucesso */}
      {liveStatus === 'conectado' && (
        <div className="border-t border-green-100 bg-green-50 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
            <CheckCircle2 size={15} /> Conta conectada com sucesso!
          </p>
          <button
            onClick={handleRemover}
            disabled={removendo}
            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Desconectar
          </button>
        </div>
      )}

      {/* Erro */}
      {liveStatus === 'erro' && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600">Falha na autenticação. Remova a sessão e tente novamente.</p>
        </div>
      )}
    </div>
  )
}

// ─── Seção completa ───────────────────────────────────────────────────────────

export function ContasWhatsApp() {
  const [contas, setContas]   = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    try {
      const { data } = await axios.get('/api/contas')
      setContas(data.contas ?? [])
    } catch (_) {}
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed pb-1">
        Cada conta precisa ser vinculada via QR Code. A sessão é salva localmente e persiste entre reinicializações. Para usar 2 contas no envio duplo, vincule ambas.
      </p>
      {contas.map(c => (
        <ContaCard key={c.id} conta={c} onRefresh={carregar} />
      ))}
    </div>
  )
}
