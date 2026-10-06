# Marca vagatta

Ícone oficial: calendário cream + check mint em squircle charcoal.
Wordmark: **vagatta** (tudo minúsculo).

## Assets no repositório

| Caminho | Uso |
|---|---|
| `app/favicon.ico` | Aba do navegador (16/32) |
| `app/icon.png` | Metadata Next (192, transparente fora do squircle) |
| `app/apple-icon.png` | iOS home screen (180, charcoal opaco) |
| `public/brand/vagatta-icon.png` | UI (`BrandMark` / `next/image`) |
| `public/brand/icon-192.png` / `icon-512.png` | Manifest `any` |
| `public/brand/icon-*-maskable.png` | Manifest maskable (safe zone ~80%) |
| `app/manifest.ts` | Web app manifest (`name` / `short_name` = vagatta) |

Regenerar a partir da fonte (remove fundo preto em volta do squircle):

```bash
python3 scripts/generate-brand-icons.py /caminho/para/icon-square.png
```

**Não** usar este ícone no avatar do negócio do cliente (`BusinessAvatar` / página pública `/[slug]`).

## Pendências pós-domínio

Repo, `package.json`, env, URLs, remetente SMTP e docs internos ainda podem citar agendaPIX até o domínio vagatta estar no ar — ver corpo do PR #23.
