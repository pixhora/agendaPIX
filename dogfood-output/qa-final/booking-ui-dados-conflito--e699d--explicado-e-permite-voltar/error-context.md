# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-ui.spec.ts >> dados: conflito de horário é explicado e permite voltar
- Location: tests/qa/booking-ui.spec.ts:103:1

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: write EPIPE
```

```
Error: expect(locator).toBeVisible() failed

Locator:  getByRole('heading', { name: 'Escolha o horário' })
Expected: visible
Received: undefined

```

```
Error: browserContext._wrapApiCall: Target page, context or browser has been closed
```