# Proposta de Unificação: Login Canônico Oficial (F-02)

- **De**: Trilha (T5 — Product / Conversion Designer)
- **Para**: CODEXADO (T2 — Dashboard) / Hermes (Coordenação)
- **Data**: 2026-10-04

---

## 1. Problema Identificado

O painel do dono (`agenda-dashboard`) serve login em `/dashboard/login` utilizando uma interface crua e desatualizada (`components/dashboard/login-form.tsx`), com botão azul bebê (#93c5fd) e fundo slate (#0f172a), desalinhada com a identidade visual e tokens da marca.

## 2. Solução Fornecida por T5

O componente oficial `LoginForm` foi extraído e preparado para reuso universal:
- **Localização**: `components/auth/LoginForm.tsx`
- **Design Tokens**:
  - Botão de submit: `bg-primary hover:bg-primary-hover text-primary-foreground min-h-12 rounded-full font-semibold` com feedback tátil de 120ms (`active:scale-[0.98] motion-reduce:transform-none`).
  - Input: `min-h-12 border-border bg-surface text-foreground` com feedback de foco de alto contraste (`focus-visible:outline-primary`).
  - Alvos de toque: todos os links e botões possuem altura mínima >= 44px (`min-h-11` ou `min-h-12`), sem corte em 320px/375px.
  - Acessibilidade: `role="alert"` em mensagens de erro com `transition-all duration-180 ease-out`, labels explícitos e `autoComplete="email"`.
  - Dark / Light Mode nativo com tokens de superfície e contraste AA.
  - Integridade: tratamento real de erro de infraestrutura/rede (sem sucesso falso fora de rotas preview).

## 3. Instruções de Integração em `agenda-dashboard`

Para unificar `/dashboard/login` com o design oficial:

1. **Substituição**:
   Substituir o JSX de `agenda-dashboard/components/dashboard/login-form.tsx` pelo padrão exportado em `components/auth/LoginForm.tsx` (ou importar diretamente caso haja compartilhamento de componentes).
2. **Parâmetros Suportados**:
   ```tsx
   <LoginForm
     title="Entrar no seu Painel"
     subtitle="Digite seu e-mail profissional para acessar sua agenda e clientes."
     callbackURL="/dashboard"
     showCreateAccountLink={false} // no painel pode ocultar ou manter link de onboarding
   />
   ```
3. **Consumo de Auth**:
   O formulário utiliza `requestMagicLink` com envio via POST para `/api/auth/sign-in/magic-link`. Quando B-02 (autoridade de processo no backend :3000) for ativado, basta apontar `NEXT_PUBLIC_BACKEND_URL` sem alterar o componente visual.
