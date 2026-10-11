# DNS do e-mail transacional

O AgendaPix manda e-mail por SMTP (`nodemailer`). O código não verifica DKIM, SPF nem DMARC e não publica registro nenhum. Quem configura o DNS é o dono do domínio.

Há dois caminhos já documentados em [`deploy-vercel.md`](./deploy-vercel.md). Só um deles pede registro na Resend.

## O que o código envia

| Mensagem | Função | Destinatário |
| --- | --- | --- |
| Link de acesso | `sendMagicLinkEmail` | dono, no e-mail do login |
| Código de entrada / cadastro | `sendSignInCodeEmail` | dono, no e-mail do login |
| Avisos do dono (estorno atrasado, conta Mercado Pago, lembrete de devolução manual) | `sendOwnerEmail` | e-mail do dono |

Não há e-mail de confirmação de reserva para o cliente. Não há e-mail de fim de teste nem de cobrança da assinatura. A assinatura de R$ 49 continua manual (`pnpm billing:activate`).

Remetente: `SMTP_FROM`. Resposta: `SMTP_REPLY_TO`, se estiver preenchido. Vazio omite o Reply-To. Falha de SMTP no login responde erro e não finge sucesso. Falha num aviso que já não move dinheiro fica no log como `[mail] scope=... code=send_failed`, sem destinatário nem nome, e o próximo ciclo tenta de novo.

## Resend (`smtp.resend.com`)

Fonte: [Add and verify a domain](https://resend.com/docs/add-a-domain) e [Implementing DMARC](https://resend.com/docs/dashboard/domains/dmarc). Consultado em 11 de outubro de 2026.

1. No painel da Resend, em Domains, adicione um domínio seu. A Resend recomenda um subdomínio (por exemplo `avisos.seudominio.com.br`), não o domínio raiz.
2. Abra a aba Records desse domínio. Copie os registros de DKIM e SPF exatamente como a Resend gerou (TXT e MX, ou CNAME). Não invente o nome nem o valor: eles mudam por domínio.
3. Cole no DNS do provedor. Se o registro for CNAME, desligue o proxy (na Cloudflare, a nuvem laranja). Proxy impede a verificação.
4. Espere a verificação. Em geral leva até 15 minutos; a propagação pode chegar a 72 horas. A Resend indica o [dns.email](https://dns.email) para ver se o registro já está público.
5. `SMTP_FROM` precisa ser um endereço desse domínio verificado. `SMTP_USER` é `resend` e `SMTP_PASSWORD` é a API key.

DMARC é um passo separado, depois que o domínio já passou em SPF e DKIM. É um TXT em `_dmarc`. A Resend sugere começar em modo de observação e só então apertar a política. O exemplo oficial, com domínio e caixa de exemplo que você troca pelos seus:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `_dmarc.seudominio` | TXT | `v=DMARC1; p=none; rua=mailto:caixa-que-recebe-relatorio@seudominio;` |

`p=none` só observa. `p=quarantine` manda o que falha para o spam. `p=reject` recusa. A Resend pede para subir a política só depois de confirmar que o envio legítimo passa (`dmarc=pass` no cabeçalho). O `rua` é a caixa que recebe o relatório agregado.

## Gmail (`smtp.gmail.com`)

Se o SMTP for o Gmail, a mensagem sai pelos servidores do Google. Os registros da Resend não se aplicam. A autenticação é a da conta Google (senha de app, com 2FA), como já está em `deploy-vercel.md`. Não há registro DKIM/SPF deste repositório para colar nesse caminho.
