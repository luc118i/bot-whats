# Documentação da API HTTP

O servidor (`src/api/server.js`, sem framework — `http` nativo) expõe todas as rotas abaixo na porta configurada em `src/config/index.js` (padrão `3000`). Inicie com `npm run dev`. O dashboard React (`frontend/`, porta `5173` em dev) consome essa API via proxy do Vite.

Todas as respostas são JSON, exceto onde indicado (SSE, download de arquivo).

---

## Status e estatísticas

### GET /api/stats

Estatísticas cruzando a planilha com o progresso da campanha ativa (ou o arquivo legado global, se nenhuma campanha estiver ativa).

```json
{ "total": 336, "enviados": 145, "semNumero": 38, "semWhatsapp": 2, "pendentes": 151 }
```

### GET /api/stats/atividade?horas=24

Agrega **todos** os envios reais (`status: ENVIADO`) de **todas** as campanhas em buckets de tempo — não só a campanha ativa. Granularidade adapta ao período pedido: até 2h → 1min, até 48h → 15min, até 14 dias → 1h, acima disso → 1 dia. `horas` é clampado entre 1 e 1440 (60 dias).

```json
{
  "granularidadeMinutos": 15,
  "pontos": [
    { "ts": "2026-07-21T18:30:00.000Z", "enviados": 0 },
    { "ts": "2026-07-21T18:45:00.000Z", "enviados": 2 }
  ]
}
```

### GET /api/status

Status do processo de envio em background (campanha ou script legado).

```json
{ "running": true, "command": "send" }
```

---

## Logs

### GET /api/logs

Server-Sent Events com o stream de eventos do bot em tempo real (`start`, `log`, `end`). Usado pelo painel "Log em Tempo Real".

### GET /api/logs/history?kind=ALL&search=&limit=200&offset=0

Histórico persistido em `logs/bot.log` (JSON Lines, até 5000 eventos, com rotação automática). `kind`: `ALL | START | END | SUCCESS | ERROR | WARNING | INFO`.

```json
{ "logs": [{ "ts": "...", "kind": "SUCCESS", "type": "log", "command": null, "text": "...", "code": null }], "total": 842 }
```

### DELETE /api/logs/history

Apaga todo o histórico de logs.

---

## Execução do bot

### POST /api/run/:cmd

`cmd`: `send` | `send-dual` (executam uma campanha em memória, reaproveitando sessão WhatsApp já conectada — ver `runInProcess()` em `processController.js`) | `retake` | `contacts` (rodam como subprocesso `node`). Retorna `409` se já houver um processo em andamento.

### POST /api/stop

Sinaliza cancelamento do processo em andamento. Para um envio em memória, não mata na hora — o loop de envio para no próximo ponto de checagem (as esperas longas são canceláveis, então isso é rápido).

### POST /api/envio-avulso

Envia para **um único contato**, direto pela sessão já conectada de uma conta (sem abrir navegador). Body: `{ contaId, matricula }`. Só um envio avulso por vez.

---

## Campanhas

Uma campanha tem `status`: `rascunho | agendada | executando | pausada | finalizada | cancelada`. Cada campanha tem seu próprio arquivo de progresso (`progresso/<id>.json`), isolado das demais.

| Rota | Descrição |
|---|---|
| `GET /api/campanhas?status=` | Lista campanhas (filtro opcional por status) + métricas gerais |
| `GET /api/campanhas/metricas` | Métricas agregadas (ativas, agendadas, finalizadas, total enviado, taxa geral) |
| `GET /api/campanhas/ativa` | Campanha em execução (ou pausada, se nenhuma estiver executando), com stats recalculadas em tempo real |
| `POST /api/campanhas` | Cria campanha. Body: `{ nome, descricao?, modelos[], config: { filtroBaseOp[], filtroStatus, delayMin, delayMax, ... }, imagemBase64? }` |
| `GET /api/campanhas/:id` | Detalhe de uma campanha |
| `PUT /api/campanhas/:id` | Atualiza campanha (merge profundo em `config`/`stats`) |
| `DELETE /api/campanhas/:id` | Remove campanha (bloqueado se `status === 'executando'`) |
| `POST /api/campanhas/:id/iniciar` | Inicia o envio. `409` se já houver processo rodando ou outra campanha executando |
| `POST /api/campanhas/:id/pausar` | Sinaliza parada; progresso já enviado é preservado no arquivo da própria campanha |
| `POST /api/campanhas/:id/retomar` | Retoma de onde parou — reprocessa só quem não está `ENVIADO`/`SEM_WHATSAPP`/`SEM_NUMERO`/`DUPLICADO` |
| `POST /api/campanhas/:id/cancelar` | Encerra definitivamente |
| `POST /api/campanhas/:id/finalizar` | Marca como finalizada e recalcula stats finais |
| `POST /api/campanhas/:id/duplicar` | Cria uma cópia (config + modelos + imagem), como novo rascunho |
| `POST /api/campanhas/importar-progresso` | Importa um disparo pré-existente (arquivo de progresso legado) como uma campanha retroativa |

---

## Contatos

### GET /api/contatos?search=&status=ALL&base=ALL&campanha=&page=1&per_page=50

Lista paginada de motoristas, cruzando a planilha com o progresso (da campanha informada em `campanha`, ou o arquivo legado global). `status`: `ALL` ou qualquer status de progresso (`ENVIADO`, `PENDENTE`, `SEM_NUMERO`, `SEM_WHATSAPP`, `FALHOU`, `PROCESSANDO`, `DUPLICADO`).

```json
{ "contatos": [{ "nome": "...", "matricula": "...", "celular": "+55...", "base": "GBSB", "status": "ENVIADO", "statusLabel": "Enviado", "enviadoEm": "...", "conta": 1, "temPrint": true }], "total": 336, "page": 1, "totalPages": 7, "bases": ["GBSB", "GBHZ", "..."] }
```

### POST /api/contatos

Cria um novo motorista na planilha. Body: dados do contato.

### PUT /api/contatos/:matricula

Atualiza dados de um motorista existente (ex: número de celular).

---

## Contas WhatsApp

Gerencia sessões autenticadas (`.wwebjs_auth/session-catedral-conta-N`), usadas tanto pelo envio em campanha quanto pelo envio avulso.

| Rota | Descrição |
|---|---|
| `GET /api/contas` | Lista contas (sempre inclui ao menos as contas 1 e 2), com `status` e se já tem sessão salva |
| `GET /api/contas/:id` | Status pontual de uma conta (`idle \| conectando \| aguardando_qr \| conectado \| erro`) + QR Code em base64, se houver |
| `GET /api/contas/:id/eventos` | SSE com atualizações de status/QR Code em tempo real |
| `POST /api/contas/:id/conectar` | Inicia a conexão (abre Chromium headless, gera QR se necessário) |
| `POST /api/contas/:id/cancelar` | Cancela a tentativa de conexão em andamento |
| `DELETE /api/contas/:id` | Logout e remove a sessão salva em disco |

---

## Templates

### GET /api/templates

Retorna os pools de CTA e rodapé usados para compor as mensagens (sorteados junto com o modelo da campanha).

```json
{ "ctas": ["...", "..."], "rodapes": ["...", "..."] }
```

### PUT /api/templates

Substitui os pools. Body: `{ ctas: string[], rodapes: string[] }`.

---

## Configurações

### GET /api/config

Retorna a configuração atual (defaults + overrides salvos em `config.override.json`) e os defaults imutáveis, separadamente — usado pela tela de Configurações para mostrar o que foi modificado.

```json
{
  "atual": { "bot": { "delayMin": 20000, "delayMax": 45000, "pausaACada": 20, "pausaLonga": 180000, "respiroCada": 50, "respiroDuracao": 3600000, "respiroTempoIntervalo": 3600000, "respiroTempoDuracao": 1800000, "limitePorConta": 0 } },
  "defaults": { "bot": { "...": "..." } }
}
```

### PUT /api/config

Salva overrides (merge com o que já existia). Valida `delayMin`/`delayMax`/`pausaACada`/`respiroCada` dentro de faixas razoáveis.

### DELETE /api/config

Remove `config.override.json` — volta tudo para os defaults.

---

## Planilha

### POST /api/atualizar

Recebe números de celular para motoristas marcados como `SEM_NUMERO`, atualiza a planilha e limpa esse status no progresso da campanha ativa (ou do arquivo legado). Body: `{ "motoristas": [{ "matricula": "...", "celular": "..." }] }`.

```json
{ "ok": true, "atualizados": 12, "naoEncontrados": 1 }
```

### GET /baixar-modelo

Download do `motoristas_sem_numero.xlsx` (planilha modelo para preencher números faltantes).

---

## Relatórios e mídia

### GET /api/relatorio/excel?campanha=id

Gera e retorna um relatório Excel (`.xlsx`) formatado da campanha informada (ou do progresso legado, se omitido) — resumo executivo + tabela completa por motorista.

### GET /api/campanha/imagem?campanha=id

Serve a imagem/vídeo de preview de uma campanha (ou a imagem padrão do sistema, se a campanha não tiver mídia própria).

---

## Interface estática

### GET /

Serve `web/index.html` — uma interface legada mínima, mantida à parte do dashboard React (`frontend/`), que é a interface principal usada em desenvolvimento (`npm run dev` na pasta `frontend/`, porta 5173, consumindo esta mesma API via proxy).
