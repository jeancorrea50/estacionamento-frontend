export interface PontoMapa {
  id: number;
  codExportacao: string;
  descricao: string;
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
  ativo?: boolean | null;
  possuiSeguranca?: boolean | null;
  possuiBanheiro?: boolean | null;
  /** 1 = hora, 2 = diária. */
  tipoTarifaAvulsa?: 1 | 2 | null;
  valorAvulso?: number | null;
  minutosTolerancia?: number | null;
  /** HH:mm ou HH:mm:ss. */
  horarioAbertura?: string | null;
  horarioFechamento?: string | null;
  /** 1=segunda … 7=domingo, separados por vírgula. */
  diasFuncionamento?: string | null;
  timeZoneId?: string | null;
}

export interface DetalhePontoMapa {
  icone: string;
  texto: string;
  estado: 'ok' | 'ausente' | 'alerta';
}

/** Limites aproximados do território brasileiro, incluindo Fernando de Noronha. */
export const BRASIL_LAT_MIN = -33.9;
export const BRASIL_LAT_MAX = 5.5;
export const BRASIL_LNG_MIN = -74.2;
export const BRASIL_LNG_MAX = -32.2;

export function coordenadaNoBrasil(latitude: number, longitude: number): boolean {
  return (
    latitude >= BRASIL_LAT_MIN &&
    latitude <= BRASIL_LAT_MAX &&
    longitude >= BRASIL_LNG_MIN &&
    longitude <= BRASIL_LNG_MAX
  );
}

export function linkGoogleMaps(latitude: number, longitude: number): string {
  const lat = arredondarCoordenada(latitude);
  const lng = arredondarCoordenada(longitude);
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function arredondarCoordenada(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Ícones e textos do popup: cobrança, segurança, banheiro e status. */
export function detalhesPontoMapa(ponto: PontoMapa): DetalhePontoMapa[] {
  const tipo = ponto.tipoTarifaAvulsa === 1 || ponto.tipoTarifaAvulsa === 2 ? ponto.tipoTarifaAvulsa : null;
  const valor = ponto.valorAvulso != null && Number.isFinite(ponto.valorAvulso) ? MOEDA.format(ponto.valorAvulso) : null;
  const rotuloTipo = tipo === 1 ? 'Hora' : tipo === 2 ? 'Diária' : null;
  const tolerancia =
    ponto.minutosTolerancia != null && Number.isFinite(ponto.minutosTolerancia)
      ? ` · tolerância ${ponto.minutosTolerancia} min`
      : '';
  const cobranca = rotuloTipo
    ? `${rotuloTipo}${valor ? ` · ${valor}` : ''}${tolerancia}`
    : 'Sem cobrança avulsa';

  const detalhes: DetalhePontoMapa[] = [
    {
      icone: tipo === 1 ? 'schedule' : tipo === 2 ? 'calendar_month' : 'payments',
      texto: cobranca,
      estado: rotuloTipo ? 'ok' : 'ausente'
    },
    {
      icone: 'shield',
      texto: ponto.possuiSeguranca ? 'Com segurança' : 'Sem segurança',
      estado: ponto.possuiSeguranca ? 'ok' : 'ausente'
    },
    {
      icone: 'wc',
      texto: ponto.possuiBanheiro ? 'Com banheiro' : 'Sem banheiro',
      estado: ponto.possuiBanheiro ? 'ok' : 'ausente'
    },
    {
      icone: ponto.ativo === false ? 'cancel' : 'check_circle',
      texto: ponto.ativo === false ? 'Inativo' : 'Ativo',
      estado: ponto.ativo === false ? 'alerta' : 'ok'
    }
  ];
  const horario = textoHorarioFuncionamento(
    ponto.horarioAbertura,
    ponto.horarioFechamento,
    ponto.diasFuncionamento
  );
  if (horario) {
    detalhes.push({ icone: 'event_available', texto: horario, estado: 'ok' });
  }
  return detalhes;
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function textoHorarioFuncionamento(
  abertura?: string | null,
  fechamento?: string | null,
  dias?: string | null
): string | null {
  const inicio = horaCurta(abertura);
  const fim = horaCurta(fechamento);
  const rotulo = rotuloDias(dias);
  if (!inicio && !fim && !rotulo) return null;
  const faixa = inicio && fim ? `${inicio}–${fim}` : inicio || fim || '';
  return [rotulo, faixa].filter(Boolean).join(' · ');
}

function horaCurta(valor?: string | null): string | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  const match = texto.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function rotuloDias(dias?: string | null): string | null {
  const numeros = String(dias ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => item >= 1 && item <= 7);
  if (!numeros.length) return null;
  const unicos = [...new Set(numeros)].sort((a, b) => a - b);
  if (unicos.length === 7) return 'Todos os dias';
  const sequencia = unicos.every((dia, indice) => indice === 0 || dia === unicos[indice - 1] + 1);
  if (sequencia && unicos.length > 1) return `${DIAS[unicos[0] - 1]} a ${DIAS[unicos[unicos.length - 1] - 1]}`;
  return unicos.map((dia) => DIAS[dia - 1]).join(', ');
}

export const ESTADOS_BRASIL: ReadonlyArray<{ uf: string; nome: string }> = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' }
];

export type FiltroTriState = 'todos' | 'sim' | 'nao';
export type FiltroStatusMapa = 'todos' | 'ativo' | 'inativo';
export type FiltroTipoTarifaMapa = 'todos' | 'hora' | 'diaria' | 'sem';

export interface FiltroPontosMapa {
  busca?: string;
  cidade?: string;
  estado?: string;
  status?: FiltroStatusMapa;
  seguranca?: FiltroTriState;
  banheiro?: FiltroTriState;
  tipoTarifa?: FiltroTipoTarifaMapa;
}

/** Mantém os pátios cuja cidade contém o texto e cujo estado é a UF ou o nome. */
export function filtrarPontosMapa(pontos: PontoMapa[], cidade: string, estado: string): PontoMapa[] {
  return filtrarPontosMapaCompleto(pontos, { cidade, estado });
}

/** Filtros completos da rede credenciada (cidade/UF + status, estrutura e tarifa). */
export function filtrarPontosMapaCompleto(pontos: PontoMapa[], filtro: FiltroPontosMapa): PontoMapa[] {
  const cidadeBusca = normalizarTexto(filtro.cidade);
  const uf = String(filtro.estado ?? '').trim().toUpperCase();
  const busca = normalizarTexto(filtro.busca);
  const status = filtro.status ?? 'todos';
  const seguranca = filtro.seguranca ?? 'todos';
  const banheiro = filtro.banheiro ?? 'todos';
  const tipoTarifa = filtro.tipoTarifa ?? 'todos';

  return pontos.filter((ponto) => {
    if (!combinaCidade(ponto.cidade, cidadeBusca) || !combinaEstado(ponto.estado, uf)) return false;
    if (busca && !textoPontoCombinaBusca(ponto, busca)) return false;
    if (status === 'ativo' && ponto.ativo === false) return false;
    if (status === 'inativo' && ponto.ativo !== false) return false;
    if (!combinaTriState(ponto.possuiSeguranca, seguranca)) return false;
    if (!combinaTriState(ponto.possuiBanheiro, banheiro)) return false;
    if (!combinaTipoTarifa(ponto.tipoTarifaAvulsa, tipoTarifa)) return false;
    return true;
  });
}

function textoPontoCombinaBusca(ponto: PontoMapa, busca: string): boolean {
  return (
    normalizarTexto(ponto.descricao).includes(busca) ||
    normalizarTexto(ponto.cidade).includes(busca) ||
    normalizarTexto(ponto.estado).includes(busca) ||
    normalizarTexto(ponto.codExportacao).includes(busca)
  );
}

function combinaTriState(valor: boolean | null | undefined, filtro: FiltroTriState): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'sim') return valor === true;
  return valor === false;
}

function combinaTipoTarifa(
  tipo: 1 | 2 | null | undefined,
  filtro: FiltroTipoTarifaMapa
): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'hora') return tipo === 1;
  if (filtro === 'diaria') return tipo === 2;
  return tipo !== 1 && tipo !== 2;
}

function combinaCidade(cidade: string, busca: string): boolean {
  if (!busca) return true;
  return normalizarTexto(cidade).includes(busca);
}

function combinaEstado(estado: string, uf: string): boolean {
  if (!uf) return true;
  const atual = normalizarTexto(estado);
  const item = ESTADOS_BRASIL.find((estadoBrasil) => estadoBrasil.uf === uf);
  if (!item) return atual === normalizarTexto(uf);
  return atual === normalizarTexto(item.uf) || atual === normalizarTexto(item.nome);
}

function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export interface GrupoMapa {
  latitude: number;
  longitude: number;
  pontos: PontoMapa[];
}

/** Agrupa pontos próximos conforme o zoom, no estilo dos círculos numerados. */
export function agruparPontos(pontos: PontoMapa[], zoom: number): GrupoMapa[] {
  const passo = zoom >= 10 ? 0 : zoom >= 8 ? 0.15 : zoom >= 6 ? 0.6 : zoom >= 5 ? 1.4 : 3.2;
  if (passo === 0) {
    return pontos.map((ponto) => ({
      latitude: ponto.latitude,
      longitude: ponto.longitude,
      pontos: [ponto]
    }));
  }

  const grupos = new Map<string, PontoMapa[]>();
  for (const ponto of pontos) {
    const chave = `${Math.round(ponto.latitude / passo)}:${Math.round(ponto.longitude / passo)}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(ponto);
    grupos.set(chave, lista);
  }

  return [...grupos.values()].map((lista) => ({
    latitude: lista.reduce((soma, ponto) => soma + ponto.latitude, 0) / lista.length,
    longitude: lista.reduce((soma, ponto) => soma + ponto.longitude, 0) / lista.length,
    pontos: lista
  }));
}
