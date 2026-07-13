import { useState } from 'react'
import { Play, PlayCircle, Camera, ContactRound, Download, Square, Pause, Plus, CheckCircle2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { EnvioAvulsoModal } from './EnvioAvulsoModal'
import { runCommand, stopBot } from '../../services/api'
import type { BotStatus } from '../../types'
import type { CampanhaResumo } from '../../context/CampanhaContext'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

type DashState = 'ativa' | 'pausada' | 'idle'

interface QuickActionsProps {
  botStatus: BotStatus | undefined
  campanha: CampanhaResumo | null
  state: DashState
  onNovaCampanha: () => void
  onFinalizar?: () => void
}

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  variant: 'danger' | 'warning' | 'info'
  onConfirm: () => void
}

const CLOSED: ConfirmState = {
  open: false, title: '', message: '', confirmLabel: 'Confirmar', variant: 'info', onConfirm: () => {},
}

export function QuickActions({ botStatus, campanha, state, onNovaCampanha, onFinalizar }: QuickActionsProps) {
  const [loading, setLoading]     = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [confirm, setConfirm]     = useState<ConfirmState>(CLOSED)
  const [avulsoOpen, setAvulsoOpen] = useState(false)
  const qc = useQueryClient()

  function ask(cfg: Omit<ConfirmState, 'open'>) {
    setConfirm({ ...cfg, open: true })
  }
  function closeConfirm() { setConfirm(CLOSED) }

  // ── Ações ─────────────────────────────────────────────────────────────────

  async function doStop() {
    closeConfirm(); setLoading('stop'); setError(null)
    try {
      await stopBot()
      await qc.invalidateQueries({ queryKey: ['botStatus'] })
      await qc.invalidateQueries({ queryKey: ['campanha-ativa'] })
    } catch { setError('Erro ao parar o bot.') }
    finally { setLoading(null) }
  }

  async function doPausar() {
    closeConfirm(); setLoading('pausar'); setError(null)
    try {
      await stopBot()
      if (campanha) await axios.post(`/api/campanhas/${campanha.id}/pausar`)
      await qc.invalidateQueries({ queryKey: ['botStatus'] })
      await qc.invalidateQueries({ queryKey: ['campanha-ativa'] })
    } catch { setError('Erro ao pausar a campanha.') }
    finally { setLoading(null) }
  }

  async function doRetomar() {
    closeConfirm(); setLoading('retomar'); setError(null)
    try {
      const res = await axios.post(`/api/campanhas/${campanha!.id}/retomar`)
      if (!res.data.ok) throw new Error(res.data.erro)
      await qc.invalidateQueries({ queryKey: ['botStatus'] })
      await qc.invalidateQueries({ queryKey: ['campanha-ativa'] })
    } catch (e: any) { setError(e.message ?? 'Erro ao retomar.') }
    finally { setLoading(null) }
  }

  async function doFinalizar() {
    closeConfirm(); setLoading('finalizar'); setError(null)
    try {
      await axios.post(`/api/campanhas/${campanha!.id}/finalizar`)
      await qc.invalidateQueries({ queryKey: ['campanha-ativa'] })
      await qc.invalidateQueries({ queryKey: ['campanhas-lista'] })
      onFinalizar?.()
    } catch { setError('Erro ao finalizar a campanha.') }
    finally { setLoading(null) }
  }

  async function doCmd(cmd: string) {
    closeConfirm(); setLoading(cmd); setError(null)
    try {
      const res = await runCommand(cmd)
      if (!res.ok) setError(res.erro ?? 'Erro desconhecido.')
      else await qc.invalidateQueries({ queryKey: ['botStatus'] })
    } catch { setError('Erro de conexão com o servidor.') }
    finally { setLoading(null) }
  }

  const busy = !!loading

  return (
    <>
      <EnvioAvulsoModal open={avulsoOpen} onClose={() => setAvulsoOpen(false)} />

      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        variant={confirm.variant}
        onConfirm={confirm.onConfirm}
        onCancel={closeConfirm}
      />

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800">Ações Rápidas</h2>
          {state === 'ativa' && (
            <Button variant="danger" size="sm" loading={loading === 'stop'} disabled={busy}
              onClick={() => ask({
                title: 'Parar o bot agora?',
                message: 'O processo de envio será interrompido imediatamente. A campanha ficará pausada e poderá ser retomada depois.',
                confirmLabel: 'Parar bot',
                variant: 'danger',
                onConfirm: doStop,
              })}>
              <Square size={14} /> Parar Bot
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* ── ATIVA ───────────────────────────────────────────────────────── */}
        {state === 'ativa' && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="lg" className="justify-start col-span-2"
              loading={loading === 'pausar'} disabled={busy}
              onClick={() => ask({
                title: 'Pausar campanha?',
                message: `"${campanha?.nome}" será pausada. Os envios em andamento serão interrompidos e você poderá retomar a qualquer momento.`,
                confirmLabel: 'Pausar',
                variant: 'warning',
                onConfirm: doPausar,
              })}>
              <Pause size={16} /> Pausar Campanha
            </Button>
            <Button variant="green" size="lg" className="justify-start"
              loading={loading === 'retake'} disabled={busy}
              onClick={() => ask({
                title: 'Retirar prints?',
                message: 'Iniciará a captura de prints dos envios pendentes. O processo roda em paralelo com o envio.',
                confirmLabel: 'Iniciar',
                variant: 'info',
                onConfirm: () => doCmd('retake'),
              })}>
              <Camera size={16} /> Retirar Prints
            </Button>
            <Button variant="ghost" size="lg" className="justify-start"
              onClick={() => { window.location.href = '/baixar-modelo' }}>
              <Download size={16} /> Modelo Excel
            </Button>
          </div>
        )}

        {/* ── PAUSADA ─────────────────────────────────────────────────────── */}
        {state === 'pausada' && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" size="lg" className="justify-start col-span-2"
              loading={loading === 'retomar'} disabled={busy}
              onClick={() => ask({
                title: 'Retomar campanha?',
                message: `"${campanha?.nome}" será retomada do ponto onde parou. O bot voltará a enviar as mensagens pendentes.`,
                confirmLabel: 'Retomar',
                variant: 'info',
                onConfirm: doRetomar,
              })}>
              <Play size={16} /> Retomar Campanha
            </Button>
            <Button variant="blue" size="lg" className="justify-start"
              loading={loading === 'send'} disabled={busy || !!botStatus?.running}
              onClick={() => ask({
                title: 'Iniciar envio (1 conta)?',
                message: 'Inicia o envio utilizando uma conta do WhatsApp. Certifique-se de que o WhatsApp está conectado.',
                confirmLabel: 'Iniciar',
                variant: 'info',
                onConfirm: () => doCmd('send'),
              })}>
              <PlayCircle size={16} /> Iniciar (1 Conta)
            </Button>
            <Button variant="blue" size="lg" className="justify-start"
              loading={loading === 'send-dual'} disabled={busy || !!botStatus?.running}
              onClick={() => ask({
                title: 'Iniciar envio (2 contas)?',
                message: 'Inicia o envio utilizando duas contas do WhatsApp simultaneamente para maior velocidade.',
                confirmLabel: 'Iniciar',
                variant: 'info',
                onConfirm: () => doCmd('send-dual'),
              })}>
              <PlayCircle size={16} /> Iniciar (2 Contas)
            </Button>
            <Button variant="ghost" size="lg" className="justify-start"
              loading={loading === 'finalizar'} disabled={busy}
              onClick={() => ask({
                title: 'Marcar como concluída?',
                message: 'A campanha será encerrada e os resultados finais serão registrados. Esta ação não pode ser desfeita.',
                confirmLabel: 'Concluir',
                variant: 'warning',
                onConfirm: doFinalizar,
              })}>
              <CheckCircle2 size={16} /> Marcar concluída
            </Button>
            <Button variant="ghost" size="lg" className="justify-start"
              onClick={() => { window.location.href = '/baixar-modelo' }}>
              <Download size={16} /> Modelo Excel
            </Button>
          </div>
        )}

        {/* ── IDLE ────────────────────────────────────────────────────────── */}
        {state === 'idle' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onNovaCampanha}
              className="col-span-2 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: '#F56600' }}
            >
              <Plus size={16} /> Nova Campanha
            </button>
            <Button variant="green" size="lg" className="justify-start"
              loading={loading === 'retake'} disabled={busy}
              onClick={() => ask({
                title: 'Retirar prints?',
                message: 'Iniciará a captura de screenshots dos envios com prints pendentes.',
                confirmLabel: 'Iniciar',
                variant: 'info',
                onConfirm: () => doCmd('retake'),
              })}>
              <Camera size={16} /> Retirar Prints
            </Button>
            <Button variant="purple" size="lg" className="justify-start"
              loading={loading === 'contacts'} disabled={busy}
              onClick={() => ask({
                title: 'Gerar arquivo VCF?',
                message: 'Será gerado um arquivo de contatos (.vcf) com todos os motoristas cadastrados na planilha.',
                confirmLabel: 'Gerar',
                variant: 'info',
                onConfirm: () => doCmd('contacts'),
              })}>
              <ContactRound size={16} /> Gerar VCF
            </Button>
            <Button variant="ghost" size="lg" className="justify-start"
              onClick={() => { window.location.href = '/baixar-modelo' }}>
              <Download size={16} /> Modelo Excel
            </Button>
            <Button variant="blue" size="lg" className="justify-start"
              disabled={busy}
              onClick={() => setAvulsoOpen(true)}>
              <PlayCircle size={16} /> Envio Avulso
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}
