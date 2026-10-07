import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
  inject
} from '@angular/core';
import { CameraService } from '../../services/camera.service';

interface CameraPanelVm {
  id: number;
  deviceId: string;
  stream: MediaStream | null;
  loading: boolean;
  errorMessage: string;
}

@Component({
  selector: 'app-camera-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-preview.component.html',
  styleUrl: './camera-preview.component.scss'
})
export class CameraPreviewComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly cameraService = inject(CameraService);

  @ViewChildren('videoPreview') videoPreviews?: QueryList<ElementRef<HTMLVideoElement>>;

  devices: MediaDeviceInfo[] = [];
  panels: CameraPanelVm[] = [];
  expanded = false;
  private nextPanelId = 1;
  private pendingVideoBind = false;

  ngOnInit(): void {
    void this.initCameras();
  }

  ngAfterViewChecked(): void {
    if (!this.pendingVideoBind) return;
    this.pendingVideoBind = false;
    this.bindStreamsToVideos();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
    for (const panel of this.panels) {
      this.cameraService.stopStream(panel.stream);
      panel.stream = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.expanded) this.recolherCameras();
  }

  expandirCameras(): void {
    this.expanded = true;
    this.lockBodyScroll();
    this.pendingVideoBind = true;
  }

  recolherCameras(): void {
    this.expanded = false;
    this.unlockBodyScroll();
    this.pendingVideoBind = true;
  }

  async refreshDevices(): Promise<void> {
    if (!this.cameraService.isSupported()) {
      this.setAllErrors('Navegador não suporta acesso à câmera.');
      return;
    }
    try {
      await this.cameraService.requestPermission();
      this.devices = await this.cameraService.listVideoDevices();
      for (const panel of this.panels) {
        if (!panel.deviceId && this.devices[0]) {
          panel.deviceId = this.devices[0].deviceId;
        }
      }
    } catch {
      this.setAllErrors('Não foi possível listar as câmeras conectadas.');
    }
  }

  async refreshPanel(panel: CameraPanelVm): Promise<void> {
    await this.refreshDevices();
    await this.startPanel(panel);
  }

  async startPanel(panel: CameraPanelVm): Promise<void> {
    panel.loading = true;
    panel.errorMessage = '';
    try {
      this.cameraService.stopStream(panel.stream);
      panel.stream = null;
      panel.stream = await this.cameraService.startVideoStream(panel.deviceId || undefined);
      if (!panel.stream) {
        panel.errorMessage = 'Não foi possível iniciar o preview da câmera.';
        return;
      }
      this.pendingVideoBind = true;
    } catch {
      panel.errorMessage = 'Permissão negada ou câmera indisponível.';
    } finally {
      panel.loading = false;
    }
  }

  stopPanel(panel: CameraPanelVm): void {
    this.cameraService.stopStream(panel.stream);
    panel.stream = null;
    panel.errorMessage = '';
    this.pendingVideoBind = true;
  }

  async onPanelDeviceChange(panel: CameraPanelVm, event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement | null;
    panel.deviceId = target?.value ?? '';
    await this.startPanel(panel);
  }

  async addCamera(): Promise<void> {
    await this.refreshDevices();
    const used = new Set(this.panels.map((p) => p.deviceId).filter(Boolean));
    const free = this.devices.find((d) => !used.has(d.deviceId));
    const panel: CameraPanelVm = {
      id: this.nextPanelId++,
      deviceId: free?.deviceId ?? this.devices[0]?.deviceId ?? '',
      stream: null,
      loading: false,
      errorMessage: ''
    };
    this.panels = [...this.panels, panel];
    if (panel.deviceId) {
      await this.startPanel(panel);
    }
  }

  removePanel(panel: CameraPanelVm): void {
    this.stopPanel(panel);
    this.panels = this.panels.filter((p) => p.id !== panel.id);
    if (this.panels.length === 0) {
      void this.addCamera();
    }
  }

  panelTitle(panel: CameraPanelVm, index: number): string {
    const device = this.devices.find((d) => d.deviceId === panel.deviceId);
    return device?.label?.trim() || `Câmera ${index + 1}`;
  }

  private async initCameras(): Promise<void> {
    await this.refreshDevices();
    if (this.panels.length === 0) {
      await this.addCamera();
    }
  }

  private bindStreamsToVideos(): void {
    const videos = this.videoPreviews?.toArray() ?? [];
    this.panels.forEach((panel, index) => {
      const video = videos[index]?.nativeElement;
      if (!video) return;
      if (panel.stream) {
        if (video.srcObject !== panel.stream) {
          video.srcObject = panel.stream;
          void video.play().catch(() => undefined);
        }
      } else {
        video.pause();
        video.srcObject = null;
      }
    });
  }

  private setAllErrors(message: string): void {
    for (const panel of this.panels) {
      panel.errorMessage = message;
    }
  }

  private lockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = '';
  }
}
