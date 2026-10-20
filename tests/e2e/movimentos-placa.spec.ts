import { expect, test } from '@playwright/test';

/** Base64url sem `Buffer` (evita exigir @types/node no projeto Angular). */
function toBase64Url(value: Record<string, unknown>): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildFakeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = toBase64Url({
    sub: 'e2e-user',
    unique_name: 'e2e.user@gts.local',
    perfil: 'Admin',
    Permission: ['movimentos.visualizar'],
    exp: now + 60 * 60,
  });
  return `${header}.${payload}.signature`;
}

test.beforeEach(async ({ page }) => {
  const token = buildFakeJwt();
  await page.addInitScript((jwt: string) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('authToken', jwt);
    localStorage.setItem(
      'loggedUser',
      JSON.stringify({
        username: 'e2e.user@gts.local',
        perfil: 'Admin',
        permissionKeys: ['movimentos.visualizar'],
      })
    );
  }, token);
});

test('registra entrada por placa com lookup acionado', async ({ page }) => {
  await page.route('**/Veiculo/Buscar**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 10,
            placa: 'ABC1D23',
            marcaModelo: 'Volvo FH',
            transportadoraId: 77,
            ativo: true,
          },
        ],
        totalCount: 1,
        numeroPagina: 1,
        tamanhoPagina: 1,
      }),
    });
  });

  await page.route('**/Veiculo/ObterPorId/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          id: 10,
          placa: 'ABC1D23',
          marcaModelo: 'Volvo FH',
          anoFabricacao: 2022,
          quantidadeEixos: 6,
          transportadoraId: 77,
          ativo: true,
        },
      }),
    });
  });

  await page.route('**/Transportadora/ObterPorId/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          id: 77,
          razaoSocial: 'Transportadora E2E LTDA',
          nomeFantasia: 'Transportadora E2E',
          cnpj: '12345678000199',
          email: 'contato@e2e.local',
          ativo: true,
        },
      }),
    });
  });

  await page.goto('/app/movimentos');

  await page.getByRole('button', { name: 'Entrada', exact: true }).click();

  const buscarRequestPromise = page.waitForRequest('**/Veiculo/Buscar**');
  const obterVeiculoRequestPromise = page.waitForRequest('**/Veiculo/ObterPorId/**');
  const obterTransportadoraRequestPromise = page.waitForRequest(
    '**/Transportadora/ObterPorId/**'
  );

  const placa = page.locator('#modal-op-placa');
  await placa.fill('abc1d23');
  await page.locator('#modal-op-modelo').click();
  await buscarRequestPromise;
  await obterVeiculoRequestPromise;
  await obterTransportadoraRequestPromise;

  await page.locator('#modal-op-modelo').fill('Volvo FH');
  await page.locator('#modal-op-ano').fill('2022');
  await page.locator('#modal-op-eixos').selectOption('6');
  await page.locator('#modal-op-transportadora').fill('Transportadora E2E');
  await page.locator('#modal-op-condutor').fill('Joao Motorista');
  await page.locator('#modal-op-cpf').fill('12345678910');

  await page.getByRole('button', { name: 'Registrar entrada' }).click();

  await expect(page.locator('tbody tr td').filter({ hasText: 'ABC1D23' })).toBeVisible();
  await expect(page.locator('tbody tr td').filter({ hasText: 'Transportadora E2E' })).toBeVisible();
});
