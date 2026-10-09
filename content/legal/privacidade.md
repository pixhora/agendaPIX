# Política de Privacidade do AgendaPix

Última atualização: 9 de outubro de 2026

Esta Política explica quais dados pessoais o AgendaPix trata, para quê, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD").

---

## 1. Quem é o controlador

O AgendaPix é oferecido por **Matheus de França Torres**, pessoa física, que é o controlador dos dados descritos aqui, salvo o que está explicado na seção 3.

- **E-mail:** francatorresmatheus@gmail.com
- **WhatsApp:** +55 14 99750-4655

## 2. Encarregado (DPO)

Encarregado pelo tratamento de dados pessoais: **Matheus de França Torres**.

- **E-mail:** francatorresmatheus@gmail.com
- **WhatsApp:** +55 14 99750-4655

## 3. A quem esta Política se aplica e quem decide sobre cada dado

3.1. **Assinante** (dono do negócio): quem cria conta no AgendaPix. Para os dados da conta, do negócio e da assinatura, o AgendaPix é o **controlador**.

3.2. **Cliente final**: quem marca horário na página pública de um negócio. Esses dados são coletados para que o negócio atenda o seu cliente. Por isso, em regra, o **negócio (Assinante) é o controlador** dos dados dos seus clientes, e o AgendaPix atua como **operador**: trata esses dados em nome do negócio, conforme as configurações que ele faz no painel.

3.3. Se você é Cliente final e quer exercer seus direitos, pode falar com o negócio onde agendou ou com a gente. Quando o pedido couber ao negócio, vamos encaminhá-lo ou orientar você.

## 4. Quais dados tratamos

### 4.1. Assinante

| Dado | Quando é coletado |
|---|---|
| E-mail | No cadastro e a cada acesso, para enviar o código ou o link de acesso |
| Nome da conta | Preenchido com o nome do negócio informado no cadastro |
| Código e link de acesso | Gerados a cada login, guardados só como hash e válidos por 30 minutos |
| Dados de sessão: endereço IP e identificação do navegador (user agent) | A cada login, junto com a sessão |
| Segmento do negócio e plano escolhido | No cadastro (rascunho) |

### 4.2. Negócio

| Dado | Observação |
|---|---|
| Nome do negócio, link (endereço da página) e fuso horário | Exibidos na página pública |
| WhatsApp de contato do negócio (opcional) | O cadastro não pede. Pode ser informado depois, nas configurações do painel. Quando existe, aparece como botão de contato para o Cliente final |
| Serviços (nome, duração, preço, valor do sinal) e política do sinal | Exibidos na página pública |
| Horários de funcionamento | Exibidos na página pública |
| Situação do teste grátis e da assinatura, e pedidos de ativação | Uso interno |
| Chave Pix cadastrada numa versão anterior do produto (se houver) | Guardada **cifrada** e **inativa**. Não é usada em cobranças nem exibida |

### 4.3. Conexão com o Mercado Pago (Assinante)

| Dado | Observação |
|---|---|
| Identificador da conta Mercado Pago | Necessário para a conexão |
| Tokens de acesso e de renovação | Guardados só **cifrados** |
| Nome de exibição curto (ex.: "Ana S.") e e-mail **mascarado** da conta | Obtidos do Mercado Pago, para você reconhecer qual conta está ligada |
| Permissões concedidas, modo (teste ou produção), datas de conexão e renovação, situação da conexão | Uso interno |
| Versão e resumo (hash) do texto de autorização aceito, data do aceite e usuário que aceitou | Prova do consentimento |
| Endereço IP no momento do aceite | Guardado só no registro de eventos da conexão |

### 4.4. Cliente final

| Dado | Observação |
|---|---|
| Nome | Informado no agendamento |
| WhatsApp (telefone) | Informado no agendamento. Identifica o cliente dentro de cada negócio |
| Agendamento: serviço, data e hora, preço, sinal e situação | Gerado no agendamento |
| Texto da política do sinal exibido e aceito, com os prazos calculados | Guardado junto com o agendamento |
| Dados do pagamento do sinal: valor, situação, identificador da cobrança no Mercado Pago, código Pix "copia e cola", QR Code e datas | Gerados pela cobrança |
| Dados de devoluções: valor, situação e identificador da devolução no Mercado Pago | Quando há devolução |
| Resumo técnico do pedido de agendamento (hash SHA-256 dos dados enviados: serviço, horário, nome e telefone; o CPF não entra) | Guardado no banco para evitar pedidos duplicados |
| Código de acesso ao agendamento | Gerado para o Cliente final acompanhar o pagamento. No servidor fica só um resumo dele |
| CPF (opcional) | Ver item 4.5 |

O banco de dados tem um campo para o e-mail do Cliente final, mas o formulário de agendamento atual **não pede e-mail**.

### 4.5. CPF do Cliente final

- **Quando é pedido:** o campo de CPF só aparece se a exigência de CPF do pagador estiver ligada na configuração do AgendaPix. Hoje ela vem desligada.
- **Com quem é compartilhado:** só quando essa exigência está ligada, o CPF vai direto ao **Mercado Pago**, como identificação do pagador, para gerar o Pix.
- **Como fica guardado:** o AgendaPix **não guarda** o CPF. Ele não é gravado no banco de dados, não entra no resumo técnico do pedido, não aparece no painel e não fica no armazenamento do navegador.

### 4.6. Dados técnicos e de segurança

- **Endereço IP:** usado para limitar tentativas e evitar abuso no agendamento, no envio de códigos e no cadastro. Isso só acontece quando o IP vem de uma fonte confiável, conforme a configuração do servidor; sem ela, o envio de códigos é limitado apenas por e-mail. Nesses controles, o IP e o e-mail são guardados só como **hash** (código irreversível com chave secreta), e não em texto aberto.
- **Registros de pagamento e de avisos do Mercado Pago:** guardamos identificadores, resumos (hash) e o resultado do processamento, sem o conteúdo bruto, o telefone ou segredos.
- **Registros da aplicação (logs):** o código evita registrar dados pessoais nas mensagens de erro de autenticação. Os registros gerados pela hospedagem seguem as regras do provedor.

### 4.7. Dados guardados no seu navegador

Veja a seção 11.

## 5. Para que usamos os dados e com qual base legal

| Finalidade | Dados | Base legal (LGPD, art. 7º) |
|---|---|---|
| Criar e manter a conta, enviar código de acesso e manter a sessão | E-mail, nome, sessão | Execução de contrato (inciso V) |
| Publicar a página do negócio e permitir agendamentos | Dados do negócio, serviços, horários | Execução de contrato (V) |
| Registrar agendamentos e mostrar a agenda e a lista de clientes ao negócio | Dados do Cliente final | Execução de contrato entre o Cliente final e o negócio, em nome do negócio (V) |
| Gerar o Pix do sinal, confirmar o pagamento, cancelar cobranças vencidas e fazer devoluções | Nome do Cliente final, CPF (só quando exigido), dados do pagamento, tokens do Mercado Pago | Execução de contrato (V) |
| Avisar o Assinante por e-mail (sinal devolvido, devolução que precisa ser feita à mão, pagamento a conferir) | E-mail do Assinante; na maioria dos avisos, nome do Cliente final, serviço e horário | Execução de contrato (V) |
| Controlar o teste grátis, a assinatura e os pedidos de ativação | Dados do negócio e da assinatura | Execução de contrato (V) |
| Provar o consentimento dado na conexão com o Mercado Pago | Versão do texto, hash, data, IP | Exercício regular de direitos (VI) e legítimo interesse (IX) |
| Evitar pedidos de agendamento duplicados | Resumo técnico do pedido | Execução de contrato (V) e legítimo interesse (IX) |
| Prevenir fraude e abuso (limites de tentativas e de reservas sem pagamento) | IP e e-mail em hash, telefone | Legítimo interesse (IX) |
| Manter registros de auditoria de pagamentos e devoluções | Identificadores e valores, sem dados de contato | Legítimo interesse (IX) e exercício regular de direitos (VI) |
| Cumprir obrigações legais e atender autoridades | Os necessários | Obrigação legal (II) |

Não usamos os dados para publicidade e não vendemos dados pessoais. O código atual não inclui ferramentas de análise de navegação (analytics) nem rastreadores de terceiros.

## 6. Com quem compartilhamos

Compartilhamos dados apenas com quem precisa deles para o serviço funcionar:

| Quem | O quê | Por quê |
|---|---|---|
| **Mercado Pago** | Valor do sinal; nome do Cliente final, separado em nome e sobrenome; CPF, só quando a exigência de CPF estiver ligada; um e-mail técnico gerado pelo sistema (não é o e-mail real do Cliente final); identificação da cobrança; tokens da conta do Assinante | Gerar o Pix, consultar e cancelar cobranças, fazer devoluções e receber avisos de pagamento. O Mercado Pago também trata esses dados conforme a política dele |
| **Provedor de envio de e-mail (SMTP):** Resend | E-mail do Assinante e o conteúdo das mensagens (código de acesso; avisos que podem conter nome do Cliente final, serviço e horário) | Enviar códigos de acesso e avisos |
| **Vercel** (hospedagem da aplicação, região São Paulo – `gru1`) | Todos os dados que passam pela aplicação | Executar o serviço |
| **Banco de dados:** Neon (empresa do grupo Databricks, dos EUA), com os dados na região São Paulo da AWS (aws-sa-east-1) | Todos os dados guardados | Armazenar os dados |
| **WhatsApp (Meta)** | Só quando você mesmo abre uma conversa pelos botões do site (por exemplo, o pedido de assinatura, que leva o link da sua página, ou o contato entre o negócio e o cliente) | Comunicação iniciada por você |
| **O negócio (Assinante)** | Dados do Cliente final que agendou com ele (o CPF não é guardado nem aparece no painel) | Atender o cliente |
| **Autoridades** | Os dados exigidos | Quando houver obrigação legal ou ordem judicial |

## 7. Transferência internacional

A aplicação roda na região São Paulo da Vercel. A Vercel é uma empresa estrangeira, e alguns fornecedores (como a Resend, que envia os e-mails, e o provedor do banco de dados) podem tratar dados fora do Brasil.

## 8. Por quanto tempo guardamos

| Dado | Prazo atual |
|---|---|
| Rascunho do cadastro (inclui e-mail) | Vence em 7 dias. Depois do vencimento, é apagado por uma rotina que roda uma vez por dia às 03:00 (Brasília), inclusive os rascunhos que já viraram conta |
| Código e link de acesso | Válidos por 30 minutos |
| Contadores antiabuso (IP ou e-mail em hash) | Os que têm mais de 24 horas são apagados aos poucos, nas verificações seguintes |
| Tokens do Mercado Pago depois de desconectar pelo AgendaPix | Sem Pix em aberto, apagados na hora. Com Pix ou devolução em aberto, ficam guardados (cifrados) só para resolvê-los e são apagados em até 24 horas depois que se resolverem, ou depois de 7 dias se algum Pix ficar travado |
| Tokens do Mercado Pago depois de revogar o aplicativo no Mercado Pago | Apagados assim que recebemos o aviso do Mercado Pago |
| Resumo do código de acesso ao agendamento | Até 90 dias depois do fim da conta do negócio |
| Resumo técnico do pedido de agendamento (sem CPF) | Até 90 dias depois do fim da conta do negócio |
| Dados da conta, do negócio, dos agendamentos e dos Clientes finais | Até 90 dias depois do fim da conta. Os dados de pagamentos ficam até 5 anos |
| Registros de auditoria de pagamentos e devoluções | 5 anos |
| Registro do aceite da conexão com o Mercado Pago (inclui IP) | 5 anos |
| Dados de sessão (IP e navegador) | 6 meses |
| Registros de acesso à aplicação (Marco Civil da Internet, art. 15) | 6 meses |

Hoje não existe exclusão automática de contas. A exclusão é feita manualmente, a pedido (seção 10). Depois dos prazos definidos, os dados serão apagados ou anonimizados, salvo quando a lei permitir ou exigir a guarda.

## 9. Como protegemos os dados

Medidas que existem no código hoje:

- Tokens do Mercado Pago cifrados com AES-256-GCM e chave própria.
- Chaves Pix antigas guardadas cifradas e inativas.
- Código e link de acesso guardados só como hash, válidos por 30 minutos, com no máximo 3 tentativas por código.
- Limite de 5 envios de código por hora por e-mail. Também há limite por IP (20 por hora no envio de códigos) e limites no agendamento e no cadastro, aplicados quando o IP vem de uma fonte confiável, conforme a configuração do servidor.
- IP e e-mail usados nos controles antiabuso guardados só como hash com chave secreta.
- Acesso a cada agendamento por um código individual; no servidor fica só um resumo dele.
- Cookies técnicos com a opção HttpOnly (não são lidos por scripts da página) e SameSite=Lax.
- Cabeçalhos de segurança: política de segurança de conteúdo (CSP), HSTS em produção, proteção contra exibição em frames e bloqueio de câmera, microfone, localização e pagamento pelo navegador.
- Separação dos dados de cada negócio no banco de dados.
- Verificação de assinatura dos avisos (webhooks) do Mercado Pago.

Nenhum sistema é 100% seguro. Se houver um incidente de segurança que possa causar risco ou dano relevante, avisaremos os titulares afetados e a ANPD, conforme a LGPD.

## 10. Seus direitos

Pela LGPD (art. 18), você pode pedir:

- confirmação de que tratamos seus dados;
- acesso aos dados;
- correção de dados incompletos, inexatos ou desatualizados;
- anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desacordo com a lei;
- portabilidade, nos termos da regulamentação da ANPD;
- eliminação de dados tratados com base no consentimento;
- informação sobre com quem compartilhamos seus dados;
- informação sobre a possibilidade de não consentir e as consequências disso;
- revogação do consentimento;
- revisão de decisões tomadas apenas com base em tratamento automatizado (art. 20).

**Como pedir:** envie um e-mail para **francatorresmatheus@gmail.com** (ou mensagem no WhatsApp +55 14 99750-4655) com o seu pedido. Podemos pedir dados para confirmar a sua identidade. Responderemos em até 10 dias.

**Exclusão de conta:** hoje não há botão de exclusão no painel. A exclusão é feita manualmente, a pedido pelo e-mail acima, em até 10 dias. Alguns dados podem ser mantidos mesmo depois do pedido, quando a lei permitir ou exigir (por exemplo, registros de pagamentos e devoluções).

**Assinante:** pelo painel, você pode alterar os serviços, os horários e o WhatsApp de contato, e desconectar o Mercado Pago quando quiser. Para outras correções (como o nome do negócio ou o e-mail), fale com a gente.

## 11. Cookies e armazenamento no navegador

Usamos apenas recursos **necessários** ao funcionamento. Não usamos cookies de publicidade nem de análise.

**Cookies**

| Nome | Para quê | Duração |
|---|---|---|
| `__Secure-better-auth.session_token` (sessão do Assinante; padrão da biblioteca Better Auth) | Manter o Assinante conectado. HttpOnly, SameSite=Lax | 7 dias |
| `onb_draft` | Lembrar o rascunho do cadastro no servidor. HttpOnly, Secure, SameSite=Lax | 7 dias |
| `mp_oauth` | Proteger a conexão com o Mercado Pago enquanto você está no site dele. HttpOnly, SameSite=Lax | 10 minutos; apagado na volta |

**Armazenamento local (localStorage), que fica no navegador até ser apagado**

| Chave | Conteúdo e finalidade |
|---|---|
| `agenda_onboarding_draft` | Rascunho do cadastro, **incluindo o e-mail**, o nome do negócio, o link, o serviço e os horários, para não perder o que já foi preenchido |
| `agenda_onboarding_step`, `agenda_onboarding_draft_id` | Etapa atual do cadastro e identificador do rascunho no servidor |
| `agenda_onboarding_idempotency_key` | Código técnico que evita criar o negócio duas vezes |
| `agenda_completed_onboarding_setup` | Dados de cadastro gravados por versões anteriores do produto. O código atual só lê e apaga essa chave |
| Preferência de tema | Aparência clara ou escura escolhida |
| `agendapix.mp.banner.<negócio>.<aviso>` | Esconder um aviso do painel por 24 horas |

**Armazenamento da aba (sessionStorage), apagado ao fechar a aba**

| Chave | Conteúdo e finalidade |
|---|---|
| `booking_session_<negócio>` | Permitir que o Cliente final retome o pagamento se recarregar a página: só o identificador do agendamento, o código de acesso, o serviço e o prazo do Pix. Sem nome, WhatsApp ou CPF. Também é apagado quando o Cliente final recomeça o agendamento ou reabre a página depois do prazo |
| `agendapix.mp.callback` | Resultado da volta do Mercado Pago (conectado ou erro), para mostrar a mensagem certa |
| `agenda_onboarding_commit` | Resultado da criação do negócio no fim do cadastro |
| `agendapix-subscription-pending:<negócio>` | Marcar que há um pedido de assinatura em andamento, para avisar quando for ativado |

Você pode apagar esses dados nas configurações do navegador, mas partes do serviço podem deixar de funcionar.

## 12. Crianças e adolescentes

O AgendaPix é destinado a donos de negócio maiores de 18 anos. O formulário de agendamento não pergunta a idade do Cliente final. Se um agendamento for feito para ou por menor de idade, o negócio é responsável por observar o art. 14 da LGPD e o melhor interesse da criança ou do adolescente.

## 13. Mudanças nesta Política

Podemos atualizar esta Política. A data da última atualização fica no topo. Mudanças relevantes serão avisadas aos Assinantes pelo e-mail da conta.

## 14. Onde encontrar esta Política



## 15. Autoridade Nacional de Proteção de Dados (ANPD)

Se você entender que seus direitos não foram atendidos, pode procurar a ANPD (www.gov.br/anpd). Pedimos que antes fale com a gente pelo e-mail francatorresmatheus@gmail.com, para tentarmos resolver.
