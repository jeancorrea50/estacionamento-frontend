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
