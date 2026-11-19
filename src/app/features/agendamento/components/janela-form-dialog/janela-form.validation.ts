import { GRANULARIDADE_MAX } from '../../models/janela-agendamento.models';
import { ExcecaoForm, FaixaForm, JanelaFormAba, JanelaFormState, PeriodicidadeForm } from './janela-form.state';

export interface JanelaFormErro {
  aba: JanelaFormAba | 'cabecalho';
  mensagem: string;
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `HH:mm` → minutos desde 00:00; `null` se inválida. */
export function horaParaMinutos(hora: string): number | null {
  if (!HORA_RE.test(hora)) return null;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Faixas inválidas ou sobrepostas (mesma regra do backend: `ini < fimAnterior` conflita). */
export function validarFaixas(faixas: FaixaForm[]): string[] {
  const erros: string[] = [];
  if (!faixas.length) return ['Informe ao menos uma faixa de horário.'];

  const validas: Array<{ ini: number; fim: number }> = [];
  faixas.forEach((f, i) => {
    const ini = horaParaMinutos(f.horaInicio);
    const fim = horaParaMinutos(f.horaFim);
    if (ini == null || fim == null) {
      erros.push(`Faixa ${i + 1}: informe hora início e fim (HH:mm).`);
    } else if (fim <= ini) {
      erros.push(`Faixa ${i + 1}: a hora fim deve ser maior que a hora início.`);
    } else {
      validas.push({ ini, fim });
    }
  });

  const ordenadas = [...validas].sort((a, b) => a.ini - b.ini);
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].ini < ordenadas[i - 1].fim) {
      erros.push('Faixas de horário não podem se sobrepor.');
      break;
    }
  }
  return erros;
}

function vigenciasSobrepoem(a: PeriodicidadeForm, b: PeriodicidadeForm): boolean {
  const aFim = a.dataFim || '9999-12-31';
  const bFim = b.dataFim || '9999-12-31';
  return a.dataInicio <= bFim && b.dataInicio <= aFim;
}

function validarPeriodicidade(p: PeriodicidadeForm, n: number): string[] {
  const erros: string[] = [];
  const rotulo = `Periodicidade ${n}`;
  if (!p.dataInicio) erros.push(`${rotulo}: informe a data de início.`);
  if (p.dataInicio && p.dataFim && p.dataFim < p.dataInicio) {
    erros.push(`${rotulo}: o fim deve ser maior ou igual ao início.`);
  }
  if ((p.tipo === 2 || p.tipo === 3) && p.dias.length === 0) {
    erros.push(`${rotulo}: selecione ao menos um dia da semana.`);
  }
  if ((p.tipo === 4 || p.tipo === 5) && !(p.diaMes != null && p.diaMes >= 1 && p.diaMes <= 31)) {
    erros.push(`${rotulo}: dia do mês deve estar entre 1 e 31.`);
  }
  if (p.tipo === 5 && !(p.mes != null && p.mes >= 1 && p.mes <= 12)) {
    erros.push(`${rotulo}: selecione o mês.`);
  }
  return erros;
}

export function validarPeriodicidades(lista: PeriodicidadeForm[]): string[] {
  if (!lista.length) return ['Informe ao menos uma periodicidade.'];
  const erros = lista.flatMap((p, i) => validarPeriodicidade(p, i + 1));

  const ativas = lista.filter((p) => p.ativo && p.dataInicio);
  const conflito = ativas.some((a, i) => ativas.slice(i + 1).some((b) => vigenciasSobrepoem(a, b)));
  if (conflito) {
    erros.push('Periodicidades ativas da mesma janela não podem conflitar na vigência.');
  }
  return erros;
}

function validarExcecao(e: ExcecaoForm, n: number): string[] {
  const erros: string[] = [];
  const rotulo = `Exceção ${n}`;
  if (!e.data) erros.push(`${rotulo}: informe a data.`);

  const temIni = !!e.horaInicio;
  const temFim = !!e.horaFim;
  if (temIni !== temFim) {
    erros.push(`${rotulo}: informe hora início e fim, ou deixe ambas vazias (dia inteiro).`);
  } else if (temIni && temFim) {
    const ini = horaParaMinutos(e.horaInicio);
    const fim = horaParaMinutos(e.horaFim);
    if (ini == null || fim == null || fim <= ini) {
      erros.push(`${rotulo}: a hora fim deve ser maior que a hora início.`);
    }
  }
  if (e.tipo === 2 && !(e.vagasAjuste != null && e.vagasAjuste >= 0)) {
    erros.push(`${rotulo}: informe as vagas do ajuste de capacidade (0 ou mais).`);
  }
  return erros;
}

/** Valida o formulário inteiro; cada erro aponta a aba onde deve ser corrigido. */
export function validarJanelaForm(s: JanelaFormState): JanelaFormErro[] {
  const erros: JanelaFormErro[] = [];
  const add = (aba: JanelaFormErro['aba'], mensagens: string[]) =>
    mensagens.forEach((mensagem) => erros.push({ aba, mensagem }));

  const nome = s.nome.trim();
  if (!nome) add('cabecalho', ['Nome da janela é obrigatório.']);
  if (nome.length > 150) add('cabecalho', ['Nome deve ter no máximo 150 caracteres.']);
  if (!s.dataVigenciaInicio) add('cabecalho', ['Início da vigência é obrigatório.']);
  if (s.dataVigenciaFim && s.dataVigenciaInicio && s.dataVigenciaFim < s.dataVigenciaInicio) {
    add('cabecalho', ['Fim da vigência deve ser maior ou igual ao início.']);
  }

  const max = GRANULARIDADE_MAX[s.granularidadeUnidade];
  if (!(s.granularidadeValor != null && s.granularidadeValor >= 1 && s.granularidadeValor <= max)) {
    const unidade = s.granularidadeUnidade === 1 ? 'horas' : 'minutos';
    add('horarios', [`Granularidade em ${unidade} deve estar entre 1 e ${max}.`]);
  }
  add('horarios', validarFaixas(s.faixas));

  if (!(s.vagasPorSlot != null && s.vagasPorSlot >= 1)) {
    add('capacidade', ['Vagas por slot devem ser maiores que zero.']);
  }

  add('excecoes', s.excecoes.flatMap((e, i) => validarExcecao(e, i + 1)));
  add('periodicidade', validarPeriodicidades(s.periodicidades));
  return erros;
}
