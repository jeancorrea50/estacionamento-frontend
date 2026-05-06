import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CameraService } from '../../services/camera.service';

@Component({
  selector: 'app-camera-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-preview.component.html',
  styleUrl: './camera-preview.component.scss'
})
export class CameraPreviewComponent implements OnInit, OnDestroy {
  private readonly cameraService = inject(CameraService);

  @ViewChild('videoPreview') videoPreview?: ElementRef<HTMLVideoElement>;

  devices: MediaDeviceInfo[] = [];
  selectedDeviceId = '';
  stream: MediaStream | null = null;
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    void this.initCamera();
  }

  ngOnDestroy(): void {
    this.detachStream();
  }

  async refreshDevices(): Promise<void> {
    if (!this.cameraService.isSupported()) {
      this.errorMessage = 'Navegador não suporta acesso à câmera.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      await this.cameraService.requestPermission();
      this.devices = await this.cameraService.listVideoDevices();
      if (!this.selectedDeviceId && this.devices.length > 0) {
        this.selectedDeviceId = this.devices[0]?.deviceId ?? '';
      }
    } catch {
      this.errorMessage = 'Não foi possível listar as câmeras conectadas.';
    } finally {
      this.loading = false;
    }
  }

  async startSelectedCamera(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      this.detachStream();
      this.stream = await this.cameraService.startVideoStream(this.selectedDeviceId || undefined);
      const video = this.videoPreview?.nativeElement;
      if (!video || !this.stream) {
        this.errorMessage = 'Não foi possível iniciar o preview da câmera.';
        return;
      }
      video.srcObject = this.stream;
      await video.play();
    } catch {
      this.errorMessage = 'Permissão negada ou câmera indisponível.';
    } finally {
      this.loading = false;
    }
  }

  stopCamera(): void {
    this.detachStream();
  }

  async onDeviceChange(deviceId: string): Promise<void> {
    this.selectedDeviceId = deviceId;
    await this.startSelectedCamera();
  }

  async onDeviceSelectChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement | null;
    await this.onDeviceChange(target?.value ?? '');
  }

  private async initCamera(): Promise<void> {
    await this.refreshDevices();
    if (this.devices.length > 0) {
      await this.startSelectedCamera();
    }
  }

  private detachStream(): void {
    if (this.videoPreview?.nativeElement) {
      this.videoPreview.nativeElement.pause();
      this.videoPreview.nativeElement.srcObject = null;
    }
    this.cameraService.stopStream(this.stream);
    this.stream = null;
  }
}
