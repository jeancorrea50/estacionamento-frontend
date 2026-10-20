import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Posiciona o dropdown de filtros em `fixed` para não ser cortado por
 * ancestors com overflow (toolbar, main-content, etc.).
 */
@Directive({
  selector: '.mov-filtros__dropdown',
  standalone: true
})
export class MovimentosFiltrosDropdownPanelDirective implements AfterViewInit, OnDestroy {
  private readonly panelRef = inject(ElementRef<HTMLElement>);
  private readonly onLayout = () => this.reposition();
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.reposition();
    // Duplo rAF: garante medida com fontes/layout já aplicados.
    requestAnimationFrame(() => requestAnimationFrame(() => this.reposition()));

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
    const root = panel.closest('.mov-filtros');
    const trigger = root?.querySelector('.mov-filtros__btn') as HTMLElement | null;
    if (!trigger) return;

    const margin = 8;
    const panelWidth = Math.min(360, window.innerWidth - margin * 2);
    const rect = trigger.getBoundingClientRect();

    panel.style.position = 'fixed';
    panel.style.width = `${panelWidth}px`;
    panel.style.maxWidth = `${panelWidth}px`;
    panel.style.left = `${Math.min(
      Math.max(margin, rect.right - panelWidth),
      window.innerWidth - panelWidth - margin
    )}px`;
    panel.style.right = 'auto';
    panel.style.zIndex = '1300';
    panel.style.maxHeight = '';
    panel.style.overflowY = '';

    const height = panel.offsetHeight || 420;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < height && spaceAbove >= spaceBelow;

    if (openUp) {
      const top = Math.max(margin, rect.top - height - margin);
      panel.style.top = `${top}px`;
      panel.style.bottom = 'auto';

      const available = rect.top - margin * 2;
      if (height > available && available >= 240) {
        panel.style.maxHeight = `${available}px`;
        panel.style.overflowY = 'auto';
      }
    } else {
      panel.style.top = `${rect.bottom + margin}px`;
      panel.style.bottom = 'auto';

      const maxH = window.innerHeight - rect.bottom - margin * 2;
      if (height > maxH && maxH >= 240) {
        panel.style.maxHeight = `${maxH}px`;
        panel.style.overflowY = 'auto';
      }
    }
  }
}
