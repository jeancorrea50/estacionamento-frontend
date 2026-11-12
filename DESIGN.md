---
name: GTS Estacionamento
description: UI operacional grafite com azul de ação — pátio, cobrança e cadastros.
colors:
  primary: "#3d8bff"
  primary-hover: "#5a9dff"
  primary-deep: "#2563eb"
  sidebar-blue: "#0a3890"
  success: "#36c98f"
  danger: "#f06468"
  warning: "#e8a23a"
  bg-main: "#181821"
  bg-content: "#1d1d27"
  surface: "#292934"
  surface-elevated: "#2c2c37"
  table: "#252530"
  border: "#363642"
  input: "#23232d"
  text: "#f1f1f5"
  text-muted: "#92929f"
  light-bg: "#f5f7fa"
  light-card: "#ffffff"
  light-text: "#1f2937"
typography:
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  btn: "8px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
  button-secondary:
    backgroundColor: "#334155"
    textColor: "#f8fafc"
    rounded: "{rounded.btn}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "#b91c1c"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  kpi-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  status-pill:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "999px"
    padding: "2px 8px"
---

# Design System: GTS Estacionamento

## Overview

**Creative North Star: "Torre de Controle do Pátio"**

*(Nome e voz qualitativa inferidos do código + PRODUCT.md — confirme se quiser outro norte.)*

A interface é um console operacional: densidades compactas, contraste alto no tema escuro e azul de ação discreto. O brand aparece em precisão (tabelas legíveis, badges de status, botões sem glow), não em ornamentação. Superfícies flat em grafite; profundidade vem de camadas tonais e bordas sutis, não de neon.

Há tema claro (`html.theme-light`) para cadastros/admin, mas o mundo dominante das telas de pátio/movimentos é o dark premium em `dark-theme.css`. Novas telas operacionais devem herdar esse mundo; redesign amplo só com pedido explícito.

**Key Characteristics:**
- Grafite + azul de destaque (`#3d8bff` / `#2563eb`), sem purple glow
- Inter como família única; hierarquia por peso e tamanho, não por display serif
- Cards e KPIs com raio 10–12px; botões ~8px
- Status e cobertura como pills com borda colorida, não como o único sinal visual da linha
- Densidade de tabela operacional (padding ~12px, tipografia 12–14px)

## Colors

Paleta operacional: neutros frios de grafite para superfícies; azul como única voz de ação; verde/âmbar/vermelho para estados semânticos.

### Primary
- **Action Blue** (`#3d8bff` / hover `#5a9dff`): links, foco, chips ativos, botão primário no dark; no light o primário canônico é `#2563eb`.
- **Sidebar Navy** (`#0a3890`): navegação lateral no tema claro / identidade de chrome.

### Secondary
Omitido como segunda marca; status usam semantic tokens abaixo.

### Tertiary
Omitido.

### Neutral
- **Graphite Main** (`#181821`): fundo da app no dark.
- **Graphite Content** (`#1d1d27`): área de conteúdo / topbar dark.
- **Card Surface** (`#292934`) e **Elevated** (`#2c2c37`): cards, KPIs, painéis.
- **Table Bed** (`#252530`) / header (`#30303c`): grades.
- **Border Graphite** (`#363642`): divisórias e inputs.
- **Snow Text** (`#f1f1f5`) / **Muted Fog** (`#92929f`): texto e labels.
- **Light Paper** (`#f5f7fa`) / **White Card** (`#ffffff`) / **Ink** (`#1f2937`): tema claro.

### Semantic
- **Success Mint** (`#36c98f`): no pátio / positivo.
- **Warning Amber** (`#e8a23a`): suspenso / atenção / excedente.
- **Danger Coral** (`#f06468`): saída destrutiva / erro.

### Named Rules
**The One Blue Voice Rule.** Azul de ação é o único accent de marca. Não introduzir purple/violet gradients nem glow ciano.

**The Status Is Not the Row Rule.** Excedente/cobertura usam badge (e, se houver, faixa lateral discreta) — não tingir a linha inteira de âmbar.

## Typography

**Display Font:** Inter (com system-ui / Segoe UI / Roboto)
**Body Font:** Inter (mesmo stack)
**Label/Mono Font:** Inter; placas usam `tabular-nums` e peso 700

**Character:** Utilitária e densa. Sem serif de display; hierarquia só por tamanho/peso.

### Hierarchy
- **Title** (600, 18px): títulos de página / hero portaria.
- **Section** (600, 16px): cabeçalhos de card e seções de formulário.
- **Body** (400, 14px): conteúdo e células de tabela.
- **Label / Caption** (600, 12px): labels de KPI, cabeçalhos de tabela, pills.

### Named Rules
**The Single Family Rule.** Uma família (Inter) em todo o produto; não misturar display serif em telas operacionais.

## Layout

Espaçamento em escala `--space-xs`…`--space-2xl` (4–24px). Grids de KPI com `auto-fit` / colunas fixas e gap 12px. Portaria: coluna principal + painel de câmeras sticky. Tabelas com scroll horizontal em viewports estreitos; `min-width` na grade para não esmagar ações. Densidade compacta: botões sm ~34px, primários ~40px.

## Elevation & Depth

Sistema predominantemente **flat com camadas tonais**. Shadows existem (`0 8px 24px rgba(0,0,0,0.18)`) em cards dark, mas sem glow. Topbar dark sem sombra ostensiva (`--topbar-shadow: none`).

### Shadow Vocabulary
- **Card ambient** (`0 8px 24px rgba(0, 0, 0, 0.18)`): cards e KPIs no dark.
- **Button rest** (`0 1px 2px rgba(0, 0, 0, 0.22)`): botões preenchidos.
- **Button hover** (`0 2px 6px rgba(0, 0, 0, 0.28)`): elevação leve ao hover.

### Named Rules
**The No-Neon Rule.** Proibido glow / filter neon em botões e cards; comentário explícito no CSS dark.

## Shapes

Cantos suaves e consistentes: botão 8px; card/KPI 12px; pills `999px` para status. Bordas 1px em `border` / `border-subtle`. Inputs com fundo `#23232d` e borda grafite no dark.

## Components

### Buttons
- **Shape:** raio 8px (`--btn-radius`)
- **Primary:** azul `#2563eb` / `#3d8bff` dark, texto branco, altura 40px; hover sem glow
- **Secondary:** slate `#334155`, texto `#f8fafc`
- **Danger / Warning / Success:** tokens `--btn-danger-*`, `--btn-warning-*`, `--btn-success-*`
- **Small:** `.btn--sm` altura 34px, padding horizontal ~0.85rem — padrão em tabelas de ações

### Chips / Status pills
- **Style:** pill com fundo translúcido da cor semântica + borda 1px; tipografia 11–12px / 600
- **Roles:** patio verde, acordo azul, excedente âmbar, suspenso âmbar, saída cinza

### Cards / Containers / KPIs
- **Corner:** 12px
- **Background:** `#292934` dark
- **Border:** `#363642`
- **KPI:** label muted 12px + valor 1.35rem bold; opcional sparkline e variação “vs. ontem”

### Inputs / Fields
- **Style:** fundo input dark `#23232d`, borda `#363642`, texto `#f1f1f5`
- **Focus:** anel via `--focus-ring` com azul primário
- **Placeholder:** `#72727e`

### Navigation
- Sidebar azul navy no light (`#0a3890`); no dark, superfície `#292936` com hover `#323240`
- Itens ativos por fundo hover-strong, tipografia clara

### Tables
- Cabeçalho muted, fundo header dark `#30303c`
- Linhas zebradas / hover `#323240`
- Placas em branco/negrito; coluna de ações com botão primário + secundário + menu overflow

## Do's and Don'ts

### Do:
- **Do** reutilizar tokens `--dark-*`, `--btn-*`, `--radius-*`, `--space-*` de `styles.css` / `dark-theme.css`.
- **Do** manter badges de status/cobertura distintos (situação ≠ avulso ≠ faturado ≠ excedente).
- **Do** preferir densidade operacional e contraste alto no dark.
- **Do** alinhar novos componentes a botões `.btn` / `.btn-primary` existentes.

### Don't:
- **Don't** introduzir purple gradients, glassmorphism neon ou tipografia display serif em telas de pátio.
- **Don't** tingir a linha inteira de excedente; use badge e, se necessário, faixa lateral.
- **Don't** inventar cores/hex fora dos tokens sem atualizar este arquivo e o CSS global.
- **Don't** redesenhar o chrome (sidebar/topbar) em uma feature isolada sem pedido explícito.
