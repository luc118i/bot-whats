# Arquitetura do Catedral Bot

## 1. Arquitetura Geral

```mermaid
graph TB
  subgraph Scripts
    S1[send.js]
    S2[retakeScreenshots.js]
    S3[generateContacts.js]
  end
  subgraph Bot Core
    W[worker.js]
    SN[sender.js]
    SC[screenshot.js]
    CL[client.js]
  end
  subgraph Services
    SP[spreadsheetService]
    PR[progressService]
    RE[reportService]
  end
  subgraph Utils
    DL[delay.js]
    PH[phone.js]
    MS[message.js]
  end
  subgraph API
    SV[server.js]
    R1[routes/stats]
    R2[routes/update]
    R3[routes/download]
  end
  subgraph Web
    UI[web/index.html]
  end

  S1 --> W
  W --> SN
  W --> SC
  W --> CL
  W --> PR
  SN --> MS
  SN --> DL
  SC --> DL
  S1 --> SP
  S1 --> PR
  S1 --> RE
  S2 --> PR
  S3 --> SP
  UI --> SV
  SV --> R1 & R2 & R3
  R1 --> SP & PR
  R2 --> SP
  R3 --> config
```

## 2. Fluxo do Bot (send.js)

```mermaid
flowchart TD
  A[Iniciar scripts/send.js] --> B[Ler planilha via spreadsheetService]
  B --> C[Filtrar desligados]
  C --> D[Filtrar sem número → marcar SEM_NUMERO]
  D --> E[Remover duplicatas por celular → marcar DUPLICADO]
  E --> F[Filtrar já enviados / PROCESSANDO do progresso.json]
  F --> G{Há pendentes?}
  G -- Não --> H[Fim — todos enviados]
  G -- Sim --> I[Dividir lista entre N contas]
  I --> J[Iniciar clientes WhatsApp via client.js]
  J --> K[Exibir QR Code → usuário escaneia]
  K --> L[Para cada motorista na lista]
  L --> M[Marcar PROCESSANDO no progresso.json]
  M --> N[getNumberId — verificar WhatsApp]
  N -- Inválido --> O[Marcar SEM_WHATSAPP]
  N -- Válido --> P[sendMessage com imagem + legenda]
  P --> Q[tirarPrint do painel de chat]
  Q --> R[Marcar ENVIADO + caminho do print]
  R --> S{A cada 20 enviados?}
  S -- Sim --> T[Pausa longa de 5 minutos]
  S -- Não --> U[Delay aleatório 1–50s]
  T & U --> L
  O --> L
  L -- Fim da lista --> V[Encerrar cliente WhatsApp]
  V --> W2[Aguardar todas as contas]
  W2 --> X[gerarRelatorio — PDF em output/relatorio]
  X --> Y[Exibir resumo final]
```

## 3. Fluxo da Interface Web

```mermaid
sequenceDiagram
  actor U as Usuário
  participant W as Web (index.html)
  participant S as API Server
  participant SP as SpreadsheetService
  participant PR as ProgressService

  U->>W: Acessa localhost:3000
  W->>S: GET /api/stats
  S->>PR: carregar()
  PR-->>S: progresso.json
  S->>SP: lerLinhasBrutas()
  SP-->>S: linhas da planilha
  S-->>W: { total, enviados, semNumero, pendentes }
  W-->>U: Exibe dashboard com estatísticas

  U->>W: Arrasta arquivo xlsx/csv
  W->>W: Lê e valida colunas com xlsx.js
  W-->>U: Exibe tabela de prévia com status por linha

  U->>W: Clica em "Atualizar Lista"
  W->>S: POST /api/atualizar { motoristas: [...] }
  S->>SP: atualizarNumeros(motoristas, progresso)
  SP->>SP: Reescreve planilha xlsx
  SP->>PR: Remove SEM_NUMERO do progresso.json
  S-->>W: { ok: true, atualizados: N, naoEncontrados: M }
  W-->>U: Exibe resultado e atualiza dashboard

  U->>W: Clica em "Baixar planilha modelo"
  W->>S: GET /baixar-modelo
  S-->>W: Stream do arquivo motoristas_sem_numero.xlsx
  W-->>U: Download do arquivo
```

## 4. Estrutura de Diretórios

```
INFORMATIVO DE TEMPO DE PARADA/
├── src/
│   ├── config/
│   │   └── index.js          ← Todas as constantes centralizadas
│   ├── bot/
│   │   ├── client.js         ← Fábrica do cliente WhatsApp
│   │   ├── screenshot.js     ← Captura de tela do chat
│   │   ├── sender.js         ← Envio de mensagem + verificação
│   │   └── worker.js         ← Loop principal de uma conta
│   ├── services/
│   │   ├── progressService.js   ← CRUD do progresso.json
│   │   ├── reportService.js     ← Geração de PDF
│   │   └── spreadsheetService.js← Leitura/escrita da planilha
│   ├── utils/
│   │   ├── delay.js          ← sleep, aleatorio, delayAleatorio
│   │   ├── message.js        ← Texto da mensagem WhatsApp
│   │   └── phone.js          ← Normalização de números
│   └── api/
│       ├── server.js         ← Servidor HTTP
│       └── routes/
│           ├── stats.js      ← GET /api/stats
│           ├── update.js     ← POST /api/atualizar
│           └── download.js   ← GET /baixar-modelo
├── web/
│   └── index.html            ← Interface web completa (SPA)
├── scripts/
│   ├── send.js               ← Ponto de entrada do bot
│   ├── retakeScreenshots.js  ← Retirar prints pendentes
│   └── generateContacts.js  ← Gerar VCF de contatos
├── docs/
│   ├── ARCHITECTURE.md       ← Este arquivo
│   ├── API.md                ← Documentação das rotas HTTP
│   └── CHANGELOG-REFATORACAO.md
├── output/
│   ├── prints/               ← Screenshots de confirmação
│   ├── relatorio/            ← PDFs de relatório
│   └── contatos/             ← Arquivos VCF
├── bot/                      ← Código legado (mantido para referência)
├── interface/                ← Interface legada (mantida para referência)
├── package.json
├── .eslintrc.js
├── .prettierrc
├── .editorconfig
└── README.md
```
