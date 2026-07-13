# Changelog de Refatoração

Registro das mudanças arquiteturais realizadas na migração do projeto monolítico para a estrutura modular em `src/`.

---

## Resumo Executivo

O projeto original tinha dois subprojetos independentes (`bot/` e `interface/`) com código duplicado, sem separação de responsabilidades e com caminhos hardcoded espalhados por vários arquivos. A refatoração criou uma estrutura unificada com responsabilidade única por módulo, configuração centralizada e ponto de entrada único.

---

## Mudanças por Módulo

### 1. Configuração centralizada

| | Antes | Depois |
|---|---|---|
| **O que era** | Constantes (`DELAY_MIN`, `IMAGEM`, `PROGRESSO`, etc.) definidas no início de cada arquivo que precisava delas | Arquivo `src/config/index.js` único com todas as constantes |
| **Por quê** | Qualquer mudança de caminho exigia editar múltiplos arquivos e era fácil esquecer algum | |
| **Benefício** | Alteração em um único lugar propaga para todos os módulos |

### 2. Funções de delay extraídas

| | Antes | Depois |
|---|---|---|
| **O que era** | `sleep`, `aleatorio`, `delayAleatorio`, `microPausa` duplicadas em `bot/index.js` e `bot/retirarPrints.js` | `src/utils/delay.js` exporta todas as quatro funções |
| **Por quê** | Código duplicado com risco de divergência de comportamento entre os scripts | |
| **Benefício** | Lógica de delay testável e reutilizável em qualquer módulo |

### 3. Normalização de número extraída

| | Antes | Depois |
|---|---|---|
| **O que era** | Lógica de `Math.round(Number(...))`, `replace(/\D/g,'')` e adição do DDI 55 repetida em `bot/lerPlanilha.js`, `interface/servidor.js` e no HTML da interface | `src/utils/phone.js` com `normalizarCelular` e `formatarParaWhatsApp` |
| **Por quê** | Comportamento levemente diferente entre implementações causaria discrepâncias nos números | |
| **Benefício** | Regra de formatação única, fácil de auditar e alterar |

### 4. Texto da mensagem extraído

| | Antes | Depois |
|---|---|---|
| **O que era** | Template literal com o informativo hardcoded em `bot/index.js` na função `montarMensagem` | `src/utils/message.js` exporta `montarMensagem` |
| **Por quê** | Alterar o texto da mensagem exigia localizar o arquivo correto manualmente | |
| **Benefício** | Texto do comunicado em arquivo dedicado, fácil de encontrar e atualizar |

### 5. Gerenciamento de progresso extraído

| | Antes | Depois |
|---|---|---|
| **O que era** | `carregarProgresso`, `salvarProgresso`, `marcarProgresso` em `bot/index.js`; reimplementadas em `bot/retirarPrints.js` | `src/services/progressService.js` com `carregar`, `salvar`, `marcar` |
| **Por quê** | Duplicação com nomes diferentes dificultava rastrear onde o arquivo era escrito | |
| **Benefício** | Ponto único de acesso ao progresso.json; lock implícito por leitura-escrita atômica |

### 6. Serviço de planilha unificado

| | Antes | Depois |
|---|---|---|
| **O que era** | `bot/lerPlanilha.js` com `lerMotoristas`; `interface/servidor.js` reimplementava `lerMotoristas` e `atualizarNumeros` localmente | `src/services/spreadsheetService.js` com `lerMotoristas`, `lerLinhasBrutas`, `atualizarNumeros`, `isAtivo` |
| **Por quê** | Duas implementações de leitura da planilha com colunas hardcoded em ambas | |
| **Benefício** | Lógica de planilha testável em isolamento; mudança de colunas em um único arquivo |

### 7. Geração de relatório isolada

| | Antes | Depois |
|---|---|---|
| **O que era** | `bot/gerarRelatorio.js` criava a pasta `relatorio/` na raiz usando `__dirname` relativo | `src/services/reportService.js` usa `config.paths.relatorio` que aponta para `output/relatorio/` |
| **Por quê** | Pasta gerada na raiz do projeto misturada com código-fonte | |
| **Benefício** | Todos os arquivos gerados ficam em `output/` separados do código |

### 8. Cliente WhatsApp isolado

| | Antes | Depois |
|---|---|---|
| **O que era** | `new Client(...)` com opções duplicadas em `bot/index.js` e `bot/retirarPrints.js` | `src/bot/client.js` exporta `criarCliente(contaId)` |
| **Por quê** | Mudança nas opções do Puppeteer exigia editar dois arquivos | |
| **Benefício** | Configuração do cliente em um ponto; fácil adicionar opções como proxy ou userAgent |

### 9. Screenshot isolado

| | Antes | Depois |
|---|---|---|
| **O que era** | `tirarPrint` duplicada com assinaturas diferentes em `bot/index.js` (usava `client.pupPage`) e `bot/retirarPrints.js` (recebia `page` diretamente) | `src/bot/screenshot.js` exporta `tirarPrint(page, numero, nome, prefixo)` |
| **Por quê** | Variante em `index.js` não buscava o chat por número, sempre clicava no primeiro | |
| **Benefício** | Comportamento consistente; `retakeScreenshots.js` usa a mesma lógica do bot principal |

### 10. Sender isolado

| | Antes | Depois |
|---|---|---|
| **O que era** | `client.getNumberId` + `client.sendMessage` embutidos no loop `ready` de `bot/index.js` | `src/bot/sender.js` exporta `enviarMensagem(client, celular, media, nome, matricula)` |
| **Por quê** | Impossível testar o envio sem instanciar um cliente WhatsApp real | |
| **Benefício** | Lógica de envio substituível e testável em isolamento |

### 11. Worker isolado

| | Antes | Depois |
|---|---|---|
| **O que era** | Função `rodarConta` de 110 linhas em `bot/index.js` misturando setup do cliente, loop de envio, delays e progresso | `src/bot/worker.js` orquestra os módulos isolados sem lógica de negócio própria |
| **Por quê** | Dificultava entender onde a lógica de envio terminava e o setup do evento `ready` começava | |
| **Benefício** | Worker legível de ~100 linhas com responsabilidade clara de orquestração |

### 12. Servidor HTTP modularizado

| | Antes | Depois |
|---|---|---|
| **O que era** | `interface/servidor.js` monolítico de 164 linhas com handlers, lógica de negócio e servidor na mesma função | `src/api/server.js` + `src/api/routes/stats.js` + `update.js` + `download.js` |
| **Por quê** | Adicionar uma nova rota exigia entender e editar o arquivo inteiro | |
| **Benefício** | Cada rota em arquivo próprio; server.js apenas monta as rotas |

### 13. Pasta de saída organizada

| | Antes | Depois |
|---|---|---|
| **O que era** | `prints/` e `relatorio/` criadas na raiz do projeto ao lado de `package.json` e código-fonte | `output/prints/`, `output/relatorio/`, `output/contatos/` |
| **Por quê** | Mistura de artefatos gerados com código versionado | |
| **Benefício** | Fácil adicionar `output/` ao `.gitignore`; projeto mais limpo |

### 14. Geração de contatos em Node.js

| | Antes | Depois |
|---|---|---|
| **O que era** | `gerarContatos.py` requerendo Python + pandas instalados no ambiente | `scripts/generateContacts.js` usando xlsx (já dependência do projeto) |
| **Por quê** | Dependência extra de ambiente; usuário precisava instalar Python e pandas separadamente | |
| **Benefício** | Executa com `npm run contacts` sem dependências externas adicionais |

### 15. package.json unificado

| | Antes | Depois |
|---|---|---|
| **O que era** | `bot/package.json` e `interface/package.json` separados; `npm install` precisava ser rodado em dois lugares | `package.json` na raiz com todas as dependências e scripts unificados |
| **Por quê** | Confusão sobre onde instalar; fácil esquecer de instalar em um dos subprojetos | |
| **Benefício** | `npm install` na raiz é suficiente; `npm run send`, `npm run web`, etc. funcionam de qualquer lugar |
