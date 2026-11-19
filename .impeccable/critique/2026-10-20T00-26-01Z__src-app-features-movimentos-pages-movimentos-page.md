---
target: menu patio movimentos-page
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Alexsander\\Desktop\\GTSistema\\estacionamento-frontend\\src\\app\\features\\movimentos\\pages\\movimentos-page"
timestamp: 2026-10-20T00-26-01Z
slug: src-app-features-movimentos-pages-movimentos-page
---
Method: dual-agent (A: f6a8e3f2-794a-4856-a76c-7dac2184b074 · B: assessment-B detector)

# Critique — Telas do menu Pátio

Alvos: Entrada e Saída (`patio/entrada-saida`), Movimentações (`patio/movimentacoes`), Relatório (`patio/relatorio` / `movimentacao-relatorio`).
North Star: Torre de Controle do Pátio (grafite + action blue).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Monitor/portaria e grades ok; relatório depende de pós-busca |
| 2 | Match System / Real World | 4 | Vocabulário de pátio (entrada/saída, cobertura, excedente) |
| 3 | User Control and Freedom | 3 | Filtros avançados em modal; exportações recuperáveis |
| 4 | Consistency and Standards | 3 | Relatório ainda herda shell de faturamento; pills unificados após polish |
| 5 | Error Prevention | 4 | Bloqueios de placa, truncamento comunicado, guards |
| 6 | Recognition Rather Than Recall | 3 | Muitos filtros; chips ajudam em Movimentações |
| 7 | Flexibility and Efficiency | 4 | CTAs E/S, chips, sort, PDF primário |
| 8 | Aesthetic and Minimalist Design | 2 | Toolbar + 9 colunas + filtros densos no relatório |
| 9 | Error Recovery | 3 | Empty/loading ok; erros via toast/snack |
| 10 | Help and Documentation | 2 | Subtítulos e tip aside; pouco glossário de status |
| **Total** | | **31/40** | **Fair–Good (operacional)** |

## Design Specificity Verdict

**LLM assessment:** Portaria e Movimentações são fortemente “torre de controle”. Relatório ainda soa módulo admin/financeiro, mas ganhou pills/placa/tokens alinhados ao DESIGN.

**Deterministic scan (pós-polish):** `impeccable detect` exit **0** em movimentos-page e movimentacao-relatorio. Achados restantes são **advisory** (cores/radius/font-size fora do DESIGN.md). Warnings `side-tab` (border-left 3px) eliminados via `box-shadow: inset`. Browser/CDP não executado (sem `ng serve` / overlay).

**Visual overlays:** não disponíveis nesta corrida (scan estático).

## Overall Impression

O núcleo operacional (portaria + movimentações) está maduro; o relatório era o elo fraco visual e foi aproximado do restante do pátio. Maior oportunidade residual: reduzir densidade da toolbar/filtros sem perder poder operacional.

## What's Working

1. Layout portaria (main + câmeras sticky) e CTAs Entrada/Saída grandes.
2. Grade de Movimentações com pills, chips e aside de caso — regra “status ≠ wash da linha”.
3. Relatório com empty orientado, KPIs pós-busca e aviso de truncamento.

## Priority Issues (estado após polish da mesma sessão)

- **[P1] Coluna Ações overcrowded** — Registrar saída + Recibo + overflow competem em viewport médio. Fix: ação primária na linha; secundárias no aside. Suggested: `/impeccable quieter` ou `/impeccable layout`.
- **[P1] 11 filtros visíveis no Relatório** — sobrecarga antes do payoff. Fix: presets (hoje/mês) + painel avançado colapsável. Suggested: `/impeccable distill`.
- **[P1] CTAs verde/vermelho vs One Blue Voice** — deliberado para semântica E/S; documentar exceção ou migrar para tokens primary/destructive. Suggested: `/impeccable colorize` / `/impeccable document`.
- **[P2] Shell faturamento no Relatório** — `cfg-page-head` / shared list shell. Suggested: `/impeccable polish` focado em chrome compartilhado do pátio.
- **[P2] Progress de permanência no aside** — escala pouco óbvia. Suggested: `/impeccable clarify`.

### Resolvidos nesta sessão (eram P0/P1 do Assessment A)

- Monitor com rótulo textual (+ statusLabel do hub).
- Removido CTA “Ver todos” morto.
- `<h1>` Movimentações + remoção da KPI strip duplicada.
- Pills Status/Faturado/Avulso/Excedente + placa formatada no relatório.
- Tokens title/primary; side-tab → inset shadow; spark cores via CSS vars.

## Persona Red Flags

**Operador de portaria:** scroll até monitor; rótulos agora legíveis — reduzir ansiedade de cor-só.
**Operador de movimentações:** toolbar ainda densa; chips × buscar exigem modelo mental.
**Admin/Financeiro (relatório):** pills alinham linguagem; grid de filtros ainda assusta operador de pátio.

## Minor Observations

- Pill radius 999px e alguns hex muted (#94a3b8) ficam como advisory no detector.
- Sparks KPI usam `var(--*)` em atributos SVG — validar visualmente em browsers alvo.
- Tempo médio no pátio saiu da faixa de KPIs da operação (intencional); permanece calculado no TS.

## Questions to Consider

- A portaria deve ser 100% ação ou torre + BI leve (sparks)?
- Registrar saída deve ser a única ação primária na linha?
- Relatório deveria ser só export, sem preview tabular?
