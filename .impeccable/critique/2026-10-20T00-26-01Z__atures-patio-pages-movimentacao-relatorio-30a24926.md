---
target: menu patio relatorio
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Alexsander\\Desktop\\GTSistema\\estacionamento-frontend\\src\\app\\features\\patio\\pages\\movimentacao-relatorio"
timestamp: 2026-10-20T00-26-01Z
slug: atures-patio-pages-movimentacao-relatorio-30a24926
---
Method: dual-agent (A: f6a8e3f2-794a-4856-a76c-7dac2184b074 · B: assessment-B detector)

# Critique — Relatório de Movimentações (pátio)

Alvo: `src/app/features/patio/pages/movimentacao-relatorio`
North Star: Torre de Controle do Pátio.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | loading / jaBuscou / truncamento |
| 2 | Match System / Real World | 3 | Campos corretos; Sim/Não agora em pills |
| 3 | User Control and Freedom | 4 | Limpar / buscar / export |
| 4 | Consistency and Standards | 3 | Shell faturamento vs pátio; pills alinhados |
| 5 | Error Prevention | 3 | Guard + truncamento |
| 6 | Recognition Rather Than Recall | 2 | 4 intervalos de data + booleans |
| 7 | Flexibility and Efficiency | 3 | PDF primário; faltam presets |
| 8 | Aesthetic and Minimalist Design | 2 | Grid 4×N antes do resultado |
| 9 | Error Recovery | 3 | Snackbar |
| 10 | Help and Documentation | 3 | Empty before-search |
| **Total** | | **30/40** | **Fair (export-first)** |

## Design Specificity Verdict

**LLM:** Média — chrome admin; conteúdo operacional melhorado com pills/placa/tokens.
**Detect:** exit 0; ~10 advisory (radius pill, muted hex, font sizes).
**Overlays:** não disponíveis.

## Overall Impression

Fluxo export sólido; hierarquia visual da grade melhorou. Oportunidade: colapsar filtros e unificar chrome com Movimentações.

## What's Working

1. Empty state orientado.
2. KPIs pós-busca.
3. Aviso de truncamento transparente.

## Priority Issues

- **[P1] Densidade de filtros (11 controles).** Suggested: `/impeccable distill`.
- **[P2] Shell cfg/faturamento.** Suggested: `/impeccable polish`.
- **[P2] Buscar visualmente igual a Limpar.** Suggested: `/impeccable clarify`.

### Resolvidos nesta sessão

- Pills de status/booleanos; placa tabular; tokens primary/title; warn com `--warning`; faixa excedente inset.

## Persona Red Flags

**Admin:** ok. **Operador:** filtros assustam. **Transportadora:** labels financeiros sem glossário.

## Minor Observations

- timeZoneId nas datas — alinhado a PRODUCT.
- Responsividade 1100/640 ok.

## Questions to Consider

- Só export sem preview?
- Unificar filtros com Movimentações (chips + painel)?
