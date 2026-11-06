import { Injectable, NgZone, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Cooldown por controle após o primeiro clique/submit válido (ms). */
const BUTTON_COOLDOWN_MS = 1200;

/** Textos típicos de ações de gravação / alteração. */
const SAVE_LIKE_RE =
  /\b(salvar|gravar|alterar|atualizar|cadastrar|confirmar|enviar|concluir|reenviar|criar|gerar|registrar|excluir|remover|deletar|aceitar|recusar|publicar|finalizar)\b/i;

/** Ações de navegação/consulta que não devem ser bloqueadas. */
const IGNORE_RE =
  /\b(buscar|pesquisar|filtrar|limpar|cancelar|voltar|fechar|sair|login|entrar|próximo|proximo|anterior|abrir|ver|detalhe|detalhes)\b/i;

const ATTR_LOCK = 'data-submit-guard-locked';

/**
 * Intercepta cliques e submits em botões de Salvar/Gravar/Alterar e similares
 * em todo o app, evitando double-click sem anotar cada template.
 */
@Injectable({ providedIn: 'root' })
export class GlobalSubmitGuardService {
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private started = false;

  /** Inicia o listener global (idempotente). Chamar no bootstrap do App. */
  start(): void {
    if (this.started || typeof this.doc?.addEventListener !== 'function') return;
    this.started = true;
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('click', this.onClickCapture, true);
      this.doc.addEventListener('keydown', this.onKeydownCapture, true);
      this.doc.addEventListener('submit', this.onSubmitCapture, true);
    });
  }

  private readonly onClickCapture = (ev: Event): void => {
    const mouse = ev as MouseEvent;
    if (mouse.button != null && mouse.button !== 0) return;
    this.guardControlEvent(ev);
  };

  private readonly onKeydownCapture = (ev: Event): void => {
    const ke = ev as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    this.guardControlEvent(ev);
  };

  private readonly onSubmitCapture = (ev: Event): void => {
    const form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;

    const submitter =
      (ev as SubmitEvent).submitter instanceof HTMLElement
        ? ((ev as SubmitEvent).submitter as HTMLElement)
        : (form.querySelector(
            'button[type="submit"], input[type="submit"]'
          ) as HTMLElement | null);

    const target = submitter ?? form;

    if (submitter && !this.isSaveLikeControl(submitter)) {
      return;
    }

    if (!submitter) {
      const anySave = Array.from(
        form.querySelectorAll('button, input[type="submit"], input[type="button"]')
      ).some((el) => this.isSaveLikeControl(el as HTMLElement));
      if (!anySave) return;
    }

    if (this.isDisabled(target) || target.getAttribute(ATTR_LOCK) === '1') {
      this.block(ev);
      return;
    }

    this.lock(target);
    if (submitter && submitter !== form) this.lock(submitter);
  };

  private guardControlEvent(ev: Event): void {
    const target = ev.target;
    if (!(target instanceof Element)) return;

    const btn = target.closest(
      'button, input[type="submit"], input[type="button"], [role="button"]'
    ) as HTMLElement | null;
    if (!btn || !this.isSaveLikeControl(btn)) return;

    if (this.isDisabled(btn) || btn.getAttribute(ATTR_LOCK) === '1') {
      this.block(ev);
      return;
    }

    const inForm = !!btn.closest('form');
    const typeAttr = (btn.getAttribute('type') || '').toLowerCase();
    // Dentro de form, o submit event aplica o lock (evita click→lock→submit bloqueado).
    const isFormSubmit =
      inForm && (typeAttr === 'submit' || (btn.tagName === 'BUTTON' && !typeAttr));

    if (isFormSubmit) {
      return;
    }

    this.lock(btn);
  }

  private isSaveLikeControl(el: HTMLElement): boolean {
    if (el.hasAttribute('data-allow-double-submit')) return false;
    if (el.hasAttribute('data-submit-guard')) return true;

    const label = this.readLabel(el);
    if (!label) return false;
    if (IGNORE_RE.test(label) && !SAVE_LIKE_RE.test(label)) return false;
    return SAVE_LIKE_RE.test(label);
  }

  private readLabel(el: HTMLElement): string {
    const aria = el.getAttribute('aria-label') || '';
    const title = el.getAttribute('title') || '';
    const value =
      el instanceof HTMLInputElement || el instanceof HTMLButtonElement ? el.value || '' : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return `${aria} ${title} ${value} ${text}`.trim();
  }

  private isDisabled(el: HTMLElement): boolean {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return true;
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) return el.disabled;
    return false;
  }

  private lock(el: HTMLElement): void {
    el.setAttribute(ATTR_LOCK, '1');
    window.setTimeout(() => {
      el.removeAttribute(ATTR_LOCK);
    }, BUTTON_COOLDOWN_MS);
  }

  private block(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
  }
}
