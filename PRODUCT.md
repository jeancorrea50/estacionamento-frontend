# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sistema multi-perfil do GTS Estacionamento (frontend Angular).

- **Operador de portaria / pátio:** registra entrada e saída, suspende/retorna permanência, acompanha monitoramento e KPIs do dia.
- **Admin do estacionamento:** cadastros (pátio, veículos, motoristas, transportadoras), configuração de cobrança/acordos, faturamento, relatórios e configurações (incl. fuso).
- **Transportadora:** opera no escopo do próprio vínculo (consulta de movimentos, recibos, dados autorizados), sem ações operacionais de pátio quando a permissão restringe.

*(Inferido do código de auth, menus, rotas `/app/patio`, `/app/faturamento` e regras de sessão com seleção de estacionamento.)*

## Product Purpose

Controlar a operação de entrada/saída no pátio e a cobrança associada (acordo, avulso, excedente), com isolamento por estacionamento e permissões por perfil — para que a operação e o financeiro usem a mesma verdade de movimentos.

Sucesso: registro operacional confiável, listagens e exportações alinhadas ao backend, e cobrança/faturamento sem inventar dados ou endpoints.

*(Inferido das features de movimentos, relatório de movimentações, configuração de cobrança e faturamento.)*

## Positioning

Produto operacional de pátio + financeiro integrado ao contrato real da API GTS (`/estac`), não um dashboard genérico: regras de status (entrada, saída, suspenso, agendado, cancelado), cobertura/acordo, excedente e faturado vêm do backend e devem ser respeitadas no front.

## Operating Context

- Sessão com seleção de estacionamento (admin/transportadora) e JWT / headers de escopo.
- Portaria: KPIs, câmeras, alertas, registro rápido, monitoramento em tempo quase real (SignalR + HTTP).
- Operação/histórico: filtros, chips (no pátio, suspensos, etc.), ações de saída/recibo/suspensão.
- Agendamentos, rede credenciada, cadastros e configuração de horário/fuso do pátio.
- Relatórios (PDF/Excel) e faturamento (faturas, recebimentos, config de cobrança).

## Capabilities and Constraints

**Confirmado / durável (código + regras do projeto):**

- Stack: Angular SPA (`gts-front-end`), integração via OpenAPI/Swagger em `gtsistema.com/estac`.
- Contrato da API é autoridade: não inventar campos, endpoints nem sucesso simulado.
- Permissões vindas dos menus/sessão; isolamento por estacionamento e transportadora.
- UI e cópia em pt-BR; preferir padrões e componentes já existentes.
- Tema operacional escuro já implementado nas telas de pátio/movimentos — redesign total só com pedido explícito.
- Dados simulados só em testes; não sobrescrever `.env` sem confirmação.

**Aberto / não decidido neste init:**

- Direção visual de marketing/landing (fora do escopo do app operacional atual).
- Preferência de workflow Impeccable `comp-first` vs `code-first` para superfícies novas (não gravada; telas de app seguem code-first).

## Brand Commitments

- Nome de produto/sistema: **GTSistemas** / GTS Estacionamento (título da app e rodapés de relatório).
- Voz: operacional, direta, em português do Brasil.

## Evidence on Hand

- Código-fonte em `src/app/features/` (movimentos, patio, financeiro, cadastro, agendamento, configurações).
- Regras Cursor em `.cursor/rules/` e skills internas do time.
- Geração tipada da API em `src/app/core/api/generated/`.
- Não fabricar depoimentos, métricas de marketing nem nomes de transportadora/pátio que não venham da API.

## Product Principles

1. **Contrato primeiro** — tela e exportação só mostram o que o backend entrega.
2. **Escopo e permissão** — nunca cruzar pátios ou perfis sem autorização.
3. **Operação legível** — densidade e clareza para portaria/admin acima de ornamentação.
4. **Preservar o existente** — evoluir UI reutilizando padrões; mudança visual ampla só sob pedido.
5. **pt-BR e regras de negócio explícitas** — status, cobertura, faturado e excedente não se misturam em um único rótulo ambíguo.

## Accessibility & Inclusion

Sem padrão WCAG formal documentado no produto; em melhorias de UI, manter contraste legível no tema escuro e alvos de clique utilizáveis (prática já seguida nas telas operacionais).
