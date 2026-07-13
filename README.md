# Catedral Bot — Informativo de Tempo de Parada

Bot WhatsApp para envio em massa do informativo de regras de parada para refeição aos motoristas da Viação Catedral, com interface web para atualização de números.

---

## Objetivo

Enviar automaticamente uma imagem informativa + mensagem personalizada (nome e matrícula) para cada motorista ativo cadastrado na planilha, registrando o progresso e gerando um relatório PDF de confirmação com prints dos chats.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| Node.js | Runtime principal |
| whatsapp-web.js | Automação do WhatsApp via Puppeteer |
| Puppeteer | Controle do navegador (incluso no whatsapp-web.js) |
| xlsx | Leitura e escrita de planilhas Excel |
| pdfkit | Geração do relatório PDF |
| qrcode-terminal | Exibição do QR Code no terminal |

---

## Pré-requisitos

- Node.js >= 18
- Google Chrome ou Chromium instalado (usado pelo Puppeteer)
- Arquivo `informativo.png` na raiz do projeto
- Arquivo `Pessoa - 30-06-2026 10-07.xlsx` na raiz do projeto (planilha de motoristas)

---

## Instalação

```bash
# Na raiz do projeto (onde está este README)
npm install
```

---

## Como Executar

### Envio principal (1 conta)

```bash
npm run send
```

Um navegador abrirá. Escaneie o QR Code com seu WhatsApp para autenticar.

### Envio com 2 contas em paralelo

```bash
npm run send:dual
```

Dois navegadores abrirão. Escaneie cada QR Code com uma conta diferente para dobrar a velocidade de envio.

### Interface web (atualizar números)

```bash
npm run web
```

Acesse `http://localhost:3000` no navegador. Permite importar uma planilha com novos números de motoristas sem contato e atualizar a planilha principal.

### Retirar prints pendentes

```bash
npm run retake
```

Para motoristas marcados como ENVIADO mas sem screenshot de confirmação, conecta ao WhatsApp e tira os prints dos chats.

### Gerar arquivo de contatos VCF

```bash
npm run contacts
```

Gera um arquivo `.vcf` em `output/contatos/` com todos os motoristas ativos que possuem número cadastrado. Pode ser importado em massa no celular para o WhatsApp reconhecer os nomes.

### Verificação de sintaxe (sem executar)

```bash
node --check src/config/index.js
node --check src/bot/worker.js
node --check scripts/send.js
```

---

## Estrutura de Diretórios

```
INFORMATIVO DE TEMPO DE PARADA/
├── src/
│   ├── config/index.js          ← Todas as constantes e caminhos centralizados
│   ├── bot/
│   │   ├── client.js            ← Fábrica do cliente WhatsApp (LocalAuth)
│   │   ├── screenshot.js        ← Captura de tela do painel de chat
│   │   ├── sender.js            ← Verificação de número + envio de mensagem
│   │   └── worker.js            ← Loop completo de uma conta WhatsApp
│   ├── services/
│   │   ├── progressService.js   ← Leitura/escrita atômica do progresso.json
│   │   ├── reportService.js     ← Geração de PDF com pdfkit
│   │   └── spreadsheetService.js← Leitura/escrita da planilha xlsx
│   ├── utils/
│   │   ├── delay.js             ← sleep, aleatorio, delayAleatorio, microPausa
│   │   ├── message.js           ← Texto do informativo WhatsApp
│   │   └── phone.js             ← Normalização e formatação de números
│   └── api/
│       ├── server.js            ← Servidor HTTP na porta 3000
│       └── routes/
│           ├── stats.js         ← GET /api/stats
│           ├── update.js        ← POST /api/atualizar
│           └── download.js      ← GET /baixar-modelo
├── web/
│   └── index.html               ← Interface web (SPA, sem framework)
├── scripts/
│   ├── send.js                  ← Ponto de entrada do bot de envio
│   ├── retakeScreenshots.js     ← Retirar prints de envios sem screenshot
│   └── generateContacts.js     ← Gerar VCF de contatos
├── docs/
│   ├── ARCHITECTURE.md          ← Diagramas Mermaid da arquitetura
│   ├── API.md                   ← Documentação das rotas HTTP
│   └── CHANGELOG-REFATORACAO.md ← Histórico de mudanças arquiteturais
├── output/
│   ├── prints/                  ← Screenshots de confirmação de envio (gerados)
│   ├── relatorio/               ← PDFs de relatório (gerados)
│   └── contatos/                ← Arquivos VCF (gerados)
├── bot/                         ← Código legado (mantido para referência)
├── interface/                   ← Interface legada (mantida para referência)
├── Pessoa - 30-06-2026 10-07.xlsx   ← Planilha principal de motoristas
├── informativo.png              ← Imagem enviada aos motoristas
├── progresso.json               ← Estado de envio (gerado automaticamente)
├── package.json
├── .eslintrc.js
├── .prettierrc
├── .editorconfig
└── README.md
```

---

## Fluxo Geral da Aplicação

1. `npm run send` lê a planilha e filtra motoristas ativos
2. Motoristas desligados (por data ou base "DESLIGADOS") são ignorados
3. Motoristas sem número são registrados no `progresso.json` como `SEM_NUMERO`
4. Números duplicados são marcados como `DUPLICADO` (só o primeiro é enviado)
5. Pendentes são divididos entre as contas disponíveis (1 ou 2)
6. Cada conta abre um navegador, aguarda QR Code e começa a enviar
7. Cada envio: marca `PROCESSANDO` → verifica WhatsApp → envia imagem → tira print → marca `ENVIADO`
8. A cada 20 envios bem-sucedidos, pausa de 5 minutos para evitar bloqueios
9. Entre envios, delay aleatório de 1 a 50 segundos
10. Ao final, gera relatório PDF em `output/relatorio/`

---

## Variáveis de Ambiente

O projeto não usa variáveis de ambiente. Todas as configurações ficam em `src/config/index.js`.

Para alterar comportamentos como delay, limite por conta ou porta do servidor, edite esse arquivo diretamente.

---

## Arquitetura Detalhada

Consulte `docs/ARCHITECTURE.md` para diagramas Mermaid de:
- Arquitetura geral (módulos e dependências)
- Fluxo do bot (flowchart completo)
- Fluxo da interface web (sequence diagram)
