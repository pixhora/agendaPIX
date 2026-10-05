# Plano de backend e integração para Hermes

Data: 04/10/2026. Autor: Codex/T1. Worktree do backend (`feat/backend`), base auditada `0d6858f`.

## Objetivo e limite

Entregar o menor sistema que permita ao cliente escolher um serviço e horário, pagar o sinal por Pix e receber confirmação, enquanto o dono opera sua agenda pelo celular. Corrigir falhas comprovadas antes de adicionar funcionalidades. Este plano complementa `docs/PLANO_OPERACIONAL.md`; não cria uma segunda fila nem repete tarefas concluídas.

O código do backend foi inspecionado em `app/api`, `lib`, `lib/payments`, `lib/pix-key`, `db/schema`, migrations, seed e testes. As provas abaixo pertencem a esta worktree; não aprovam automaticamente as cópias das outras branches. Datas e resultados anteriores de README/backlog/PROGRESSO são históricos.

## Sistema iniciado para teste

`python3 scripts/run_system.py --timeout 180` iniciou backend e landing e reutilizou Preview e painel, sem encerrar processos alheios. A verificação posterior `python3 scripts/run_system.py --check` aprovou as quatro URLs:

| Superfície | URL |
| --- | --- |
| Preview | http://localhost:3001/preview |
| Landing | http://localhost:3005/ |
| Login do painel | http://localhost:3343/dashboard/login |
| Saúde HTTP do backend | http://localhost:3000/api/health |

Esses quatro servidores são checkouts de desenvolvimento distintos. Estarem disponíveis não significa que suas branches estejam integradas, que o SMTP entregue email ou que o Pix seja bancário. O launcher permanece ativo e supervisiona somente seus próprios processos.

## Auditoria atual

| Área | Estado | Evidência e limite |
| --- | --- | --- |
| Banco/migrations | COMPLETO no domínio atual | `db/schema`, migrations 0000–0004; aplicação e repetição aprovadas num banco exclusivo. Não há schema completo de assinatura. |
| Seed | COMPLETO para demonstração | `db/seed.mjs` repetido duas vezes: um negócio, três serviços, seis dias de funcionamento; sem duplicação. |
| Auth | PARCIAL | Better Auth/link mágico; sessão de uso único integrada testada. Falhas SMTP/adapter saneadas nesta entrega. Entrega por SMTP real ainda não comprovada. |
| Tenant | COMPLETO no recorte exercitado | `lib/tenancy.ts`, filtros em reservas/Pix e chaves compostas no banco; integrações rejeitam dono/referências alheias. Isso não substitui revisar os consumidores na versão final. |
| Serviços/disponibilidade/reservas | PARCIAL como produto | APIs públicas reais; relógio/fuso, preço no servidor, sinal zero, disputa de horário e rollback exercitados. Cadastro administrativo/onboarding integrado depende das outras entregas. |
| PaymentProvider/Pix | MOCK | `lib/payments/index.ts` instancia somente `FakePaymentProvider`, recusado em produção. QR contém `FAKE-PIX-NOT-PAYABLE`. |
| Webhook | PARCIAL | Assinatura, repetição, transação, divergência de valor e pagamento tardio testados com fake; protocolo do gateway real ainda ausente. |
| Chave Pix do dono | COMPLETO no domínio backend | `lib/pix-key` e rota autenticada: AES-256-GCM com contexto do negócio, máscara, origem e dono. Campo do painel depende da integração dos checkouts. |
| Provisionamento/onboarding | AUSENTE nesta base backend | Nenhum fluxo contratado de criação do negócio após cadastro. Não criar dados comerciais implicitamente a partir do seed. |
| Trial/assinatura | AUSENTE nesta base | Trial de sete dias e preços aprovados existem como referência, sem cobrança/controle de acesso comprovados. |
| Deploy | PARCIAL | Compose local do PostgreSQL e build de produção aprovados; aplicação Docker, HTTPS, restauração e operação no VPS ainda precisam de provas. |

## Falha corrigida nesta execução

`lib/auth.ts` tinha logger seguro, mas o catch do Better Call ainda registrava o `Error` bruto. A regressão pelo handler real reproduziu exposição de marcador sintético em erros SMTP e de persistência.

A correção usa o hook nativo `onAPIError` para impedir o registro bruto de falhas inesperadas e `onResponse` para sanear respostas 5xx, inclusive `APIError` transformado em resposta antes do hook de erro. Resposta pública fixa, status/cookies preservados, JSON sem cache. Preserva erros esperados, origem, validação e redirecionamentos. Não intercepta o console global, não modifica dependências e não adiciona bibliotecas. A rota aplica `handleHttp` para falhas de inicialização; configuração inválida responde 503 sem detalhes. A checagem de origem foi explicitamente habilitada, inclusive no ambiente de teste.

Arquivos: `lib/auth.ts`, `app/api/auth/[...all]/route.ts`, `tests/unit/auth-handler.test.ts` e contrato atualizado em `docs/CONTRATOS.md`. Essa entrega corresponde a T-01/B-01 do plano Hermes; não delegar novamente a mesma correção.

## Provas realizadas

- `pnpm lint`: passou sem warnings.
- `pnpm typecheck`: passou.
- `pnpm test`: 60 testes passaram em oito arquivos. Baseline anterior à correção tinha 52 testes; oito regressões novas cobrem falhas SMTP/adapter/APIError, status 503, cookies/headers, origem, validação, envio bem-sucedido e configuração inválida.
- `pnpm test:db`: 26 testes passaram em PostgreSQL exclusivo da auditoria, depois de aplicar as migrations. Inclui isolamento, integridade financeira, auth, concorrência, idempotência, rollback e webhook fake.
- `pnpm db:migrate`: duas execuções aprovadas no banco exclusivo; cinco migrations registradas.
- `pnpm db:seed`: duas execuções aprovadas no mesmo banco exclusivo; contagens conferidas. Banco exclusivo removido ao terminar; banco servido ao usuário preservado.
- `pnpm build`: passou com Turbopack numa cópia isolada da base mais a correção, com dependências locais copiadas, sem copiar `.env`. Nenhum servidor do usuário foi interrompido. Snapshot removido depois da prova.
- `pnpm test:e2e`: dois testes passaram em 375px reutilizando o backend ativo. Cobrem esqueleto/saúde e rejeição de email/sessão ausente; não são E2E do Pix bancário.
- Onze verificações HTTP reais passaram: saúde/sessão 200, chave Pix sem sessão 401, origem alheia 403, JSON/identificadores inválidos 400, corpo acima de 16 KiB 413 e negócio inexistente 404. Sem email ou pagamento real e sem criação de reservas nessa verificação.

O bloqueio histórico EPERM do Turbopack não foi reproduzido nesta execução. Não mantê-lo como bloqueador atual desta base. Build aprovado não aprova automaticamente a versão integrada das outras worktrees.

## Ordem de trabalho executável

### BE-01 — Revisar a correção real de auth

- Responsável: T1 como autor; Codex Revisor como revisor; T3 acompanha a regressão.
- Estado: implementação concluída; Codex Revisor OK (9 provas do handler), Cursor MELHORAR sem novo bloqueio no candidato. Integração dos consumidores permanece pendente.
- Alvos: arquivos da correção acima e reprodução existente em `agenda-review/docs/reproductions/reviewer-auth-error.test.ts`.
- Dependências: commit desta entrega identificado; disponibilidade do revisor.
- Invariantes: não publicar token, email, SQL, stack ou configuração; não transformar falha em sucesso; preservar 400/403 e consumo único do link.
- Pronto: revisor atravessa o handler real, confirma resposta/log seguros para SMTP e adapter, revisa o diff e não encontra `BLOQUEIA`.
- Reversão: revert apenas do commit desta correção. Não integrar uma versão que volte a expor erros.

### BE-02 — Definir o app integrado sem criar uma arquitetura paralela

- Responsável: Hermes/Cursor propõem integração; T1 mantém auth/Pix/domínio; T2/T4/T5 mantêm seus arquivos consumidores.
- Estado: PARCIAL; desenvolvimento ocorre em quatro checkouts Next independentes.
- Alvos: `docs/CONTRATOS.md`, `docs/EQUIPE.md`, `docs/PLANO_OPERACIONAL.md`, rotas existentes e consumidores reais.
- Dependências: mapa de commits e donos; BE-01; revisão Cursor. Integração de branches continua submetida ao fluxo de merge do humano.
- Direção recomendada: um único app Next final contendo rotas públicas, painel, auth e pagamentos. Worktrees são isolamento de desenvolvimento, não requisito de quatro aplicações em produção.
- Invariantes: preservar Server Components/Server Actions administrativos aprovados; não reescrever painel em REST só para conectar processos locais; não apagar cópias antes de provar a composição final.
- Pronto: mapa explícito dos arquivos que entram na versão integrada, imports sem conflitos, um contrato por comportamento e smoke de auth/booking/pix-key na mesma origem.
- Testes/reversão: build e regressão em composição isolada; manter commits de origem e reverter apenas mudanças da integração. Sem merge automático.
- Observação: B-02-D do plano Hermes propõe backend separado com três consumidores. Comparar seu custo com esta composição simples antes de criar CORS, cookies cruzados e APIs administrativas novas. Não relaxar origem para esconder 403.

### BE-03 — Alinhar execução, origem e sessão da composição escolhida

- Responsável: T1; Hermes verifica operação; consumidores aplicados pelos seus autores.
- Estado: PARCIAL; `scripts/run_system.py` inicia checkouts distintos e define origem por processo novo.
- Alvos: `scripts/run_system.py`, `lib/env.ts`, `lib/auth.ts`, `.env.example`, README e contrato de execução.
- Dependências: BE-02; coordenação com B-05 de T2, que já trabalhou na disponibilidade de 3343.
- Invariantes: sessão e tenant são validados no servidor; nenhuma origem curinga; não copiar segredos entre pastas; não encerrar processo alheio.
- Pronto: URL/portas/origens documentadas para desenvolvimento e versão final; login e mutações de dono funcionam sem desativar proteção de origem; launcher continua rejeitando porta de dono desconhecido.
- Testes/reversão: smoke positivo/negativo de origem e cookies no ambiente sintético; revert da alteração de configuração/launcher, preservando os processos anteriores.

### BE-04 — Completar provisionamento do negócio com contrato antes do código

- Responsável: T1 no domínio; T5 no onboarding; T2 na operação posterior.
- Estado: AUSENTE na base auditada.
- Alvos propostos: domínio em `lib/`, schema existente `businesses/services/business_hours` e integração com `components/onboarding/StepAccount.tsx` de T5. Localização final depende do contrato aprovado entre autores.
- Dependências: BE-02/BE-03 e inventário dos campos que o onboarding realmente coleta. Reutilizar escritores existentes do painel quando cobrirem a operação.
- Invariantes: dono vem da sessão, valores em centavos, slug validado/único, transação sem negócio pela metade, repetição sem criar cadastros duplicados; não inventar limite de negócios ou horários padrão comerciais.
- Pronto: cadastro/autenticação reais levam a negócio persistido, serviço e horários preenchidos pelo dono, acesso ao próprio painel e link público consultável.
- Testes/reversão: integração de criação, conflito de slug, repetição e tenant; E2E de ativação com dados fictícios. Mudanças de schema somente se comprovadamente necessárias, aditivas e sem DROP.

### BE-05 — Integrar chave Pix segura ao painel real

- Responsável: T1 mantém backend; T2 consome campo; T3 prova autorização.
- Estado: backend funcional; integração do app/painel PARCIAL.
- Alvos: `app/api/businesses/[businessId]/pix-key/route.ts`, `lib/pix-key`, componente de chave Pix de T2 e contrato.
- Dependências: BE-01/BE-02/BE-03; segredo de cifra instalado no ambiente apropriado por canal de segredos.
- Invariantes: resposta só tipo/máscara; dono alheio 404; mutação exige origem; nenhum ciphertext/chave em logs ou handoffs. Chave cadastrada não significa Pix recebido.
- Pronto: painel autenticado configura, consulta máscara e remove chave na composição final; isolamento continua aprovado. Sem QR pagável enquanto a confirmação não estiver definida.
- Testes/reversão: HTTP autenticado por dois donos no banco sintético, origem inválida e cifra ausente; preservar registros e chave mestra ao reverter código. Rotação exige procedimento de recriptografia, não substituição cega do segredo.

### BE-06 — Provar jornada de reservas com o backend existente

- Responsável: T3 coordena E2E; T1 corrige domínio; T4 corrige consumidor visual.
- Estado: domínio exercitado, produto integrado PARCIAL.
- Alvos: APIs `app/api/public/[slug]`, `lib/bookings`, `BookingFlow` de T4 e testes E2E da worktree QA.
- Dependências: BE-02/BE-04 e ambiente sintético que contenha negócio/serviço/horários.
- Invariantes: preço/duração/sinal vêm do servidor; `Idempotency-Key` persiste entre retries; consulta exige bearer; uma reserva por horário; sinal zero não cria cobrança; erro não gera confirmação visual.
- Pronto: serviço, disponibilidade, dados, cobrança e confirmação atravessam APIs reais, sem mocks de API escondidos; dois clientes disputam um horário e somente um vence.
- Testes/reversão: Playwright em 375px/desktop, testes integrados existentes e regressão específica de qualquer falha nova. Fake explicitamente identificado; não declarar dinheiro real por esse gate.

### BE-07 — Definir recebimento e confirmação do Pix

- Responsável: humano decide regra/conta; T1 verifica viabilidade; Hermes registra a decisão.
- Estado: BLOQUEADO por decisão P09/P04, não por falta de uma nova tela.
- Alvos: `docs/pedidos.md`, `docs/CONTRATOS.md`, `PaymentProvider` e configuração segura de gateway.
- Dependências: escolha de provedor/recebedor e credenciais apropriadas; definição de confirmação manual ou autenticada e tratamento financeiro de exceções.
- Invariantes: QR estático expõe a chave necessária ao pagador, mas não comprova liquidação. Não confirmar por frontend, por exibição do QR ou pelo botão de simulação.
- Pronto: decisão documentada sobre quem recebe, como o recebimento é confirmado e o que fazer com pagamento tardio/devolução; então implementar somente uma alternativa aprovada.
- Reversão: manter provider fake restrito a dev/teste enquanto não houver gateway válido; não autorizar cobranças reais por um plano técnico.

### BE-08 — Implementar um gateway real e sua recuperação

- Responsável: T1; Cursor revisa impacto; T3 valida; T4 apresenta o resultado real.
- Estado: AUSENTE; somente fake existe.
- Alvos: `lib/payments/provider.ts`, implementação do provedor escolhido, `lib/bookings/service.ts`, `lib/payments/webhook.ts` e rota correspondente.
- Dependências: BE-07; contrato e documentação oficial do gateway escolhido, sem adivinhar endpoints ou assinatura.
- Invariantes: centavos inteiros; autenticação sobre corpo original conforme protocolo; identidade de cobrança por tenant; retries não criam dinheiro duplicado; falha de commit não abandona cobrança sem recuperação; não manter transação do banco indefinidamente esperando rede externa.
- Pronto: criar cobrança sandbox, renderizar QR/copia-e-cola, validar evento, registrar entregas, confirmar uma vez e rejeitar valor/conteúdo divergente. A estratégia de criação externa/commit tem recuperação testada e tratamento explícito de dinheiro tardio.
- Testes/reversão: eventos adulterados/duplicados/concorrentes, timeout, rollback, recuperação e horário expirado; prova real somente com autorização/valor/recebedor definidos. Reversão não apaga eventos nem pagamentos já existentes.

### BE-09 — Validar SMTP e comportamento seguro do login

- Responsável: T1 no envio; T2/T5 nas telas; T3 no fluxo real.
- Estado: SMTP de testes simulado nas integrações; entrega externa ainda não comprovada.
- Alvos: `lib/email.ts`, `lib/auth.ts`, variáveis SMTP e telas existentes de login/cadastro.
- Dependências: BE-01/BE-02/BE-03 e SMTP/caixa de testes autorizada. Não inventar credenciais ou destinatário.
- Invariantes: expiração de cinco minutos e uso único; segredo/token ausentes dos logs; timeout de rede; falha não exibe “email enviado”; destino de retorno confiável.
- Pronto: mensagem realmente chega à caixa de teste, link cria sessão uma vez e repetição não cria outra sessão; indisponibilidade mantém erro recuperável e seguro.
- Testes/reversão: integração existente mais prova controlada de entrega/falha; reverter configuração por referência ao segredo anterior sem publicar valores.

### BE-10 — Fechar abuso e exposição na versão servida

- Responsável: T1 corrige causa comprovada; Codex Revisor/Cursor revisam; T3 reproduz.
- Estado: validação, limites de corpo, bearer, origem e tenant exercitados; comportamento sob abuso em produção não comprovado.
- Alvos: bordas HTTP/auth/reserva, configurações de proxy e testes relevantes.
- Dependências: BE-02 e ambiente sintético; não gerar tráfego de ataque no serviço usado pelo humano.
- Invariantes: não confiar em IP/headers de proxy arbitrários; não desativar autorização para corrigir erro; evitar mensagens com PII; proteger reservas públicas sem impedir o cliente legítimo.
- Pronto: revisão verifica limites já oferecidos pelo Better Auth e comportamento de reservas sob chamadas repetidas; qualquer correção é baseada em reprodução e usa mecanismo existente quando suficiente. Não adicionar CAPTCHA, serviço de filas ou Redis por precaução abstrata.
- Testes/reversão: casos negativos e repetição controlada local; documentar risco restante e reverter apenas controles adicionados, sem mexer em dados.

### BE-11 — Preparar produção e restauração mínima

- Responsável: T1 em infraestrutura; Hermes verifica operação; T3 valida; humano autoriza publicação.
- Estado: PARCIAL; build atual aprovado, Compose somente Postgres local.
- Alvos: Dockerfile/Compose de aplicação ainda a definir, README, `.env.example`, migrations e operação Coolify.
- Dependências: BE-02, gates da jornada e infraestrutura/segredos disponibilizados sem exposição.
- Invariantes: imagem não contém `.env`; produção recusa fake; migrations antes do código dependente; volume preservado; backup/restauração e rollback concretos.
- Pronto: container sobe a aplicação integrada, serve assets, responde saúde, usa HTTPS no ambiente preparado e restaura backup em banco separado. Health atual é liveness HTTP, não prova de DB/SMTP/gateway.
- Testes/reversão: build/container e restauração local antes de publicar; rollback de imagem preserva schema compatível e histórico. Sem deploy/push/merge automático nesta rodada.

### BE-12 — Adicionar trial/assinatura depois do núcleo aprovado

- Responsável: T1 no domínio/cobrança; T2/T5 nas experiências; T3 nos testes de dinheiro.
- Estado: AUSENTE; decisões de composição/acesso/renovação/cancelamento ainda abertas em P06.
- Alvos propostos: domínio/tabelas/contratos de assinatura estritamente necessários.
- Dependências: núcleo de agendamento/pagamento comprovado e regras comerciais fornecidas. Trial de sete dias e preços 4900/7900 centavos já aprovados; não redefinir planos.
- Invariantes: autorização e transições no servidor, idempotência, centavos, sem bloquear consulta financeira legítima por uma regra de acesso inventada.
- Pronto: trial e cobrança seguem as regras aprovadas, com testes de expiração/renovação/cancelamento/duplicidade pertinentes e cobrança do SaaS separada do sinal do cliente.
- Reversão: migrations aditivas; preservar histórico e acordos de cobrança. Não criar benefícios ou taxa adicional para justificar tabelas novas.

## Trabalho dos demais agentes

- T2 mantém painel real; não repetir WhatsApp T-03 (`f4b4361`) nem alterar tokens globais sem acordo. A disponibilidade HTTP atual permite retomar a prova integrada, respeitando o ambiente sintético de B-05.
- T4 mantém booking/Preview/tokens; não repetir overflow T-02 (`4545a9f`). Usar provas da retomada Pix T-04 já entregue antes de escolher outra tarefa; avaliar timeout mobile e assets standalone pelos achados existentes.
- T5 mantém landing/onboarding e contrato dos campos coletados; reutiliza tokens de T4 e não promete confirmação bancária que não existe.
- T6 audita deltas visuais em 375px/desktop, temas, foco, alvos de toque e estados; não cria funcionalidades nem redesenha por preferência.
- T3 testa a composição real, segurança e dinheiro. Codex Revisor revalida auth. Cursor revisa a integração entre contratos/domínios. Nenhum revisor precisa implementar para permanecer ocupado.

## Critério de parada e fila

Hermes cruza estes IDs com B/F/P/A já existentes, elimina duplicações e distribui apenas o que está comprovado/desbloqueado. Um autor por arquivo e worktree própria. Relatório novo é arquivo com commit/provas/pendências; coordenação mantém fila e envia um lote somente quando Hermes concluir o anterior. Timeout não autoriza reenviar.

Nenhuma parte é chamada de “100% funcional” sem jornada real e provas. Falta de gateway, regra comercial, SMTP, LGPD ou autorização de implantação é registrada com dono; não é substituída por simulação silenciosa. Política de privacidade e retenção/exclusão financeira continuam dependentes de decisão aprovada, sem texto legal inventado.
