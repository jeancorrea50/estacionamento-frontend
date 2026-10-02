export interface PontoMapa {
  id: number;
  codExportacao: string;
  descricao: string;
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
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

/** Mantém os pátios cuja cidade contém o texto e cujo estado é a UF ou o nome. */
export function filtrarPontosMapa(pontos: PontoMapa[], cidade: string, estado: string): PontoMapa[] {
  const cidadeBusca = normalizarTexto(cidade);
  const uf = estado.trim().toUpperCase();
  return pontos.filter(
    (ponto) => combinaCidade(ponto.cidade, cidadeBusca) && combinaEstado(ponto.estado, uf)
  );
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
