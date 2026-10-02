import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import type { Map as LeafletMap, Marker } from 'leaflet';
import * as LeafletNamespace from 'leaflet';
import {
  BRASIL_LAT_MAX,
  BRASIL_LAT_MIN,
  BRASIL_LNG_MAX,
  BRASIL_LNG_MIN,
  agruparPontos,
  arredondarCoordenada,
  coordenadaNoBrasil,
  type PontoMapa
} from './ponto-mapa.model';

type LeafletApi = typeof import('leaflet');

function leafletApi(): LeafletApi {
  const modulo = LeafletNamespace as LeafletApi & { default?: LeafletApi };
  return modulo.default ?? modulo;
}

@Component({
  selector: 'app-brasil-mapa',
  standalone: true,
  templateUrl: './brasil-mapa.component.html',
  styleUrl: './brasil-mapa.component.scss'
})
export class BrasilMapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() modo: 'brasil' | 'ponto' = 'brasil';
  @Input() pontos: PontoMapa[] = [];
  /** brasil enquadra o país; pontos aproxima o recorte da lista visível. */
  @Input() foco: 'brasil' | 'pontos' = 'brasil';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Output() readonly pontoSelecionado = new EventEmitter<{ latitude: number; longitude: number }>();

  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLDivElement>;

  private mapa: LeafletMap | null = null;
  private marcadores: Marker[] = [];
  private marcadorPonto: Marker | null = null;

  ngAfterViewInit(): void {
    const el = this.canvas?.nativeElement;
    if (!el) return;
    const L = leafletApi();
    const mapa = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      maxBounds: L.latLngBounds([BRASIL_LAT_MIN, BRASIL_LNG_MIN], [BRASIL_LAT_MAX, BRASIL_LNG_MAX]),
      maxBoundsViscosity: 1,
      minZoom: 4,
      worldCopyJump: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    // CARTO dark_all passou a carimbar "API KEY REQUIRED". O OSM publica sem chave.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);

    if (this.modo === 'brasil') {
      mapa.on('zoomend', () => this.desenharPontos());
      void this.aplicarMascaraBrasil(mapa);
    } else {
      mapa.on('click', (evento) => {
        const latitude = arredondarCoordenada(evento.latlng.lat);
        const longitude = arredondarCoordenada(evento.latlng.lng);
        if (!coordenadaNoBrasil(latitude, longitude)) return;
        this.pontoSelecionado.emit({ latitude, longitude });
      });
      this.enquadrarPonto(mapa);
    }

    this.mapa = mapa;
    this.desenharPontos();
    this.desenharPontoUnico();
    this.aplicarFoco();
    setTimeout(() => mapa.invalidateSize(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapa) return;
    if (changes['pontos']) this.desenharPontos();
    if (changes['latitude'] || changes['longitude']) {
      this.desenharPontoUnico();
      if (this.modo === 'ponto') this.enquadrarPonto(this.mapa);
    }
    if (this.modo === 'brasil' && (changes['pontos'] || changes['foco'])) this.aplicarFoco();
  }

  atualizarTamanho(): void {
    this.mapa?.invalidateSize();
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
    this.mapa = null;
  }

  private async aplicarMascaraBrasil(mapa: LeafletMap): Promise<void> {
    const L = leafletApi();
    try {
      const resposta = await fetch('/maps/brasil.json');
      if (!resposta.ok) return;
      const geo = (await resposta.json()) as { geometry?: { type?: string; coordinates?: unknown } };
      const aneis = extrairAneis(geo);
      if (!aneis.length) return;
      const mundo: [number, number][] = [
        [85, -180],
        [85, 20],
        [-60, 20],
        [-60, -180]
      ];
      L.polygon([mundo, ...aneis], {
        stroke: false,
        fillColor: '#101114',
        fillOpacity: 0.94,
        interactive: false
      }).addTo(mapa);
      L.geoJSON(geo as never, {
        style: { color: '#5b8def', weight: 1, fill: false, opacity: 0.55, interactive: false }
      }).addTo(mapa);
    } catch {
      /* O recorte de bounds já impede sair do Brasil. */
    }
  }

  private desenharPontos(): void {
    if (!this.mapa || this.modo !== 'brasil') return;
    const L = leafletApi();
    this.marcadores.forEach((marcador) => marcador.remove());
    this.marcadores = [];
    const zoom = this.mapa.getZoom();
    for (const grupo of agruparPontos(this.pontos, zoom)) {
      const varios = grupo.pontos.length > 1;
      const icone = L.divIcon({
        className: 'br-pin',
        html: varios
          ? `<span class="br-cluster">${grupo.pontos.length}</span>`
          : '<span class="br-dot"></span>',
        iconSize: varios ? [36, 36] : [16, 16],
        iconAnchor: varios ? [18, 18] : [8, 8]
      });
      const marcador = L.marker([grupo.latitude, grupo.longitude], { icon: icone }).addTo(this.mapa);
      if (varios) {
        marcador.on('click', () => {
          this.mapa?.setView([grupo.latitude, grupo.longitude], Math.min(zoom + 2, 12));
        });
      } else {
        const ponto = grupo.pontos[0];
        marcador.bindPopup(
          `<strong>${escaparHtml(ponto.descricao)}</strong><br>${escaparHtml(rotuloLocal(ponto))}`
        );
      }
      this.marcadores.push(marcador);
    }
  }

  private desenharPontoUnico(): void {
    if (!this.mapa || this.modo !== 'ponto') return;
    const L = leafletApi();
    this.marcadorPonto?.remove();
    this.marcadorPonto = null;
    if (this.latitude == null || this.longitude == null) return;
    if (!coordenadaNoBrasil(this.latitude, this.longitude)) return;
    const icone = L.divIcon({
      className: 'br-pin',
      html: '<span class="br-dot br-dot--atual"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    this.marcadorPonto = L.marker([this.latitude, this.longitude], { icon: icone }).addTo(this.mapa);
  }

  private aplicarFoco(): void {
    if (!this.mapa || this.modo !== 'brasil') return;
    if (this.foco === 'pontos' && this.pontos.length) {
      this.enquadrarLista(this.pontos);
      return;
    }
    this.mapa.fitBounds(leafletApi().latLngBounds([-33.6, -73.8], [5.2, -34.6]), { padding: [12, 12] });
  }

  private enquadrarLista(pontos: PontoMapa[]): void {
    if (!this.mapa) return;
    if (pontos.length === 1) {
      this.mapa.setView([pontos[0].latitude, pontos[0].longitude], 12);
      return;
    }
    const limites = leafletApi().latLngBounds(pontos.map((ponto) => [ponto.latitude, ponto.longitude]));
    this.mapa.fitBounds(limites, { padding: [36, 36], maxZoom: 12 });
  }

  private enquadrarPonto(mapa: LeafletMap): void {
    if (this.latitude != null && this.longitude != null && coordenadaNoBrasil(this.latitude, this.longitude)) {
      mapa.setView([this.latitude, this.longitude], 14);
      return;
    }
    mapa.fitBounds(leafletApi().latLngBounds([-33.6, -73.8], [5.2, -34.6]), { padding: [8, 8] });
  }
}

function rotuloLocal(ponto: PontoMapa): string {
  const cidade = ponto.cidade?.trim();
  const estado = ponto.estado?.trim();
  if (cidade && estado) return `${cidade} - ${estado}`;
  return cidade || estado || 'Brasil';
}

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function extrairAneis(geo: { geometry?: { type?: string; coordinates?: unknown } }): [number, number][][] {
  const geometria = (geo as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
  if (!geometria || geometria.type !== 'MultiPolygon' || !Array.isArray(geometria.coordinates)) return [];
  const aneis: [number, number][][] = [];
  for (const poligono of geometria.coordinates as number[][][][]) {
    const anel = poligono?.[0];
    if (!Array.isArray(anel) || anel.length < 4) continue;
    aneis.push(anel.map(([lng, lat]) => [lat, lng]));
  }
  return aneis;
}
