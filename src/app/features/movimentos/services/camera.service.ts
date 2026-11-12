import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CameraService {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.stopStream(stream);
      return true;
    } catch {
      return false;
    }
  }

  async listVideoDevices(): Promise<MediaDeviceInfo[]> {
    if (!this.isSupported()) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  }

  async startVideoStream(deviceId?: string): Promise<MediaStream | null> {
    if (!this.isSupported()) return null;
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
      audio: false
    };
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  }

  stopStream(stream: MediaStream | null | undefined): void {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  }
}
