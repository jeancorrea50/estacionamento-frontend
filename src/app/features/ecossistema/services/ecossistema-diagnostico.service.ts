import { Injectable, inject } from '@angular/core';
import { Observable, from, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ECOSSISTEMA_ARESTAS, ECOSSISTEMA_NOS } from '../data/ecossistema-mapa.data';
import { ECOSSISTEMA_FLUXOS_DIAGNOSTICO } from '../data/ecossistema-fluxos-diagnostico.data';
import type {
  DiagnosticoAchado,
  DiagnosticoProbeResultado,
  DiagnosticoRelatorio,
  DiagnosticoSeveridade,
} from '../models/ecossistema-diagnostico.models';
import type { EcossistemaNo, EvidenciaStatus } from '../models/ecossistema.models';

interface ProbeDef {
  id: string;
  label: string;
  path: string;
  noId?: string;
}

const PROBES: ProbeDef[] = [
  {
    id: 'probe-estacionamento',
    label: 'API Estacionamento',
    path: '/Estacionamento?NumeroPagina=1&TamanhoPagina=1',
    noId: 'plt-estacionamentos',
  },
  {
    id: 'probe-entrada',
    label: 'API EntradaSaida',
    path: '/EntradaSaida?NumeroPagina=1&TamanhoPagina=1',
    noId: 'est-entrada',
  },
  {
    id: 'probe-movimento',
    label: 'API Movimento',
    path: '/Movimento?NumeroPagina=1&TamanhoPagina=1',
    noId: 'est-portaria',
  },
  {
    id: 'probe-convite',
    label: 'API ConviteTransportadora',
    path: '/ConviteTransportadora?NumeroPagina=1&TamanhoPagina=1',
    noId: 'trn-convites',
  },
  {
    id: 'probe-fatura',
    label: 'API Fatura',
    path: '/financeiro/Fatura?NumeroPagina=1&TamanhoPagina=1',
    noId: 'est-faturamento',
  },
  {
    id: 'probe-menu',
    label: 'API Menu (ACL)',
    path: '/auth/Menu/Buscar',
    noId: 'plt-menu',
  },
];

const SEV_ORDER: Record<DiagnosticoSeveridade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

/**
 * Varre o mapa do ecossistema + probes HTTP leves para apontar fluxos vagos,
 * falhas de conexão/backend e gaps de regra/FE.
 */
@Injectable({ providedIn: 'root' })
export class EcossistemaDiagnosticoService {
  private readonly auth = inject(AuthService);

  executar(): Observable<DiagnosticoRelatorio> {
    const achadosMapa = this.analisarMapaEFluxos();
    const sessao = this.analisarSessao();

    return this.executarProbes().pipe(
      map((probes) => {
        const achadosProbe = this.achadosDosProbes(probes);
        const achados = [...sessao, ...achadosMapa, ...achadosProbe].sort(
          (a, b) => SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade]
        );
        const fluxos = this.montarFluxos(achados);
        return {
          geradoEm: new Date().toISOString(),
          resumo: {
            criticos: achados.filter((x) => x.severidade === 'critica').length,
            altos: achados.filter((x) => x.severidade === 'alta').length,
            medios: achados.filter((x) => x.severidade === 'media').length,
            baixos: achados.filter((x) => x.severidade === 'baixa').length,
            probesOk: probes.filter((p) => p.status === 'ok').length,
            probesFalha: probes.filter((p) => p.status === 'falha').length,
            fluxosSaudaveis: fluxos.filter((f) => f.saudavel).length,
            fluxosComRisco: fluxos.filter((f) => !f.saudavel).length,
          },
          achados,
          probes,
          fluxos,
        };
      })
    );
  }

  private analisarSessao(): DiagnosticoAchado[] {
    const out: DiagnosticoAchado[] = [];
    if (!this.auth.isLoggedIn()) {
      out.push({
        id: 'sessao-sem-login',
        severidade: 'critica',
        categoria: 'sessao',
        titulo: 'Sessão sem login',
        descricao: 'Não há usuário autenticado. Probes de API autenticadas falharão ou retornarão 401.',
        acaoSugerida: 'Faça login e selecione o pátio (Admin/Transportadora) antes de reavaliar.',
      });
      return out;
    }
    if (this.auth.needsEstacionamentoSelection()) {
      out.push({
        id: 'sessao-sem-patio',
        severidade: 'alta',
        categoria: 'sessao',
        titulo: 'Pátio da sessão não selecionado',
        descricao:
          'Admin/Transportadora sem estacionamento de sessão. Operação do pátio, movimentações e parte do financeiro ficam bloqueadas ou vazias.',
        noId: 'plt-estacionamentos',
        fluxoId: 'operacao-patio',
        acaoSugerida: 'Use “Selecionar pátio” / “Trocar pátio” no topbar e rode o diagnóstico de novo.',
      });
    }
    return out;
  }

  private analisarMapaEFluxos(): DiagnosticoAchado[] {
    const byId = new Map(ECOSSISTEMA_NOS.map((n) => [n.id, n]));
    const out: DiagnosticoAchado[] = [];

    for (const n of ECOSSISTEMA_NOS) {
      if (n.evidencia === 'proposto') {
        out.push(this.achadoNo(n, 'alta', 'fluxo_vago', 'Módulo proposto (sem implementação completa)'));
      } else if (n.evidencia === 'nao_verificado') {
        out.push(this.achadoNo(n, 'media', 'fluxo_vago', 'Vínculo/regra não verificada no código'));
      } else if (n.evidencia === 'parcial') {
        out.push(this.achadoNo(n, 'media', 'frontend', 'Implementação parcial'));
      }
      for (const p of n.pendencias) {
        out.push({
          id: `pend-${n.id}-${hash(p)}`,
          severidade: n.evidencia === 'proposto' ? 'alta' : 'media',
          categoria: 'regra_negocio',
          titulo: `Pendência: ${n.label}`,
          descricao: p,
          noId: n.id,
          acaoSugerida: 'Validar no backend/Swagger e atualizar evidência do nó quando resolvido.',
        });
      }
      if (!n.rota && n.evidencia !== 'proposto') {
        out.push({
          id: `rota-${n.id}`,
          severidade: 'baixa',
          categoria: 'frontend',
          titulo: `${n.label} sem rota SPA`,
          descricao: 'Não há tela dedicada no menu; o conceito pode existir só como integração/worker.',
          noId: n.id,
          acaoSugerida: 'Confirmar se deve existir tela ou permanecer como serviço interno.',
        });
      }
    }

    for (const e of ECOSSISTEMA_ARESTAS) {
      if (e.evidencia === 'proposto' || e.evidencia === 'nao_verificado') {
        const from = byId.get(e.from)?.label ?? e.from;
        const to = byId.get(e.to)?.label ?? e.to;
        out.push({
          id: `aresta-${e.id}`,
          severidade: e.evidencia === 'proposto' ? 'alta' : 'media',
          categoria: 'fluxo_vago',
          titulo: `Vínculo frágil: ${from} → ${to}`,
          descricao: `Relação “${e.label}” marcada como ${e.evidencia}. Pode gerar expectativa operacional sem suporte real.`,
          arestaId: e.id,
          noId: e.to,
          acaoSugerida: 'Confirmar no backend se o evento/consulta existe; senão, remover do fluxo operacional.',
        });
      }
    }

    for (const fluxo of ECOSSISTEMA_FLUXOS_DIAGNOSTICO) {
      const nos = fluxo.etapas.map((id) => byId.get(id)).filter(Boolean) as EcossistemaNo[];
      const fracos = nos.filter((n) => n.evidencia !== 'identificado');
      if (!fracos.length) continue;
      const sev: DiagnosticoSeveridade = fluxo.exigeEvidenciaForte
        ? fracos.some((n) => n.evidencia === 'proposto')
          ? 'alta'
          : 'media'
        : 'baixa';
      out.push({
        id: `fluxo-${fluxo.id}`,
        severidade: sev,
        categoria: 'fluxo_vago',
        titulo: `Fluxo com etapas frágeis: ${fluxo.nome}`,
        descricao: `Etapas com evidência incompleta: ${fracos.map((n) => `${n.label} (${n.evidencia})`).join(', ')}.`,
        fluxoId: fluxo.id,
        noId: fracos[0]?.id,
        acaoSugerida: 'Priorize validar as etapas listadas antes de operar esse fluxo em produção.',
      });
    }

    return out;
  }

  private achadoNo(
    n: EcossistemaNo,
    severidade: DiagnosticoSeveridade,
    categoria: DiagnosticoAchado['categoria'],
    tituloPrefix: string
  ): DiagnosticoAchado {
    return {
      id: `no-${n.id}-${n.evidencia}`,
      severidade,
      categoria,
      titulo: `${tituloPrefix}: ${n.label}`,
      descricao: n.evidenciaDetalhe || EVIDENCIA_HINT[n.evidencia],
      noId: n.id,
      acaoSugerida:
        n.pendencias[0] ??
        'Abrir o módulo no mapa, revisar contrato Swagger e atualizar a evidência quando fechado.',
    };
  }

  /**
   * Probes via `fetch` (não passam pelo errorInterceptor) para evitar toast spam
   * e logout automático em 401 durante o diagnóstico.
   */
  private executarProbes(): Observable<DiagnosticoProbeResultado[]> {
    if (!this.auth.isLoggedIn()) {
      return of(
        PROBES.map((p) => ({
          id: p.id,
          label: p.label,
          status: 'pulado' as const,
          httpStatus: null,
          mensagem: 'Pulado — sem login.',
          noId: p.noId,
        }))
      );
    }

    const token = this.auth.getAccessToken();
    const calls = PROBES.map((p) =>
      from(this.probeFetch(p, token)).pipe(catchError(() => of(this.probeFalhaRede(p))))
    );
    return forkJoin(calls);
  }

  private async probeFetch(
    p: ProbeDef,
    token: string | null
  ): Promise<DiagnosticoProbeResultado> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const estacId = this.auth.resolveEstacionamentoId();
      if (estacId) headers['X-Empresa-Id'] = String(estacId);

      const res = await fetch(`${environment.API_BASE_URL}${p.path}`, {
        method: 'GET',
        headers,
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
      return this.mapProbeStatus(p, res.status);
    } catch {
      return this.probeFalhaRede(p);
    } finally {
      clearTimeout(timer);
    }
  }

  private probeFalhaRede(p: ProbeDef): DiagnosticoProbeResultado {
    return {
      id: p.id,
      label: p.label,
      status: 'falha',
      httpStatus: 0,
      mensagem:
        'Sem resposta (rede/proxy/SSL/timeout). Confira ng serve + proxy.conf.json e se o backend está no ar.',
      noId: p.noId,
    };
  }

  private mapProbeStatus(p: ProbeDef, status: number): DiagnosticoProbeResultado {
    if (status >= 200 && status < 300) {
      return {
        id: p.id,
        label: p.label,
        status: 'ok',
        httpStatus: status,
        mensagem: `Resposta HTTP ${status} — endpoint alcançável.`,
        noId: p.noId,
      };
    }
    if (status === 401 || status === 403) {
      return {
        id: p.id,
        label: p.label,
        status: 'aviso',
        httpStatus: status,
        mensagem: `HTTP ${status} — API no ar, mas sem permissão/token/pátio adequado para este recurso.`,
        noId: p.noId,
      };
    }
    if (status === 404) {
      return {
        id: p.id,
        label: p.label,
        status: 'falha',
        httpStatus: status,
        mensagem: 'HTTP 404 — rota ausente no backend publicado (ou path divergente do front).',
        noId: p.noId,
      };
    }
    if (status === 405) {
      return {
        id: p.id,
        label: p.label,
        status: 'falha',
        httpStatus: status,
        mensagem: 'HTTP 405 — método não permitido (contrato FE/BE desalinhado).',
        noId: p.noId,
      };
    }
    if (status >= 500) {
      return {
        id: p.id,
        label: p.label,
        status: 'falha',
        httpStatus: status,
        mensagem: `HTTP ${status} — erro no servidor/worker.`,
        noId: p.noId,
      };
    }
    return {
      id: p.id,
      label: p.label,
      status: 'aviso',
      httpStatus: status,
      mensagem: `HTTP ${status} — resposta inesperada; revise payload/query.`,
      noId: p.noId,
    };
  }

  private achadosDosProbes(probes: DiagnosticoProbeResultado[]): DiagnosticoAchado[] {
    return probes
      .filter((p) => p.status === 'falha' || p.status === 'aviso')
      .map((p) => ({
        id: `probe-achado-${p.id}`,
        severidade: (p.status === 'falha'
          ? p.httpStatus === 0 || (p.httpStatus ?? 0) >= 500
            ? 'critica'
            : 'alta'
          : 'media') as DiagnosticoSeveridade,
        categoria: (p.httpStatus === 0 ? 'conexao' : 'backend') as DiagnosticoAchado['categoria'],
        titulo: `${p.label}: ${p.status === 'falha' ? 'falha' : 'aviso'}`,
        descricao: p.mensagem,
        noId: p.noId,
        acaoSugerida:
          p.httpStatus === 0
            ? 'Validar proxy → gtsistema.com / VPS e conectividade.'
            : 'Comparar path/método com Swagger e permissões do perfil logado.',
      }));
  }

  private montarFluxos(achados: DiagnosticoAchado[]) {
    const byId = new Map(ECOSSISTEMA_NOS.map((n) => [n.id, n]));
    return ECOSSISTEMA_FLUXOS_DIAGNOSTICO.map((f) => {
      const relacionados = achados.filter(
        (a) => a.fluxoId === f.id || (a.noId != null && f.etapas.includes(a.noId))
      );
      const labels = f.etapas.map((id) => byId.get(id)?.label ?? id);
      const saudavel = !relacionados.some(
        (a) => a.severidade === 'critica' || a.severidade === 'alta'
      );
      return {
        id: f.id,
        nome: f.nome,
        etapas: labels,
        saudavel,
        resumo: saudavel
          ? 'Sem achados críticos/altos nas etapas deste fluxo.'
          : `${relacionados.filter((a) => a.severidade === 'critica' || a.severidade === 'alta').length} achado(s) crítico/alto neste fluxo.`,
        achadosIds: relacionados.map((a) => a.id),
      };
    });
  }
}

const EVIDENCIA_HINT: Record<EvidenciaStatus, string> = {
  identificado: 'Evidência completa no código/Swagger.',
  parcial: 'Parte do fluxo existe; faltam telas, APIs ou regras.',
  proposto: 'Conceito operacional sem implementação comprovada.',
  nao_verificado: 'Hipótese ainda não confirmada no código.',
};

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
