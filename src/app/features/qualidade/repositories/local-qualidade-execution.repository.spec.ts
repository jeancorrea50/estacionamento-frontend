import { firstValueFrom } from 'rxjs';
import { LocalQualidadeExecutionRepository, QUALIDADE_STORE_KEY } from './local-qualidade-execution.repository';

describe('LocalQualidadeExecutionRepository', () => {
  let repo: LocalQualidadeExecutionRepository;

  beforeEach(() => {
    localStorage.removeItem(QUALIDADE_STORE_KEY);
    repo = new LocalQualidadeExecutionRepository();
  });

  afterEach(() => {
    localStorage.removeItem(QUALIDADE_STORE_KEY);
  });

  it('recusa aprovado sem evidência nem resultado', async () => {
    await expect(
      firstValueFrom(
        repo.registrarManual({
          casoId: 'X-1',
          status: 'aprovado',
          resultadoObtido: '',
          observacoes: '',
          evidenciaTexto: '',
        })
      )
    ).rejects.toThrow(/evidência/i);
  });

  it('persiste e recupera último registro', async () => {
    await firstValueFrom(
      repo.registrarManual({
        casoId: 'X-2',
        status: 'falhou',
        resultadoObtido: 'botão não respondeu',
        observacoes: '',
        evidenciaTexto: 'screenshot mental',
      })
    );
    const ultimo = await firstValueFrom(repo.obterUltimo('X-2'));
    expect(ultimo?.status).toBe('falhou');
    expect(ultimo?.resultadoObtido).toContain('botão');
  });
});
