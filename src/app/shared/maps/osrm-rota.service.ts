import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { type CoordenadaMapa } from './ponto-mapa.model';

export interface EstimativaRotaCarro {
  distanciaKm: number;
  duracaoMinutos: number;
  origem: 'osrm';
}

interface OsrmRouteResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 8_000;

@Injectable({ providedIn: 'root' })
export class OsrmRotaService {
  private readonly http = inject(HttpClient);

  /**
   * Estima rota de carro (km e minutos) via OSRM público.
   * Retorna null em falha/timeout — o caller usa fallback Haversine.
   */
  estimarRotaCarro(origem: CoordenadaMapa, destino: CoordenadaMapa): Observable<EstimativaRotaCarro | null> {
    if (!coordenadaValida(origem) || !coordenadaValida(destino)) return of(null);

    const url =
      `${OSRM_BASE}/` +
      `${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}` +
      `?overview=false&alternatives=false&steps=false`;

    return this.http.get<OsrmRouteResponse>(url).pipe(
      timeout(OSRM_TIMEOUT_MS),
      map((body) => {
        const rota = body?.routes?.[0];
        if (!rota || body.code !== 'Ok') return null;
        const metros = Number(rota.distance);
        const segundos = Number(rota.duration);
        if (!Number.isFinite(metros) || !Number.isFinite(segundos) || metros < 0 || segundos < 0) {
          return null;
        }
        return {
          distanciaKm: metros / 1000,
          duracaoMinutos: Math.max(1, Math.round(segundos / 60)),
          origem: 'osrm' as const
        };
      }),
      catchError(() => of(null))
    );
  }
}

function coordenadaValida(c: CoordenadaMapa): boolean {
  return Number.isFinite(c.latitude) && Number.isFinite(c.longitude);
}
