import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'dark' | 'light' | 'auto';

/** Modos exibidos no switcher: apenas Dark e White (light). */
export const THEME_SWITCHER_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Background Dark' },
  { value: 'light', label: 'Background White' }
];
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange';

export interface ThemeConfig {
  mode: ThemeMode;
  accentColor: AccentColor;
}

/**
 * Paleta de acento por cor e modo (Prioridade A).
 * Azul claro/escuro levemente diferente para contraste; demais cores iguais nos dois modos.
 * `primary`, `accent` e `focus` usam o mesmo valor (um “azul de marca”, sem dois azuis paralelelos).
 */
const ACCENT_PALETTE: Record<AccentColor, { dark: string; light: string }> = {
  blue: { dark: '#5b7cff', light: '#5088d0' },
  purple: { dark: '#7b4cff', light: '#7b4cff' },
  green: { dark: '#4caf50', light: '#4caf50' },
  orange: { dark: '#ff9800', light: '#ff9800' }
};

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'appTheme';
  private readonly DEFAULT_THEME: ThemeConfig = {
    mode: 'dark',
    accentColor: 'blue'
  };

  private themeSubject = new BehaviorSubject<ThemeConfig>(this.loadTheme());
  public theme$: Observable<ThemeConfig> = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  /**
   * Carrega o tema salvo no localStorage
   */
  private loadTheme(): ThemeConfig {
    const saved = localStorage.getItem(this.THEME_KEY);
    return saved ? JSON.parse(saved) : this.DEFAULT_THEME;
  }

  /**
   * Obtém o tema atual
   */
  getCurrentTheme(): ThemeConfig {
    return this.themeSubject.value;
  }

  /**
   * Atualiza o tema
   */
  setTheme(theme: ThemeConfig): void {
    localStorage.setItem(this.THEME_KEY, JSON.stringify(theme));
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  /**
   * Atualiza apenas o modo de tema
   */
  setThemeMode(mode: ThemeMode): void {
    const current = this.themeSubject.value;
    this.setTheme({ ...current, mode });
  }

  /**
   * Atualiza apenas a cor de acentuação
   */
  setAccentColor(color: AccentColor): void {
    const current = this.themeSubject.value;
    this.setTheme({ ...current, accentColor: color });
  }

  /**
   * Aplica as variáveis CSS do tema ao documento
   */
  private applyTheme(theme: ThemeConfig): void {
    const root = document.documentElement;

    // 1) Classes de modo — definem tokens de fundo/superfície em styles.css
    root.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    root.classList.add(`theme-${theme.mode}`);

    let resolvedMode: 'dark' | 'light' =
      theme.mode === 'light' ? 'light' : theme.mode === 'dark' ? 'dark' : 'dark';

    if (theme.mode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedMode = prefersDark ? 'dark' : 'light';
      root.classList.add(resolvedMode === 'dark' ? 'theme-dark' : 'theme-light');
    }

    // 2) Marca unificada: primary === accent === focus === color-primary
    const brand = ACCENT_PALETTE[theme.accentColor][resolvedMode];
    root.style.setProperty('--accent', brand);
    root.style.setProperty('--primary', brand);
    root.style.setProperty('--focus', brand);
    root.style.setProperty('--color-primary', brand);
    root.style.setProperty('--color-primary-hover', brand);
  }

  /**
   * Obtém as cores de acentuação disponíveis
   */
  getAvailableAccentColors(): { value: AccentColor; label: string; color: string }[] {
    return [
      { value: 'blue', label: 'Azul', color: ACCENT_PALETTE.blue.dark },
      { value: 'purple', label: 'Roxo', color: ACCENT_PALETTE.purple.dark },
      { value: 'green', label: 'Verde', color: ACCENT_PALETTE.green.dark },
      { value: 'orange', label: 'Laranja', color: ACCENT_PALETTE.orange.dark }
    ];
  }

  /**
   * Obtém os modos de tema disponíveis
   */
  getAvailableThemeModes(): { value: ThemeMode; label: string }[] {
    return [
      { value: 'dark', label: 'Escuro' },
      { value: 'light', label: 'Claro' },
      { value: 'auto', label: 'Automático' }
    ];
  }
}
