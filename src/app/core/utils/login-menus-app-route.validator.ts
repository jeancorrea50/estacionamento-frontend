import type { SessionMenuAccess } from '../services/session-access.service';

/**
 * Rotas enviadas no login devem seguir o padrão do SPA:
 * `/app/{menu}`, `/app/{menu}/{submenu}` ou `/app/{menu}/{submenu}/{submenu2}`.
 */
const SEGMENT = /^[a-zA-Z0-9_.-]+$/;
const MAX_ROUTE_SEGMENTS = 3;

function stripQueryHash(raw: string): string {
  const noHash = raw.split('#')[0] ?? raw;
  return (noHash.split('?')[0] ?? '').trim();
}

function normalizePath(raw: string): string {
  let p = stripQueryHash(raw).replace(/\/{2,}/g, '/');
  if (!p) return '';
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

function isValidAppMenuPath(path: string): boolean {
  const p = normalizePath(path);
  if (!p) return false;
  const lower = p.toLowerCase();
  if (!lower.startsWith('/app/')) return false;
  const rest = p.slice(5);
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_ROUTE_SEGMENTS) return false;
  return parts.every((s) => SEGMENT.test(s));
}

function validateSubMenuLevel(
  subs: NonNullable<SessionMenuAccess['subMenus']>,
  menuLabel: string,
  errors: string[],
  depth = 1
): void {
  for (const sub of subs) {
    const subLabel = sub.descricao?.trim() || `submenu id ${sub.id ?? '?'}`;
    const subRota = sub.rota?.trim();
    if (subRota && !isValidAppMenuPath(subRota)) {
      const level =
        depth === 1 ? 'submenu' : depth === 2 ? 'submenu 2' : `submenu nível ${depth}`;
      errors.push(
        `${level} "${subLabel}" (menu "${menuLabel}"): rota "${subRota}" inválida. Esperado /app/{menu}/{submenu} ou até 3 níveis.`
      );
    }
    const nested = (sub as { subMenus?: SessionMenuAccess['subMenus'] }).subMenus ?? [];
    if (nested.length) {
      validateSubMenuLevel(nested, menuLabel, errors, depth + 1);
    }
  }
}

/**
 * @returns `null` se OK; senão texto único para exibir no toast (login falha).
 */
export function getLoginMenusAppRouteValidationMessage(menus: SessionMenuAccess[]): string | null {
  if (!menus.length) return null;

  const errors: string[] = [];

  for (const menu of menus) {
    const label = menu.descricao?.trim() || `menu id ${menu.id ?? '?'}`;
    const rota = menu.rota?.trim();
    if (rota && !isValidAppMenuPath(rota)) {
      errors.push(
        `Menu "${label}": rota "${rota}" inválida. Esperado /app/{menu} ou até 3 níveis (/app/{menu}/{submenu}/{submenu2}).`
      );
    }

    validateSubMenuLevel(menu.subMenus ?? [], label, errors);
  }

  if (errors.length === 0) return null;

  const max = 5;
  const head = errors.slice(0, max);
  const tail =
    errors.length > max
      ? ` (+${errors.length - max} outro(s); corrija todas no backend no padrão /app/{{menu}}/{{submenu}}/{{submenu2}}.)`
      : '';
  return head.join(' ') + tail;
}
