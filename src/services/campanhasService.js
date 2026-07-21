'use strict';

const fs   = require('fs');
const path = require('path');
const progressService = require('./progressService');

const ROOT        = path.join(__dirname, '..', '..');
const FILE        = path.join(ROOT, 'campanhas.json');
const IMAGENS_DIR = path.join(ROOT, 'campanhas_imagens');

// Decodifica uma data URI (base64) enviada pelo wizard e salva como arquivo,
// para o send.js poder usar essa mídia (imagem ou vídeo) no lugar da imagem padrão do sistema.
function salvarImagemCampanha(id, dataUri) {
  const match = /^data:(image|video)\/([\w-]+);base64,(.+)$/.exec(dataUri || '');
  if (!match) return null;
  const ext = match[2].replace('jpeg', 'jpg').replace('quicktime', 'mov');
  if (!fs.existsSync(IMAGENS_DIR)) fs.mkdirSync(IMAGENS_DIR, { recursive: true });
  const destino = path.join(IMAGENS_DIR, `${id}.${ext}`);
  fs.writeFileSync(destino, Buffer.from(match[3], 'base64'));
  return destino;
}

function copiarImagemCampanha(origem, novoId) {
  if (!origem || !fs.existsSync(origem)) return null;
  if (!fs.existsSync(IMAGENS_DIR)) fs.mkdirSync(IMAGENS_DIR, { recursive: true });
  const destino = path.join(IMAGENS_DIR, `${novoId}${path.extname(origem)}`);
  fs.copyFileSync(origem, destino);
  return destino;
}

// ─── Persistência ─────────────────────────────────────────────────────────────

function ler() {
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { return []; }
}

function salvar(lista) {
  fs.writeFileSync(FILE, JSON.stringify(lista, null, 2), 'utf8');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function listar() {
  return ler().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

function buscar(id) {
  return ler().find(c => c.id === id) || null;
}

function criar(dados) {
  const lista = ler();
  const agora = new Date().toISOString();
  const nova = {
    id:           `camp_${Date.now()}`,
    nome:         dados.nome || 'Campanha sem nome',
    descricao:    dados.descricao || '',
    status:       dados.status || (dados.agendadoPara ? 'agendada' : 'rascunho'),
    criadoEm:    agora,
    agendadoPara: dados.agendadoPara || null,
    iniciadoEm:  null,
    finalizadoEm: null,
    responsavel:  dados.responsavel || 'Sistema',
    config: {
      filtroBase:     dados.config?.filtroBase     || 'ALL',
      filtroBaseOp:   dados.config?.filtroBaseOp   || [],
      filtroStatus:   dados.config?.filtroStatus   || 'PENDENTE',
      modeloMensagem: dados.config?.modeloMensagem || 'aleatorio',
      delayMin:       dados.config?.delayMin       ?? 20000,
      delayMax:       dados.config?.delayMax       ?? 45000,
    },
    modelos:      Array.isArray(dados.modelos) ? dados.modelos.filter(t => t && t.trim()) : [],
    imagem:       null,
    stats: { total: 0, enviados: 0, pendentes: 0, falhas: 0, duracaoSegundos: 0 },
    eventos: [{ tipo: 'criacao', em: agora, msg: 'Campanha criada.' }],
  };
  if (dados.imagemBase64) nova.imagem = salvarImagemCampanha(nova.id, dados.imagemBase64);
  lista.push(nova);
  salvar(lista);
  return nova;
}

function atualizar(id, dados) {
  const lista = ler();
  const idx = lista.findIndex(c => c.id === id);
  if (idx === -1) return null;
  // Merge profundo para config e stats
  if (dados.config) dados.config = { ...lista[idx].config, ...dados.config };
  if (dados.stats)  dados.stats  = { ...lista[idx].stats,  ...dados.stats  };
  if (Array.isArray(dados.modelos)) {
    dados.modelos = dados.modelos.filter(t => t && t.trim());
  }
  // imagemBase64 presente no payload = usuário editou a imagem (nova, ou null pra remover)
  if ('imagemBase64' in dados) {
    if (lista[idx].imagem && fs.existsSync(lista[idx].imagem)) {
      try { fs.unlinkSync(lista[idx].imagem); } catch (_) {}
    }
    dados.imagem = dados.imagemBase64 ? salvarImagemCampanha(id, dados.imagemBase64) : null;
    delete dados.imagemBase64;
  }
  lista[idx] = { ...lista[idx], ...dados };
  salvar(lista);
  return lista[idx];
}

function deletar(id) {
  const c = buscar(id);
  if (c?.imagem && fs.existsSync(c.imagem)) {
    try { fs.unlinkSync(c.imagem); } catch (_) {}
  }
  salvar(ler().filter(c => c.id !== id));
  return { ok: true };
}

function adicionarEvento(id, tipo, msg) {
  const lista = ler();
  const idx = lista.findIndex(c => c.id === id);
  if (idx === -1) return;
  lista[idx].eventos = lista[idx].eventos || [];
  lista[idx].eventos.push({ tipo, em: new Date().toISOString(), msg });
  salvar(lista);
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────────

function obterAtiva() {
  // Prioriza a campanha em execução — pode haver uma pausada e outra executando
  // ao mesmo tempo (uma foi pausada para dar lugar a outra mais urgente), e é a
  // que está executando que precisa aparecer no painel de controle (Pausar/Parar).
  const lista = ler();
  return lista.find(c => c.status === 'executando') || lista.find(c => c.status === 'pausada') || null;
}

function iniciar(id) {
  // Cada campanha tem seu próprio arquivo de progresso (progresso/<id>.json),
  // isolado das demais — "iniciar" apenas garante que o dela comece vazio.
  // Não há mais risco de herdar ou sobrescrever dados de outra campanha.
  progressService.salvar({}, id);
  const agora = new Date().toISOString();
  const c = atualizar(id, { status: 'executando', iniciadoEm: agora });
  if (c) adicionarEvento(id, 'inicio', 'Campanha iniciada.');
  return c;
}

function pausar(id) {
  // Como o progresso é isolado por campanha (progresso/<id>.json), pausar é só
  // uma troca de status — nada mais toca nesse arquivo enquanto ela está
  // pausada, então não existe mais o que "restaurar" na retomada.
  const c = atualizar(id, { status: 'pausada' });
  if (c) adicionarEvento(id, 'pausa', 'Campanha pausada pelo usuário.');
  return c;
}

function retomar(id) {
  const c = atualizar(id, { status: 'executando' });
  if (c) adicionarEvento(id, 'retomada', 'Campanha retomada.');
  return c;
}

function cancelar(id) {
  const c = atualizar(id, { status: 'cancelada', finalizadoEm: new Date().toISOString() });
  if (c) adicionarEvento(id, 'cancelamento', 'Campanha cancelada pelo usuário.');
  return c;
}

function finalizar(id, stats) {
  const agora = new Date().toISOString();
  const c = atualizar(id, { status: 'finalizada', finalizadoEm: agora, stats });
  if (c) adicionarEvento(id, 'conclusao', `Campanha finalizada. ${stats.enviados} mensagens enviadas.`);
  return c;
}

function duplicar(id) {
  const original = buscar(id);
  if (!original) return null;
  const copia = criar({
    nome:        `${original.nome} (cópia)`,
    descricao:   original.descricao,
    responsavel: original.responsavel,
    config:      { ...original.config },
    modelos:     original.modelos,
  });
  if (original.imagem) {
    const novaImagem = copiarImagemCampanha(original.imagem, copia.id);
    if (novaImagem) atualizar(copia.id, { imagem: novaImagem });
  }
  return buscar(copia.id);
}

// ─── Métricas ─────────────────────────────────────────────────────────────────

function obterMetricas() {
  const lista = ler();
  const ativas     = lista.filter(c => c.status === 'executando').length;
  const agendadas  = lista.filter(c => c.status === 'agendada').length;
  const finalizadas = lista.filter(c => c.status === 'finalizada').length;
  const totalEnviados = lista.reduce((s, c) => s + (c.stats?.enviados || 0), 0);
  const totalMsgs     = lista.reduce((s, c) => s + (c.stats?.total    || 0), 0);
  const taxaGeral = totalMsgs > 0 ? ((totalEnviados / totalMsgs) * 100).toFixed(1) : '0.0';
  return { ativas, agendadas, finalizadas, totalEnviados, taxaGeral: parseFloat(taxaGeral) };
}

module.exports = {
  listar, buscar, criar, atualizar, deletar, adicionarEvento,
  obterAtiva, iniciar, pausar, retomar, cancelar, finalizar,
  duplicar, obterMetricas,
};
