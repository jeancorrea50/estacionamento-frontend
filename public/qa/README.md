# Artefatos de automação (somente leitura na Central de Qualidade)

A tela **Administração > Qualidade e Testes** **não executa** testes no navegador.
Ela apenas lê estes arquivos (se existirem):

- `vitest-summary.json`
- `playwright-summary.json`

## Formato

```json
{
  "ferramenta": "vitest",
  "geradoEm": "2026-10-26T23:00:00.000Z",
  "total": 2,
  "aprovados": 2,
  "falhos": 0,
  "porArquivo": {
    "src/app/features/cadastro/utils/placa-br.spec.ts": "aprovado"
  }
}
```

Status por arquivo: `aprovado` | `falhou` | `nao_executado`.

## Como gerar (exemplo)

1. Rodar `npm test` / `npx playwright test` no CI ou máquina local.
2. Converter o relatório da ferramenta para o JSON acima.
3. Copiar para `public/qa/` (ou publicar no deploy estático na pasta `/qa/`).

Arquivos placeholder neste diretório têm `geradoEm: null` e **não** marcam casos como aprovados.
