import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { arredondarCoordenada, type CoordenadaMapa } from './ponto-mapa.model';

export type GeolocationErroCodigo = 'denied' | 'unavailable' | 'unsupported' | 'timeout';

export interface GeolocationResultadoOk {
  ok: true;
  posicao: CoordenadaMapa;
}

export interface GeolocationResultadoErro {
  ok: false;
  codigo: GeolocationErroCodigo;
  mensagem: string;
}

export type GeolocationResultado = GeolocationResultadoOk | GeolocationResultadoErro;

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Obtém a posição atual do navegador (SSR-safe). */
  obterPosicaoAtual(opcoes?: PositionOptions): Observable<GeolocationResultado> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({
        ok: false,
        codigo: 'unsupported',
        mensagem: 'Geolocalização disponível apenas no navegador.'
      });
    }
    if (!navigator?.geolocation) {
      return of({
        ok: false,
        codigo: 'unsupported',
        mensagem: 'Seu navegador não suporta geolocalização.'
      });
    }

    return new Observable<GeolocationResultado>((subscriber) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          subscriber.next({
            ok: true,
            posicao: {
              latitude: arredondarCoordenada(pos.coords.latitude),
              longitude: arredondarCoordenada(pos.coords.longitude)
            }
          });
          subscriber.complete();
        },
        (err) => {
          subscriber.next(mapearErro(err));
          subscriber.complete();
        },
        {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 60_000,
          ...opcoes
        }
      );
    });
  }
}

function mapearErro(err: GeolocationPositionError): GeolocationResultadoErro {
  if (err.code === err.PERMISSION_DENIED) {
    return {
      ok: false,
      codigo: 'denied',
      mensagem: 'Permissão de localização negada. Exibindo toda a rede.'
    };
  }
  if (err.code === err.TIMEOUT) {
    return {
      ok: false,
      codigo: 'timeout',
      mensagem: 'Tempo esgotado ao obter sua localização.'
    };
  }
  return {
    ok: false,
    codigo: 'unavailable',
    mensagem: 'Não foi possível obter sua localização.'
  };
}
