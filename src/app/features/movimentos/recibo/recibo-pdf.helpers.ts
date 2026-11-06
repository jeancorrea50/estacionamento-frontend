import type { EnderecoDTO } from '../../cadastro/models/estacionamento.dto';
import { formatCnpj } from '../../cadastro/directives/cnpj-format.directive';
import { formatPlacaDisplay } from '../../cadastro/utils/placa-br';
import type { TipoTarifaEstacionamento } from '../models/entrada-saida.models';

/** Formato do PDF de referência térmica: `00h 05min`. */
export function formatarPermanenciaRecibo(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos)) return '—';
  const total = Math.max(0, Math.floor(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return `${String(horas).padStart(2, '0')}h ${String(resto).padStart(2, '0')}min`;
}

/** `26/10/2026 - 23:52` — alinhado ao PDF térmico de referência. */
export function formatarDataHoraRecibo(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  const hh = String(data.getHours()).padStart(2, '0');
  const mi = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} - ${hh}:${mi}`;
}

export function formatarMoedaRecibo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function formatarCnpjRecibo(cnpj: string | null | undefined): string | null {
  const raw = String(cnpj ?? '').replace(/\D/g, '');
  if (!raw) return null;
  return raw.length === 14 ? formatCnpj(raw) : String(cnpj).trim();
}

export function formatarPlacaRecibo(placa: string | null | undefined): string {
  return formatPlacaDisplay(placa) || String(placa ?? '').trim().toUpperCase() || '—';
}

/** Preferência: minutos da API; senão diferença entrada→saída (ou entrada→agora se aberto). */
export function calcularPermanenciaMinutos(opts: {
  tempoPermanenciaMinutos?: number | null;
  dataHoraEntrada?: string | null;
  dataHoraSaida?: string | null;
}): number | null {
  const api = opts.tempoPermanenciaMinutos;
  if (api != null && Number.isFinite(api)) return Math.max(0, Math.floor(api));
  if (!opts.dataHoraEntrada?.trim()) return null;
  const inicio = new Date(opts.dataHoraEntrada).getTime();
  if (!Number.isFinite(inicio)) return null;
  const fim = opts.dataHoraSaida?.trim()
    ? new Date(opts.dataHoraSaida).getTime()
    : Date.now();
  if (!Number.isFinite(fim)) return null;
  return Math.max(0, Math.floor((fim - inicio) / 60_000));
}

/**
 * Descrição de cobrança a partir do contrato `TipoTarifaEstacionamento`
 * (Hora=1, Diaria=2) — sem inventar texto de quitação.
 */
export function descricaoCobrancaRecibo(
  tipoTarifa: TipoTarifaEstacionamento | null | undefined
): string | null {
  if (tipoTarifa === 1) return 'Tarifa por hora';
  if (tipoTarifa === 2) return 'Tarifa por diária';
  return null;
}

/**
 * Modalidade de faturamento (contrato / regra de cobrança): não exibe valor no recibo.
 * Baseado em `tipoCobranca`, `avulso` e vínculo `acordoCobrancaId` do contrato da API.
 * Excedente costuma ser cobrado à parte — só omite valor se a API marcar Faturado.
 */
export function isModalidadeFaturamento(opts: {
  tipoCobranca?: string | null;
  avulso?: boolean | null;
  acordoCobrancaId?: number | null;
  ehExcedente?: boolean | null;
}): boolean {
  const tipo = String(opts.tipoCobranca ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (tipo === 'faturado' || tipo === 'faturamento') return true;
  if (opts.avulso === false) return true;
  // Excedente com cobrança avulsa: mantém valores no recibo.
  if (opts.ehExcedente === true) return false;
  if (
    opts.acordoCobrancaId != null &&
    Number.isFinite(opts.acordoCobrancaId) &&
    opts.acordoCobrancaId > 0 &&
    tipo !== 'avulso'
  ) {
    return true;
  }
  return false;
}

/** Cobertura do veículo no acordo: Excedente | Acordo — só quando a API indica. */
export function rotuloCoberturaRecibo(opts: {
  ehExcedente?: boolean | null;
  acordoCobrancaId?: number | null;
}): string | null {
  if (opts.ehExcedente === true) return 'Excedente';
  if (
    opts.acordoCobrancaId != null &&
    Number.isFinite(opts.acordoCobrancaId) &&
    opts.acordoCobrancaId > 0
  ) {
    return 'Acordo';
  }
  return null;
}

/** Minutos de suspensão só quando houve (> 0). */
export function minutosSuspensaoRecibo(
  tempoTotalSuspensaoMinutos: number | null | undefined
): number | null {
  if (tempoTotalSuspensaoMinutos == null || !Number.isFinite(tempoTotalSuspensaoMinutos)) {
    return null;
  }
  const total = Math.floor(tempoTotalSuspensaoMinutos);
  return total > 0 ? total : null;
}

export function escolherEnderecoPrincipal(
  enderecos: EnderecoDTO[] | null | undefined
): EnderecoDTO | null {
  if (!enderecos?.length) return null;
  return enderecos.find((e) => e.principal) ?? enderecos[0] ?? null;
}

export function montarLinhasEndereco(end: EnderecoDTO | null): {
  linha1: string | null;
  linha2: string | null;
} {
  if (!end) return { linha1: null, linha2: null };
  const logradouro = String(end.logradouro ?? '').trim();
  const numero = String(end.numero ?? '').trim();
  const bairro = String(end.bairro ?? '').trim();
  const cidade = String(end.cidade ?? '').trim();
  const estado = String(end.estado ?? '').trim();

  const linha1Parts = [logradouro, numero].filter(Boolean);
  const linha1 = linha1Parts.length ? linha1Parts.join(', ') : null;

  const cidadeUf = [cidade, estado].filter(Boolean).join('/');
  const linha2Parts = [bairro, cidadeUf].filter(Boolean);
  const linha2 = linha2Parts.length ? linha2Parts.join(' - ') : null;

  return { linha1, linha2 };
}
