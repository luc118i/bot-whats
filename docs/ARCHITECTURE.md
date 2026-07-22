# Arquitetura do Catedral Bot

## 1. Arquitetura Geral

```mermaid
graph TB
  subgraph Frontend["Dashboard (React + Vite)"]
    UI[Campanhas / Dashboard / Logs / Contatos / Relatórios / Configurações]
  end

  subgraph API["src/api"]
    SV[server.js]
    RC[routes/campanhas.js]
    RCT[routes/contacts.js]
    RCF[routes/config.js]
    RA[routes/atividade.js]
    RL[routes/logsHistory.js]
    RCN[routes/contas.js]
    PC[processController.js]
  end

  subgraph Bot["src/bot"]
    CAMP[campaign.js — orquestra uma campanha]
    W[worker.js — loop de envio de uma conta]
    SN[sender.js]
    SC[screenshot.js]
    CL[client.js]
  end

  subgraph Services["src/services"]
    CS[campanhasService.js — CRUD + ciclo de vida]
    PR["progressService.js — progresso por campanha"]
    SP[spreadsheetService.js]
    RE[reportService.js — PDF]
    LS[logService.js — histórico de eventos]
    TP[templatesService.js]
  end

  UI -->|REST + SSE| SV
  SV --> RC & RCT & RCF & RA & RL & RCN
  RC --> CS
  RC -->|inicia/retoma via processController| PC
  PC -->|executa em memória, reaproveita sessão| CAMP
  CAMP --> W
  CAMP --> CS
  CAMP --> PR
  CAMP --> SP
  CAMP --> RE
  W --> SN
  W --> SC
  W --> CL
  W --> PR
  RCT --> PR
  RA --> PR
  RL --> LS
  PC -.broadcast eventos.-> SV
```

**Ponto-chave:** iniciar/retomar uma campanha não abre um processo `node` separado — `runInProcess()` (`processController.js`) roda `executarCampanha()` dentro do próprio processo do servidor, para poder reaproveitar uma sessão WhatsApp já autenticada em memória (ex: conectada via painel em Configurações). Abrir um subprocesso novo criaria um segundo Chromium apontando pra mesma pasta de sessão, o que o Puppeteer rejeita.

## 2. Fluxo de uma Campanha (`campaign.js` → `worker.js`)

```mermaid
flowchart TD
  A[POST /campanhas/:id/iniciar ou /retomar] --> B[campaign.js: lê planilha + progresso da campanha]
  B --> C[Filtra por base operacional / status configurados]
  C --> D[Filtra sem número → marca SEM_NUMERO]
  D --> E[Remove duplicatas por celular → marca DUPLICADO]
  E --> F["Filtra já enviados / travados em PROCESSANDO"]
  F --> G{Há pendentes?}
  G -- Não --> H[Fim — gera relatório]
  G -- Sim --> I[Divide lista entre N contas]
  I --> J[worker.js processa cada motorista]
  J --> K[Marca PROCESSANDO]
  K --> L[getNumberId — verifica WhatsApp]
  L -- Inválido --> M[Marca SEM_WHATSAPP]
  L -- Válido --> N[Envia imagem + legenda sorteada]
  N --> O[Tira print de confirmação]
  O --> P[Marca ENVIADO]
  P --> Q{Limiar de pausa/respiro atingido?}
  Q -- "Por quantidade (±20%)" --> R[Pausa curta ou respiro longo]
  Q -- "Por tempo de relógio (±20%)" --> R
  Q -- Não --> S[Delay aleatório entre envios]
  R --> T[Cancelável a qualquer momento]
  T & S --> J
  M --> J
  J -- Fim da lista --> U[gerarRelatorio — PDF/Excel]
```

Cada registro de progresso vive em `progresso/<campanhaId>.json` — isolado por campanha. Isso elimina a necessidade de "resetar" um arquivo global entre campanhas e evita que pausar uma campanha enquanto outra roda (ou um encerramento abrupto) corrompa o progresso de qualquer uma delas.

## 3. Painel em Tempo Real (SSE + Analytics)

```mermaid
sequenceDiagram
  actor U as Usuário
  participant D as Dashboard (React)
  participant S as API Server
  participant PC as processController
  participant PR as progressService

  U->>D: Abre o Dashboard
  D->>S: GET /api/logs (Server-Sent Events)
  S-->>D: stream de eventos (start/log/end) em tempo real
  D->>S: GET /api/logs/history
  S-->>D: histórico persistido — hidrata o log ao vivo após F5

  U->>D: Clica em "Iniciar campanha"
  D->>S: POST /api/campanhas/:id/iniciar
  S->>PC: runInProcess() — executa a campanha no próprio processo
  PC-->>D: eventos via SSE conforme cada envio acontece

  loop a cada 20s
    D->>S: GET /api/stats/atividade?horas=N
    S->>PR: varre progresso de todas as campanhas
    S-->>D: envios agregados em buckets (granularidade adaptativa)
    D-->>U: gráfico com zoom (scroll) e navegação (arraste)
  end
```

## 4. Estrutura de Diretórios

```
INFORMATIVO DE TEMPO DE PARADA/
├── src/
│   ├── config/
│   │   └── index.js              ← Constantes e caminhos centralizados
│   ├── bot/
│   │   ├── campaign.js           ← Orquestra o envio de uma campanha inteira
│   │   ├── worker.js             ← Loop de envio de uma conta (pausas, respiro, delay)
│   │   ├── client.js             ← Fábrica do cliente WhatsApp
│   │   ├── screenshot.js         ← Captura de tela do chat
│   │   └── sender.js             ← Envio de mensagem + verificação de número
│   ├── services/
│   │   ├── campanhasService.js   ← CRUD e ciclo de vida das campanhas
│   │   ├── progressService.js    ← Progresso isolado por campanha
│   │   ├── reportService.js      ← Geração de PDF
│   │   ├── spreadsheetService.js ← Leitura/escrita da planilha
│   │   ├── logService.js         ← Histórico de eventos (para o painel de Logs)
│   │   └── templatesService.js   ← Pools de CTA/rodapé
│   ├── utils/
│   │   ├── delay.js              ← sleep cancelável, variação ±20%, delay aleatório
│   │   ├── message.js            ← Montagem da mensagem (padrão + customizada por campanha)
│   │   └── phone.js              ← Normalização de números
│   └── api/
│       ├── server.js             ← Servidor HTTP + SSE
│       ├── processController.js  ← Execução em memória / subprocesso + eventos
│       └── routes/                ← campanhas, contatos, config, contas, atividade, logs, relatório
├── frontend/                     ← Dashboard React (Vite + TypeScript + TanStack Query + Recharts)
├── scripts/
│   ├── send.js                   ← Ponto de entrada do bot (CLI)
│   ├── retakeScreenshots.js
│   └── generateContacts.js
├── docs/
│   ├── ARCHITECTURE.md           ← Este arquivo
│   ├── API.md                    ← Documentação das rotas HTTP
│   └── CHANGELOG-REFATORACAO.md
├── output/                       ← prints/, relatorio/, contatos/ (gerados)
├── progresso/                    ← Um arquivo de progresso por campanha (gerado)
├── campanhas_imagens/            ← Imagens customizadas por campanha (geradas)
├── campanhas.json                ← Estado das campanhas (gerado)
└── package.json
```
