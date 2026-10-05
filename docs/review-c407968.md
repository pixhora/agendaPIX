# Revisão c407968 / fixture 1332daa

Resultado: OK no delta inspecionado. Produto não alterado.

- `lib/bookings/rate-limit.ts:17-29`: HMAC contextualizado por negócio; IP bruto não persistido. Headers ignorados sem opt-in. Upsert verifica limite e incrementa sob conflito da mesma chave, sem read-modify-write na aplicação. Limpeza repete predicado temporal no DELETE externo: atualização concorrente que renova janela não satisfaz o predicado após recheck da linha. Migration 0005 adiciona chave composta, CHECK 1..10 e índice; não altera reservas.
- `lib/bookings/service.ts:83-91`: contador fora da transação da reserva preserva tentativas recusadas. Replay consome limite conforme contrato; lock e chave/hash de idempotência permanecem.
- `lib/readiness.ts:6-11`, `lib/email.ts:18-22`, `app/api/ready/route.ts:6-8`: falhas convergem a resposta genérica 503; sucesso 200; SMTP usa verify e fecha transporte, sem sendMail. Não comprova entrega de email ou pagamento bancário.
- `scripts/create_backend_fixture.mjs:42-45`: gravação e fsync antecedem COMMIT. Arquivo exclusivo 0600; rollback/remove no caminho normal de falha. Não constitui transação atômica entre filesystem e PostgreSQL perante kill/crash; não foi alegada essa garantia.

Prova independente em snapshot `/tmp/agenda-review-c407968-final`, sem DB/email reais:

```
node node_modules/vitest/vitest.mjs run tests/unit/booking-rate-limit.test.ts tests/unit/readiness.test.ts tests/unit/http.test.ts
# 7/7, 3 arquivos, exit 0
node node_modules/vitest/vitest.mjs run tests/unit/reviewer-email.test.ts
# 2/2, exit 0
```

Teste adicional somente no snapshot mocka nodemailer: verify e close executados em sucesso/falha; sendMail nunca chamado. Provas DB/HTTP do autor foram informadas, não reexecutadas. Corrida específica limpeza/reset foi analisada pelo SQL, não reproduzida em PostgreSQL nesta revisão. Configuração proxy exige entrada sobrescrevendo X-Real-IP e acesso direto ao Next bloqueado, conforme contrato; ativação incorreta permite spoof. F01 permanece contrato sem endpoint, fora desta implementação. Sem gates gerais, migrations ou processos de terceiros executados.
