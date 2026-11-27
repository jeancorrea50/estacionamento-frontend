import { ECOSSISTEMA_NOS } from '../data/ecossistema-mapa.data';
import { ECOSSISTEMA_FLUXOS_DIAGNOSTICO } from '../data/ecossistema-fluxos-diagnostico.data';
import type { EcossistemaProblemaInput, ProblemaCategoria } from '../models/ecossistema-problema.models';

/**
 * Gera passos de resolução (o que fazer para corrigir),
 * com base no texto do problema + módulo/fluxo — não dicas genéricas de diagnóstico.
 */
export function gerarSugestoesResolucao(
  input: Pick<EcossistemaProblemaInput, 'categoria' | 'noId' | 'fluxoId' | 'titulo' | 'descricao'>
): string[] {
  const no = ECOSSISTEMA_NOS.find((n) => n.id === input.noId);
  const fluxo = ECOSSISTEMA_FLUXOS_DIAGNOSTICO.find((f) => f.id === input.fluxoId);
  const texto = normalizar(`${input.titulo} ${input.descricao}`);
  const label = no?.label ?? 'o módulo';
  const rota = no?.rota;
  const apiHint = extrairApi(no?.regras ?? []);

  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };

  // --- Padrões do texto (prioridade: o que o usuário descreveu) ---
  if (
    match(texto, [
      /nao foi criado/,
      /nao tem (a )?tela/,
      /nao existe (a )?(tela|pagina|frontend|componente)/,
      /sem tela/,
      /criar frontend/,
      /frontend ainda/,
      /falta (a )?(tela|pagina|frontend|componente)/,
      /(tela|pagina|frontend).*(nao|falta|ausente|inexist)/,
    ])
  ) {
    push(`Criar a tela Angular de “${label}” (página + component + estilos).`);
    if (rota) {
      push(`Registrar a rota SPA “${rota}” no feature routes e no seed/menu correspondente.`);
    } else {
      push(`Definir rota SPA para “${label}” e liberar no menu (seed + permissão).`);
    }
    if (no?.permissionKey) {
      push(`Associar a claim/permissão “${no.permissionKey}” e validar no guard da rota.`);
    }
    if (apiHint) {
      push(`Integrar o service FE com ${apiHint} (mapper DTO ↔ UI).`);
    }
    push(`Atualizar evidência do módulo “${label}” no mapa após a tela existir.`);
  } else if (match(texto, [/rota/, /menu/, /nao abre/, /nao aparece/, /acesso negado/, /sem permiss/])) {
    push(`Garantir item de menu + rota para “${label}” no seed e no login-menus.`);
    if (rota) push(`Testar navegação direta para ${rota} com o perfil afetado.`);
    if (no?.permissionKey) {
      push(`Corrigir claim “${no.permissionKey}” no perfil/usuário que deveria acessar.`);
    }
  } else if (match(texto, [/api/, /endpoint/, /swagger/, /backend/, /404/, /405/, /500/, /dto/, /payload/])) {
    if (apiHint) {
      push(`Implementar ou corrigir no backend: ${apiHint}.`);
      push(`Alinhar contrato FE ↔ BE (path, método, DTO) com o Swagger publicado.`);
    } else {
      push(`Definir/implementar o endpoint necessário para “${label}” e publicar no Swagger.`);
      push(`Ajustar o service/mapper do frontend para o contrato real da API.`);
    }
    push('Validar com o mesmo JWT/EmpresaId da sessão que falha.');
  } else if (match(texto, [/regra/, /calculo/, /valor/, /cobranca/, /acordo/, /negocio/, /errado/, /nao calcula/])) {
    push(`Documentar o comportamento esperado de “${label}” com 1 caso concreto (entrada → saída).`);
    push('Corrigir a regra no backend (fonte da verdade) e só então ajustar a exibição no FE.');
    if (no?.regras[0]) {
      push(`Revisar a regra já mapeada: ${no.regras[0]}`);
    }
  } else if (match(texto, [/proxy/, /cors/, /status 0/, /rede/, /ssl/, /conexao/, /timeout/])) {
    push('Corrigir proxy.conf.json (target) e reiniciar o ng serve.');
    push('Confirmar URL/ambiente da API e certificados SSL no host alvo.');
  } else if (match(texto, [/sessao/, /patio/, /token/, /jwt/, /login/, /estacionamento/])) {
    push('Corrigir bootstrap de sessão: login → selecionar-estacionamento → claims.');
    push('Garantir EmpresaId/pátio no token antes das chamadas do módulo.');
  } else if (match(texto, [/signalr/, /hub/, /websocket/, /tempo real/, /notific/])) {
    push('Corrigir conexão do hub (URL, auth) e tratar queda 1011/502 no worker.');
    push('Validar inscrição nos eventos que “' + label + '” deveria receber.');
  } else if (match(texto, [/smtp/, /email/, /e-mail/, /convite.*nao/])) {
    push('Configurar SMTP/envio no backend e retestar o fluxo de convite.');
    push(`Validar criação/reenvio do registro ligado a “${label}”.`);
  } else if (match(texto, [/fluxo/, /processo/, /nao conecta/, /quebrado/, /etapa/])) {
    if (fluxo) {
      const etapas = fluxo.etapas
        .map((id) => ECOSSISTEMA_NOS.find((n) => n.id === id)?.label ?? id)
        .join(' → ');
      push(`Corrigir a quebra no fluxo “${fluxo.nome}”: ${etapas}.`);
      push('Implementar o vínculo (evento/API) entre a etapa que falha e a seguinte.');
    } else {
      push(`Mapear a etapa quebrada em “${label}” e implementar o vínculo com o módulo seguinte.`);
    }
  } else {
    // Fallback: resolução guiada pela categoria + módulo
    for (const s of resolucaoPorCategoria(input.categoria, label, rota, apiHint)) {
      push(s);
    }
  }

  // --- Complementos do módulo (sempre acionáveis) ---
  if (no?.pendencias.length) {
    push(`Resolver a pendência do mapa em “${label}”: ${no.pendencias[0]}`);
  }
  if (fluxo && !out.some((s) => s.includes(fluxo.nome))) {
    push(
      `Fechar o fluxo “${fluxo.nome}” após a correção: ${fluxo.etapas
        .map((id) => ECOSSISTEMA_NOS.find((n) => n.id === id)?.label ?? id)
        .join(' → ')}.`
    );
  }

  return out.slice(0, 6);
}

function resolucaoPorCategoria(
  cat: ProblemaCategoria,
  label: string,
  rota: string | null | undefined,
  apiHint: string | null
): string[] {
  switch (cat) {
    case 'frontend':
      return [
        `Implementar/corrigir a UI de “${label}”${rota ? ` em ${rota}` : ''}.`,
        apiHint
          ? `Ligar a tela ao backend via ${apiHint}.`
          : `Criar service/mapper FE para consumir a API de “${label}”.`,
        'Registrar rota + menu + permissão para o perfil que deve usar a tela.',
      ];
    case 'backend':
      return [
        apiHint
          ? `Corrigir/implementar ${apiHint} no backend.`
          : `Implementar a API necessária para “${label}”.`,
        'Alinhar DTO/status codes com o frontend e republicar Swagger.',
        'Cobrir o caso de falha com teste ou validação no worker/API.',
      ];
    case 'regra_negocio':
      return [
        `Definir e implementar a regra correta em “${label}” (backend como fonte).`,
        'Ajustar FE apenas para refletir o resultado já corrigido na API.',
        'Validar com um cenário real (placa/CNPJ/período) e marcar resolvido.',
      ];
    case 'fluxo_vago':
      return [
        `Definir o caminho ponta a ponta que passa por “${label}”.`,
        'Implementar as conexões faltantes (evento/API) entre as etapas.',
        'Atualizar o mapa do Ecossistema quando o fluxo estiver fechado.',
      ];
    case 'conexao':
      return [
        'Corrigir proxy/ambiente até a API responder 200 no endpoint do módulo.',
        'Remover causa de CORS/SSL/status 0 e retestar a ação na UI.',
      ];
    case 'sessao':
      return [
        'Corrigir seleção de pátio/claims para o perfil afetado.',
        `Retestar “${label}” com sessão válida (JWT + EmpresaId).`,
      ];
    default:
      return [
        `Implementar a correção necessária em “${label}” (FE, BE ou processo).`,
        'Validar o cenário descrito no problema e só então marcar como resolvido.',
      ];
  }
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function match(texto: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(texto));
}

function extrairApi(regras: string[]): string | null {
  for (const r of regras) {
    const m = r.match(/\/api\/[A-Za-z0-9._\-\/()+, ]+/);
    if (m) return m[0].trim();
  }
  return null;
}
