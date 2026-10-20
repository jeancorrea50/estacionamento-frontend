import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/** Posiciona o painel do calendário em `fixed` para não ser cortado por scroll containers. */
@Directive({
  selector: '.rec-data-picker__panel',
  standalone: true
})
export class FaturamentoDataPickerPanelDirective implements AfterViewInit, OnDestroy {
  private readonly panelRef = inject(ElementRef<HTMLElement>);
  private readonly onLayout = () => this.reposition();
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.reposition();
    window.addEventListener('resize', this.onLayout, { passive: true });
    window.addEventListener('scroll', this.onLayout, { passive: true, capture: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onLayout);
      this.resizeObserver.observe(this.panelRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onLayout);
    window.removeEventListener('scroll', this.onLayout, true);
    this.resizeObserver?.disconnect();
  }

  private reposition(): void {
    const panel = this.panelRef.nativeElement;
    const picker = panel.closest('.rec-data-picker');
    const trigger = picker?.querySelector('.rec-data-picker__trigger') as HTMLElement | null;
    if (!trigger) return;

    const margin = 8;
    const panelWidth = Math.min(304, window.innerWidth - margin * 2);
    const rect = trigger.getBoundingClientRect();

    panel.style.position = 'fixed';
    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${Math.min(
      Math.max(margin, rect.right - panelWidth),
      window.innerWidth - panelWidth - margin
    )}px`;
    panel.style.right = 'auto';
    panel.style.zIndex = '1300';

    const cal = panel.querySelector('.rec-cal') as HTMLElement | null;
    if (cal) {
      cal.style.maxHeight = '';
      cal.style.overflowY = '';
    }

    const height = panel.offsetHeight || 360;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < height && spaceAbove >= spaceBelow;

    if (openUp) {
      const top = Math.max(margin, rect.top - height - margin);
      panel.style.top = `${top}px`;
      panel.style.bottom = 'auto';
    } else {
      panel.style.top = `${rect.bottom + margin}px`;
      panel.style.bottom = 'auto';

      const maxH = window.innerHeight - rect.bottom - margin * 2;
      if (cal && height > maxH && maxH >= 220) {
        cal.style.maxHeight = `${maxH}px`;
        cal.style.overflowY = 'auto';
      }
    }
  }
}
