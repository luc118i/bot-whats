import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Save, RotateCcw, Info, Clock, Zap,
  AlertTriangle, CheckCircle2, Timer, Repeat, Smartphone,
} from 'lucide-react';
import { ContasWhatsApp } from '../components/configuracoes/ContasWhatsApp';
import axios from 'axios';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface BotConfig {
  delayMin:       number;
  delayMax:       number;
  pausaACada:     number;
  pausaLonga:     number;
  respiroCada:    number;
  respiroDuracao: number;
  limitePorConta: number;
  respiroTempoIntervalo: number;
  respiroTempoDuracao:   number;
}

interface ConfigResponse {
  atual:    { bot: BotConfig };
  defaults: { bot: BotConfig };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ms2s  = (ms: number)  => Math.round(ms / 1000);
const ms2m  = (ms: number)  => Math.round(ms / 60000);
const s2ms  = (s: number)   => s * 1000;
const m2ms  = (m: number)   => m * 60000;

// ─── Componentes de campo ────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  description: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (v: number) => void;
  warning?: string;
}

function ConfigField({ label, description, unit, value, min, max, defaultValue, onChange, warning }: FieldProps) {
  const isModified = value !== defaultValue;

  return (
    <div className="flex items-start gap-4 py-5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {isModified && (
            <span className="px-1.5 py-0.5 rounded text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200">
              Modificado
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        {warning && (
          <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
            <AlertTriangle size={11} /> {warning}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="w-24 px-3 py-2 text-sm font-mono text-right border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
        />
        <span className="text-xs text-gray-400 w-10">{unit}</span>
        {isModified && (
          <button
            onClick={() => onChange(defaultValue)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={`Restaurar padrão (${defaultValue})`}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Seção ───────────────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, description, children }: SectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={16} className="text-gray-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6">{children}</div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastProps { message: string; type: 'success' | 'error' }

function Toast({ message, type }: ToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
    </motion.div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function Configuracoes() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [defaults, setDefaults] = useState<BotConfig | null>(null);
  const [toast, setToast]       = useState<ToastProps | null>(null);

  // Campos em segundos/minutos para UX — convertidos ao salvar
  const [delayMinS,    setDelayMinS]    = useState(20);
  const [delayMaxS,    setDelayMaxS]    = useState(45);
  const [pausaACada,   setPausaACada]   = useState(20);
  const [pausaLongaM,  setPausaLongaM]  = useState(3);
  const [respiroCada,  setRespiroCada]  = useState(50);
  const [respiroDurM,  setRespiroDurM]  = useState(60);
  const [limite,       setLimite]       = useState(0);
  const [respiroTempoIntervaloM, setRespiroTempoIntervaloM] = useState(60);
  const [respiroTempoDuracaoM,   setRespiroTempoDuracaoM]   = useState(30);
  const [totalContatos, setTotalContatos] = useState(335);

  useEffect(() => {
    axios.get<ConfigResponse>('/api/config').then(({ data }) => {
      const b = data.atual.bot;
      setDelayMinS(ms2s(b.delayMin));
      setDelayMaxS(ms2s(b.delayMax));
      setPausaACada(b.pausaACada);
      setPausaLongaM(ms2m(b.pausaLonga));
      setRespiroCada(b.respiroCada);
      setRespiroDurM(ms2m(b.respiroDuracao));
      setLimite(b.limitePorConta);
      setRespiroTempoIntervaloM(ms2m(b.respiroTempoIntervalo));
      setRespiroTempoDuracaoM(ms2m(b.respiroTempoDuracao));
      setDefaults(data.defaults.bot);
    }).finally(() => setLoading(false));

    // Total real de contatos, pra estimativa não ficar com um número chumbado
    // no código que fica cada vez mais desatualizado conforme a planilha muda.
    axios.get<{ total: number }>('/api/stats').then(({ data }) => {
      if (data.total > 0) setTotalContatos(data.total);
    }).catch(() => {});
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function salvar() {
    if (delayMinS >= delayMaxS) {
      showToast('Delay mínimo deve ser menor que o máximo.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.put('/api/config', {
        bot: {
          delayMin:       s2ms(delayMinS),
          delayMax:       s2ms(delayMaxS),
          pausaACada,
          pausaLonga:     m2ms(pausaLongaM),
          respiroCada,
          respiroDuracao: m2ms(respiroDurM),
          limitePorConta: limite,
          respiroTempoIntervalo: m2ms(respiroTempoIntervaloM),
          respiroTempoDuracao:   m2ms(respiroTempoDuracaoM),
        },
      });
      if (data.ok) showToast('Configurações salvas com sucesso!', 'success');
      else showToast(data.erro || 'Erro ao salvar.', 'error');
    } catch {
      showToast('Erro de conexão com o servidor.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function restaurarDefaults() {
    if (!confirm('Restaurar todas as configurações para os valores padrão?')) return;
    setSaving(true);
    try {
      await axios.delete('/api/config');
      if (defaults) {
        setDelayMinS(ms2s(defaults.delayMin));
        setDelayMaxS(ms2s(defaults.delayMax));
        setPausaACada(defaults.pausaACada);
        setPausaLongaM(ms2m(defaults.pausaLonga));
        setRespiroCada(defaults.respiroCada);
        setRespiroDurM(ms2m(defaults.respiroDuracao));
        setLimite(defaults.limitePorConta);
        setRespiroTempoIntervaloM(ms2m(defaults.respiroTempoIntervalo));
        setRespiroTempoDuracaoM(ms2m(defaults.respiroTempoDuracao));
      }
      showToast('Configurações restauradas para o padrão.', 'success');
    } catch {
      showToast('Erro ao restaurar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const defaultsS = defaults ? {
    delayMinS:   ms2s(defaults.delayMin),
    delayMaxS:   ms2s(defaults.delayMax),
    pausaACada:  defaults.pausaACada,
    pausaLongaM: ms2m(defaults.pausaLonga),
    respiroCada: defaults.respiroCada,
    respiroDurM: ms2m(defaults.respiroDuracao),
    limite:      defaults.limitePorConta,
    respiroTempoIntervaloM: ms2m(defaults.respiroTempoIntervalo),
    respiroTempoDuracaoM:   ms2m(defaults.respiroTempoDuracao),
  } : null;

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-white border border-gray-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Settings size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
            <p className="text-sm text-gray-500">Parâmetros de comportamento do bot de envio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={restaurarDefaults}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={14} /> Restaurar padrões
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#F56600' }}
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 px-4 py-3 mb-6 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>As alterações entram em vigor no <strong>próximo envio</strong>. Processos em andamento continuam com as configurações anteriores.</span>
      </div>

      <div className="space-y-5">

        {/* Contas WhatsApp */}
        <Section
          icon={Smartphone}
          title="Contas WhatsApp"
          description="Vincule as contas do WhatsApp que serão usadas para envio de mensagens."
        >
          <div className="py-4">
            <ContasWhatsApp />
          </div>
        </Section>

        {/* Delays de envio */}
        <Section
          icon={Zap}
          title="Delays de Envio"
          description="Intervalo aleatório entre cada mensagem enviada. Valores maiores reduzem o risco de banimento."
        >
          <ConfigField
            label="Delay mínimo"
            description="Menor tempo de espera entre dois envios consecutivos."
            unit="seg"
            value={delayMinS}
            min={5}
            max={300}
            defaultValue={defaultsS?.delayMinS ?? 20}
            onChange={setDelayMinS}
            warning={delayMinS < 10 ? 'Valores abaixo de 10s aumentam o risco de banimento.' : undefined}
          />
          <ConfigField
            label="Delay máximo"
            description="Maior tempo de espera entre dois envios consecutivos."
            unit="seg"
            value={delayMaxS}
            min={10}
            max={600}
            defaultValue={defaultsS?.delayMaxS ?? 45}
            onChange={setDelayMaxS}
            warning={delayMaxS <= delayMinS ? 'Deve ser maior que o delay mínimo.' : undefined}
          />
        </Section>

        {/* Pausa periódica */}
        <Section
          icon={Clock}
          title="Pausa Periódica"
          description="Pausa curta aplicada periodicamente para simular comportamento humano. Os valores abaixo variam ±20% a cada disparo — não são exatos de propósito, pra não criar um padrão sempre idêntico."
        >
          <ConfigField
            label="Pausar a cada"
            description="Número de mensagens enviadas antes de acionar a pausa periódica (± 20%)."
            unit="envios"
            value={pausaACada}
            min={5}
            max={200}
            defaultValue={defaultsS?.pausaACada ?? 20}
            onChange={setPausaACada}
          />
          <ConfigField
            label="Duração da pausa"
            description="Quanto tempo o bot fica inativo durante a pausa periódica (± 20%)."
            unit="min"
            value={pausaLongaM}
            min={1}
            max={30}
            defaultValue={defaultsS?.pausaLongaM ?? 3}
            onChange={setPausaLongaM}
          />
        </Section>

        {/* Respiro por quantidade */}
        <Section
          icon={Timer}
          title="Respiro Longo (por quantidade)"
          description="Pausa extensa após um grande volume de envios — essencial para evitar banimento em listas grandes. O tempo real até disparar varia conforme o delay configurado (uma campanha com delay maior demora mais pra atingir a contagem). Valores variam ±20% a cada disparo."
        >
          <ConfigField
            label="Respiro a cada"
            description="Número de envios acumulados para acionar o respiro longo (± 20%)."
            unit="envios"
            value={respiroCada}
            min={10}
            max={500}
            defaultValue={defaultsS?.respiroCada ?? 50}
            onChange={setRespiroCada}
          />
          <ConfigField
            label="Duração do respiro"
            description="Tempo total de inatividade durante o respiro longo (± 20%)."
            unit="min"
            value={respiroDurM}
            min={10}
            max={240}
            defaultValue={defaultsS?.respiroDurM ?? 60}
            onChange={setRespiroDurM}
            warning={respiroDurM < 30 ? 'Respiros abaixo de 30 min podem não ser suficientes após grandes volumes.' : undefined}
          />
        </Section>

        {/* Respiro por tempo de relógio */}
        <Section
          icon={Timer}
          title="Respiro Longo (por tempo)"
          description="Regra universal por relógio, independente do delay ou da quantidade enviada — o que disparar primeiro entre esta regra e o respiro por quantidade acima vale. Ex: padrão é parar por 30min a cada 1h corrida de envio."
        >
          <ConfigField
            label="A cada"
            description="Intervalo de tempo corrido entre um respiro e o próximo (± 20%)."
            unit="min"
            value={respiroTempoIntervaloM}
            min={15}
            max={480}
            defaultValue={defaultsS?.respiroTempoIntervaloM ?? 60}
            onChange={setRespiroTempoIntervaloM}
          />
          <ConfigField
            label="Duração do respiro"
            description="Quanto tempo o bot fica pausado quando esta regra dispara (± 20%)."
            unit="min"
            value={respiroTempoDuracaoM}
            min={5}
            max={240}
            defaultValue={defaultsS?.respiroTempoDuracaoM ?? 30}
            onChange={setRespiroTempoDuracaoM}
          />
        </Section>

        {/* Limite por conta */}
        <Section
          icon={Repeat}
          title="Limite por Execução"
          description="Controla quantas mensagens cada conta envia por execução do bot."
        >
          <ConfigField
            label="Limite por conta"
            description="Máximo de mensagens por conta por execução. Use 0 para sem limite (envia tudo em uma sessão)."
            unit="msgs"
            value={limite}
            min={0}
            max={500}
            defaultValue={defaultsS?.limite ?? 0}
            onChange={setLimite}
            warning={limite > 0 && limite < 20 ? 'Limites muito baixos podem deixar muitos pendentes.' : undefined}
          />
        </Section>

        {/* Preview do tempo estimado */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Estimativa para {totalContatos.toLocaleString('pt-BR')} contatos (1 conta)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {(() => {
              const avgDelay = (delayMinS + delayMaxS) / 2;
              const totalSem = totalContatos * avgDelay;
              const pausasN  = Math.floor(totalContatos / pausaACada);
              const totalPausas = pausasN * pausaLongaM * 60;
              const respirosQtdN = Math.floor(totalContatos / respiroCada);
              const totalRespiroQtd = respirosQtdN * respiroDurM * 60;
              // Respiro por tempo depende do tempo total já acumulado até aqui — não dá
              // pra saber de antemão quantos vão caber sem calcular o resto primeiro.
              const tempoBaseSecs = totalSem + totalPausas + totalRespiroQtd;
              const respirosTempoN = Math.floor(tempoBaseSecs / (respiroTempoIntervaloM * 60));
              const totalRespiroTempo = respirosTempoN * respiroTempoDuracaoM * 60;
              const totalSecs = tempoBaseSecs + totalRespiroTempo;
              const horas = Math.floor(totalSecs / 3600);
              const mins  = Math.floor((totalSecs % 3600) / 60);
              return (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{avgDelay}s</div>
                    <div className="text-xs text-gray-500 mt-0.5">Média entre envios</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{respirosQtdN + respirosTempoN}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Respiros previstos ({respirosQtdN} qtd + {respirosTempoN} tempo)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: '#F56600' }}>
                      {horas}h {mins}min
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Tempo total estimado</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

      </div>

      {/* Toast */}
      {toast && <Toast {...toast} />}
    </div>
  );
}
