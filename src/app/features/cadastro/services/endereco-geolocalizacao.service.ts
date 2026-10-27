import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { arredondarCoordenada, coordenadaNoBrasil } from '../../../shared/maps/ponto-mapa.model';
import { montarConsultaEndereco, type EnderecoParaGeocode } from './endereco-geolocalizacao.util';

export type { EnderecoParaGeocode };
export { escolherEnderecoParaGeocode, montarConsultaEndereco } from './endereco-geolocalizacao.util';

export interface CoordenadaEndereco {
  latitude: number;
  longitude: number;
}

interface NominatimItem {
  lat?: string;
  lon?: string;
}

interface BrasilApiCepV2 {
  location?: {
    coordinates?: {
      latitude?: string | number;
      longitude?: string | number;
    };
  };
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

@Injectable({
  providedIn: 'root'
})
export class EnderecoGeolocalizacaoService {
  constructor(private http: HttpClient) {}

  /** Converte o endereço principal em coordenadas no Brasil. Null se não houver ponto. */
  buscar(endereco: EnderecoParaGeocode | null | undefined): Observable<CoordenadaEndereco | null> {
    const consulta = montarConsultaEndereco(endereco);
    if (!consulta) return of(null);

    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('limit', '1')
      .set('countrycodes', 'br')
      .set('q', consulta);

    return this.http
      .get<NominatimItem[]>(NOMINATIM_URL, {
        params,
        headers: { 'Accept-Language': 'pt-BR' }
      })
      .pipe(
        timeout(8000),
        map((itens) => lerCoordenada(itens?.[0]?.lat, itens?.[0]?.lon)),
        switchMap((ponto) => (ponto ? of(ponto) : this.buscarPorCep(endereco?.cep))),
        catchError(() => this.buscarPorCep(endereco?.cep))
      );
  }

  private buscarPorCep(cep: string | null | undefined): Observable<CoordenadaEndereco | null> {
    const digitos = String(cep ?? '').replace(/\D/g, '');
    if (digitos.length !== 8) return of(null);
    const base = environment.brasilApiBaseUrl.replace(/\/$/, '');
    return this.http.get<BrasilApiCepV2>(`${base}/api/cep/v2/${digitos}`).pipe(
      timeout(8000),
      map((res) =>
        lerCoordenada(res?.location?.coordinates?.latitude, res?.location?.coordinates?.longitude)
      ),
      catchError(() => of(null))
    );
  }
}

function lerCoordenada(latitude: unknown, longitude: unknown): CoordenadaEndereco | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !coordenadaNoBrasil(lat, lng)) return null;
  return { latitude: arredondarCoordenada(lat), longitude: arredondarCoordenada(lng) };
}
