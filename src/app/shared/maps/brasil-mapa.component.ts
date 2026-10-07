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
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import * as LeafletNamespace from 'leaflet';
import {
  BRASIL_LAT_MAX,
  BRASIL_LAT_MIN,
  BRASIL_LNG_MAX,
  BRASIL_LNG_MIN,
  agruparPontos,
  arredondarCoordenada,
  coordenadaNoBrasil,
  detalhesPontoMapa,
  type CoordenadaMapa,
  type PontoMapa
} from './ponto-mapa.model';

type LeafletApi = typeof import('leaflet');

function leafletApi(): LeafletApi {
  const modulo = LeafletNamespace as LeafletApi & { default?: LeafletApi };
  return modulo.default ?? modulo;
}

const BRASIL_VIEW: [[number, number], [number, number]] = [
  [BRASIL_LAT_MIN, BRASIL_LNG_MIN],
  [BRASIL_LAT_MAX, BRASIL_LNG_MAX]
];
const MIN_ZOOM_BRASIL = 4.25;
const MAX_ZOOM_ENQUADRE = 12;

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
  @Input() destaqueId: number | null = null;
  /** Posição do usuário (pin distinto no modo brasil). */
  @Input() posicaoUsuario: CoordenadaMapa | null = null;
  @Output() readonly pontoSelecionado = new EventEmitter<{ latitude: number; longitude: number }>();
  @Output() readonly patioClicado = new EventEmitter<PontoMapa>();

  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLDivElement>;

  private mapa: LeafletMap | null = null;
  private marcadores: Marker[] = [];
  private marcadorPonto: Marker | null = null;
  private marcadorUsuario: Marker | null = null;
  private marcadoresPorId = new Map<number, Marker>();
  private contandoBrasil = false;

  ngAfterViewInit(): void {
    const el = this.canvas?.nativeElement;
    if (!el) return;
    const L = leafletApi();
    const limites = L.latLngBounds(BRASIL_VIEW[0], BRASIL_VIEW[1]);
    const mapa = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      maxBounds: limites.pad(0.02),
      maxBoundsViscosity: 1,
      minZoom: MIN_ZOOM_BRASIL,
      maxZoom: 18,
      worldCopyJump: false,
      bounceAtZoomLimits: true
    });
    L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      bounds: limites.pad(0.08),
      noWrap: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);

    if (this.modo === 'brasil') {
      mapa.on('zoomend', () => {
        this.conterNoBrasil();
        this.desenharPontos();
      });
      mapa.on('dragend', () => this.conterNoBrasil());
      mapa.on('moveend', () => this.conterNoBrasil());
      void this.aplicarMascaraBrasil(mapa);
    } else {
      mapa.on('click', (evento: LeafletMouseEvent) => {
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
    this.desenharPosicaoUsuario();
    this.aplicarFoco();
    setTimeout(() => {
      mapa.invalidateSize();
      this.conterNoBrasil();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapa) return;
    if (changes['pontos'] || changes['destaqueId']) this.desenharPontos();
    if (changes['latitude'] || changes['longitude']) {
      this.desenharPontoUnico();
      if (this.modo === 'ponto') this.enquadrarPonto(this.mapa);
    }
    if (changes['posicaoUsuario']) this.desenharPosicaoUsuario();
    // Só reenquadra quando o modo de foco muda (evita “teleporte” a cada tecla de filtro).
    if (this.modo === 'brasil' && changes['foco']) this.aplicarFoco();
  }

  atualizarTamanho(): void {
    this.mapa?.invalidateSize();
    this.conterNoBrasil();
  }

  /** Reaplica o enquadramento atual (brasil ou lista de pontos). */
  reenquadrar(): void {
    this.aplicarFoco();
  }

  /** Centraliza um pátio e abre o popup após o zoom estabilizar (fora de cluster). */
  focarPonto(ponto: PontoMapa): void {
    if (!this.mapa || !coordenadaNoBrasil(ponto.latitude, ponto.longitude)) return;
    const zoomAlvo = Math.max(this.mapa.getZoom(), 11);
    this.mapa.once('moveend', () => {
      const marcador = this.marcadoresPorId.get(ponto.id);
      if (marcador) {
        marcador.openPopup();
        return;
      }
      // Se ainda estiver agrupado, redesenha no zoom atual e tenta de novo.
      this.desenharPontos();
      this.marcadoresPorId.get(ponto.id)?.openPopup();
    });
    this.mapa.setView([ponto.latitude, ponto.longitude], zoomAlvo, { animate: true });
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
      // Anel externo cobre o globo inteiro; o buraco é o polígono do Brasil.
      const mundo: [number, number][] = [
        [90, -180],
        [90, 180],
        [-90, 180],
        [-90, -180]
      ];
      L.polygon([mundo, ...aneis], {
        stroke: false,
        fillColor: '#101114',
        fillOpacity: 0.97,
        interactive: false
      }).addTo(mapa);
      L.geoJSON(geo as never, {
        style: { color: '#5b8def', weight: 1.2, fill: false, opacity: 0.65, interactive: false }
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
    this.marcadoresPorId.clear();
    const zoom = this.mapa.getZoom();
    for (const grupo of agruparPontos(this.pontos, zoom)) {
      const varios = grupo.pontos.length > 1;
      const destaque = !varios && grupo.pontos[0].id === this.destaqueId;
      const icone = L.divIcon({
        className: 'br-pin',
        html: varios
          ? `<span class="br-cluster">${grupo.pontos.length}</span>`
          : `<span class="br-dot${grupo.pontos[0].ativo === false ? ' br-dot--inativo' : ''}${destaque ? ' br-dot--destaque' : ''}"></span>`,
        iconSize: varios ? [36, 36] : destaque ? [20, 20] : [16, 16],
        iconAnchor: varios ? [18, 18] : destaque ? [10, 10] : [8, 8]
      });
      const marcador = L.marker([grupo.latitude, grupo.longitude], { icon: icone }).addTo(this.mapa);
      if (varios) {
        marcador.on('click', () => {
          const proximo = Math.min(zoom + 2, MAX_ZOOM_ENQUADRE);
          this.mapa?.setView([grupo.latitude, grupo.longitude], proximo);
        });
      } else {
        const ponto = grupo.pontos[0];
        marcador.bindPopup(htmlPopup(ponto), { maxWidth: 320 });
        marcador.on('click', () => this.patioClicado.emit(ponto));
        this.marcadoresPorId.set(ponto.id, marcador);
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

  private desenharPosicaoUsuario(): void {
    if (!this.mapa || this.modo !== 'brasil') return;
    const L = leafletApi();
    this.marcadorUsuario?.remove();
    this.marcadorUsuario = null;
    const pos = this.posicaoUsuario;
    if (!pos || !coordenadaNoBrasil(pos.latitude, pos.longitude)) return;
    const icone = L.divIcon({
      className: 'br-pin',
      html: '<span class="br-dot br-dot--usuario" title="Você está aqui"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    this.marcadorUsuario = L.marker([pos.latitude, pos.longitude], {
      icon: icone,
      zIndexOffset: 800
    }).addTo(this.mapa);
    this.marcadorUsuario.bindPopup('<strong>Você está aqui</strong>');
  }

  private aplicarFoco(): void {
    if (!this.mapa || this.modo !== 'brasil') return;
    if (this.foco === 'pontos' && this.pontos.length) {
      this.enquadrarLista(this.pontos);
      return;
    }
    if (this.foco === 'pontos' && this.posicaoUsuario) {
      this.mapa.setView([this.posicaoUsuario.latitude, this.posicaoUsuario.longitude], 10);
      this.conterNoBrasil();
      return;
    }
    this.enquadrarBrasil();
  }

  private enquadrarBrasil(): void {
    if (!this.mapa) return;
    const L = leafletApi();
    this.mapa.fitBounds(L.latLngBounds(BRASIL_VIEW[0], BRASIL_VIEW[1]), {
      padding: [16, 16],
      maxZoom: 5.2
    });
    this.conterNoBrasil();
  }

  private enquadrarLista(pontos: PontoMapa[]): void {
    if (!this.mapa) return;
    const validos = pontos.filter((ponto) => coordenadaNoBrasil(ponto.latitude, ponto.longitude));
    const coords: [number, number][] = validos.map((ponto) => [ponto.latitude, ponto.longitude]);
    if (
      this.posicaoUsuario &&
      coordenadaNoBrasil(this.posicaoUsuario.latitude, this.posicaoUsuario.longitude)
    ) {
      coords.push([this.posicaoUsuario.latitude, this.posicaoUsuario.longitude]);
    }
    if (!coords.length) {
      this.enquadrarBrasil();
      return;
    }
    if (coords.length === 1) {
      this.mapa.setView(coords[0], 11);
      this.conterNoBrasil();
      return;
    }
    const L = leafletApi();
    const limites = L.latLngBounds(coords);
    const brasil = L.latLngBounds(BRASIL_VIEW[0], BRASIL_VIEW[1]);
    const recorte = brasil.intersects(limites) ? limites : brasil;
    this.mapa.fitBounds(recorte, { padding: [40, 40], maxZoom: MAX_ZOOM_ENQUADRE });
    if (this.mapa.getZoom() < MIN_ZOOM_BRASIL) {
      this.mapa.setZoom(MIN_ZOOM_BRASIL);
    }
    this.conterNoBrasil();
  }

  private enquadrarPonto(mapa: LeafletMap): void {
    if (this.latitude != null && this.longitude != null && coordenadaNoBrasil(this.latitude, this.longitude)) {
      mapa.setView([this.latitude, this.longitude], 14);
      return;
    }
    mapa.fitBounds(leafletApi().latLngBounds(BRASIL_VIEW[0], BRASIL_VIEW[1]), { padding: [8, 8], maxZoom: 5.2 });
  }

  /** Impede centro/zoom de escapar para países vizinhos ou cópias do mundo. */
  private conterNoBrasil(): void {
    if (!this.mapa || this.modo !== 'brasil' || this.contandoBrasil) return;
    this.contandoBrasil = true;
    try {
      const L = leafletApi();
      const brasil = L.latLngBounds(BRASIL_VIEW[0], BRASIL_VIEW[1]);
      const centro = this.mapa.getCenter();
      const lat = Math.min(Math.max(centro.lat, BRASIL_LAT_MIN), BRASIL_LAT_MAX);
      const lng = Math.min(Math.max(centro.lng, BRASIL_LNG_MIN), BRASIL_LNG_MAX);
      if (lat !== centro.lat || lng !== centro.lng) {
        this.mapa.panTo([lat, lng], { animate: false });
      }
      if (this.mapa.getZoom() < MIN_ZOOM_BRASIL) {
        this.mapa.setZoom(MIN_ZOOM_BRASIL);
      }
      const view = this.mapa.getBounds();
      if (!brasil.contains(view.getCenter()) || !brasil.intersects(view)) {
        this.mapa.fitBounds(brasil, { padding: [12, 12], maxZoom: 5.2, animate: false });
      }
    } finally {
      this.contandoBrasil = false;
    }
  }
}

function htmlPopup(ponto: PontoMapa): string {
  const linhas = detalhesPontoMapa(ponto)
    .map(
      (item) =>
        `<span class="mapa-popup__linha mapa-popup__linha--${item.estado}"><span class="material-symbols-outlined" aria-hidden="true">${item.icone}</span>${escaparHtml(item.texto)}</span>`
    )
    .join('');
  return `<div class="mapa-popup"><strong>${escaparHtml(ponto.descricao)}</strong><br>${escaparHtml(rotuloLocal(ponto))}${linhas}</div>`;
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
