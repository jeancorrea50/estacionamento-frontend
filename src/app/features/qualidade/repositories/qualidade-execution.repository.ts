import { Observable } from 'rxjs';
import type {
  QualidadeExecucaoRegistro,
  QualidadeExecucaoStorePayload,
  QualidadeStatus,
} from '../models/qualidade.models';

export interface QualidadeRegistroManualInput {
  casoId: string;
  status: QualidadeStatus;
  resultadoObtido: string;
  observacoes: string;
  evidenciaTexto: string;
  ambiente?: string;
  versaoApp?: string;
  responsavelLocal?: string;
}

/**
 * Abstração de persistência de execuções.
 * Fase 1: implementação local. Fase 2: HTTP sem mudar consumidores.
 */
export abstract class QualidadeExecutionRepository {
  abstract carregar(): Observable<QualidadeExecucaoStorePayload>;
  abstract listarHistorico(casoId?: string): Observable<QualidadeExecucaoRegistro[]>;
  abstract obterUltimo(casoId: string): Observable<QualidadeExecucaoRegistro | null>;
  abstract registrarManual(input: QualidadeRegistroManualInput): Observable<QualidadeExecucaoRegistro>;
  abstract limparCaso(casoId: string): Observable<void>;
  abstract limparTudo(): Observable<void>;
}
