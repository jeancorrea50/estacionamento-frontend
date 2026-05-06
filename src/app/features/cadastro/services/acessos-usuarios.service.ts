import { Injectable, inject } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import { UsuarioApiService } from '../../../core/api/services/usuario-api.service';
import type {
  RegisterInputRegister,
  RegisterInputUpdate,
  UsuarioDetalheOutput,
  UsuarioOutput
} from '../../../core/api/types/usuario-api.types';
import { unwrapServiceResult } from '../../../core/api/utils/service-result.util';

export const USUARIO_ENDPOINT_NAO_DISPONIVEL = 'Não foi possível criar o usuário com os dados informados.';
export const USUARIO_EDITAR_ENDPOINT_NAO_DISPONIVEL = 'Não foi possível alterar o usuário.';

/** Modelo de item de listagem (UI legada e Gerenciamento). */
export interface UsuarioListItem {
  id?: string;
  nome?: string | null;
  email?: string | null;
  userName?: string | null;
  emailOuLogin?: string | null;
  tipo?: string | null;
  ativo?: boolean;
  perfil?: string | null;
  role?: string | null;
  EstacionamentoId?: number | null;
  estacionamentoId?: number | null;
  Estacionamento?: string | null;
  estacionamento?: string | null;
  cpf?: string;
}

export interface LoginInput {
  userName: string;
  password: string;
}

export interface UsuarioCreateInput {
  id?: string;
  nome?: string;
  email?: string;
  login?: string;
  senha?: string;
  confirmarSenha?: string;
  cpf?: string;
  ativo?: boolean;
  perfilId?: string;
  perfilNome?: string;
  EstacionamentoId?: number;
  transportadoraId?: number;
  tipoPessoa?: 1 | 2;
  pessoaId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AcessosUsuariosService {
  private api = inject(UsuarioApiService);

  private mapOutputToListItem(u: UsuarioOutput): UsuarioListItem {
    const raw = u as UsuarioOutput & {
      estacionamentoId?: number | null;
      estacionamento?: string | null;
      Estacionamento?: string | null;
    };
    return {
      id: u.id != null ? String(u.id) : undefined,
      nome: u.nome,
      userName: u.userName,
      email: u.email,
      emailOuLogin: (u.email?.trim() || u.userName?.trim() || null) as string | null,
      ativo: true,
      role: u.role,
      perfil: u.role,
      EstacionamentoId: u.EstacionamentoId ?? raw.estacionamentoId ?? null,
      estacionamentoId: raw.estacionamentoId ?? u.EstacionamentoId ?? null,
      estacionamento: raw.estacionamento ?? raw.Estacionamento ?? null,
      Estacionamento: raw.Estacionamento ?? raw.estacionamento ?? null
    };
  }

  /**
   * Listagem: sempre `GET /api/auth/Usuario` (Swagger v1).
   * O parâmetro `termo` só filtra em memória — a API não expõe query de busca nesse GET.
   */
  buscar(termo?: string): Observable<unknown> {
    return this.api.listar().pipe(
      map((list) => {
        let items = (list ?? []).map((u) => this.mapOutputToListItem(u));
        const t = (termo ?? '').trim().toLowerCase();
        if (t) {
          items = items.filter(
            (i) =>
              (i.nome?.toLowerCase().includes(t) ?? false) ||
              (i.userName?.toLowerCase().includes(t) ?? false) ||
              (i.email?.toLowerCase().includes(t) ?? false) ||
              (i.emailOuLogin?.toLowerCase().includes(t) ?? false) ||
              (i.perfil?.toLowerCase().includes(t) ?? false) ||
              (i.role?.toLowerCase().includes(t) ?? false)
          );
        }
        return items;
      })
    );
  }

  /**
   * Detalhe: GET /api/auth/Usuario/{id}.
   * Expõe também shape plano usado em formulários legados (`nome`, `emailOuLogin`, `cpf`).
   */
  obterPorId(id: string): Observable<unknown> {
    return this.api.obterPorId(id).pipe(
      map((d) => {
        const p = d.pessoa;
        return {
          ...d,
          nome: p?.nome,
          emailOuLogin: d.email ?? d.userName,
          cpf: p?.cpf ?? (p as { documento?: string } | null)?.documento
        } as UsuarioDetalheOutput & {
          nome?: string;
          emailOuLogin?: string;
          cpf?: string;
        };
      })
    );
  }

  /** Registro: POST /api/auth/Usuario/Register */
  gravar(dto: unknown): Observable<unknown> {
    try {
      return this.api.register(this.toRegisterInput(dto as UsuarioCreateInput, false));
    } catch (e) {
      return throwError(() => (e instanceof Error ? e : new Error(String(e))));
    }
  }

  /** Alteração: PUT /api/auth/Usuario/{id} */
  alterar(dto: unknown): Observable<unknown> {
    const input = dto as UsuarioCreateInput;
    const id = input.id;
    if (!id) {
      return throwError(() => new Error('Id obrigatório para alterar usuário.'));
    }
    try {
      return this.api.atualizar(id, this.toRegisterInput(input, true));
    } catch (e) {
      return throwError(() => (e instanceof Error ? e : new Error(String(e))));
    }
  }

  /** Exclusão: DELETE /api/auth/Usuario/{id} */
  delete(id: string): Observable<unknown> {
    return this.api.excluir(id);
  }

  private inferTipoPessoa(input: UsuarioCreateInput): 1 | 2 {
    if (input.tipoPessoa === 1 || input.tipoPessoa === 2) {
      return input.tipoPessoa;
    }
    // Usuário sempre usa CPF no contrato atual da API.
    return 1;
  }

  private toRegisterInput(input: UsuarioCreateInput, isEdit: false): RegisterInputRegister;
  private toRegisterInput(input: UsuarioCreateInput, isEdit: true): RegisterInputUpdate;
  private toRegisterInput(input: UsuarioCreateInput, isEdit: boolean): RegisterInputRegister | RegisterInputUpdate {
    const email = String(input.email ?? '').trim();
    const login = String(input.login ?? '').trim();
    const userName = (login || email).trim();
    if (!userName) {
      throw new Error('Informe e-mail ou login (userName) para o usuário.');
    }

    const senha = String(input.senha ?? '').trim();
    const conf = String(input.confirmarSenha ?? input.senha ?? '').trim();
    if (!isEdit) {
      if (!senha) {
        throw new Error('Senha é obrigatória no cadastro.');
      }
      if (senha !== conf) {
        throw new Error('Senha e confirmar senha devem ser iguais.');
      }
    } else {
      if (senha || conf) {
        if (senha !== conf) {
          throw new Error('Senha e confirmar senha devem ser iguais.');
        }
      }
    }

    const nomePessoa = String(input.nome ?? '').trim();
    /** API valida CPF sem máscara; enviar só dígitos evita 400 por formato. */
    const cpfDigits = String(input.cpf ?? '')
      .trim()
      .replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      throw new Error('Informe CPF válido com 11 dígitos.');
    }
    if (!nomePessoa) {
      throw new Error('Informe o nome (pessoa).');
    }

    const EstacionamentoId =
      typeof input.EstacionamentoId === 'number' && Number.isFinite(input.EstacionamentoId)
        ? input.EstacionamentoId
        : 0;

    const perfilNome = String(input.perfilNome ?? input.perfilId ?? '').trim();
    if (!perfilNome) {
      throw new Error('Selecione o perfil (name).');
    }

    const pessoaId =
      typeof input.pessoaId === 'number' && Number.isFinite(input.pessoaId) ? input.pessoaId : 0;
    const tipoPessoa = this.inferTipoPessoa(input);

    const base: RegisterInputUpdate = {
      userName,
      EstacionamentoId,
      pessoa: {
        id: pessoaId,
        nome: nomePessoa,
        cpf: cpfDigits,
        tipoPessoa
      },
      perfil: { name: perfilNome }
    };

    if (email) {
      base.email = email;
    }
    if (!isEdit) {
      return {
        ...base,
        password: senha,
        confirmPassword: conf
      } satisfies RegisterInputRegister;
    }
    if (senha) {
      return {
        ...base,
        password: senha,
        confirmPassword: conf
      };
    }
    return base;
  }

  /** Uso em testes e chamadas manuais ao envelope. */
  unwrapTest(body: unknown): unknown {
    return unwrapServiceResult(body);
  }
}
