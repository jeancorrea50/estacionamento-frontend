import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Move o menu da linha para o `body`, fora do overflow e do empilhamento da tabela.
 */
@Directive({
  selector: '[appHistoricoMenuPortal]',
  standalone: true
})
export class HistoricoMenuPortalDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private parent: HTMLElement | null = null;

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.parent = el.parentElement;
    document.body.appendChild(el);
    el.style.position = 'fixed';
    el.style.zIndex = '2000';
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    if (this.parent && el.parentElement === document.body) {
      this.parent.appendChild(el);
    }
  }
}
