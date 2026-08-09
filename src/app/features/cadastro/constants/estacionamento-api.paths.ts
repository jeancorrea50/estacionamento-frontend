/**
 * Sufixos após `{API_BASE}/Estacionamento` — contrato OpenAPI (paths, não ações /Buscar|/Gravar).
 */
export const EstacionamentoPaths = {
  /** GET lista/paginada: query no root `/api/Estacionamento` */
  buscar: '',
  /** GET por id: `/api/Estacionamento/{id}` */
  obterPorId: (id: number) => `${id}`,
  gravar: '',
  alterar: '',
  /** PUT `/api/Estacionamento/conexao` — vínculo multi-tenant (Admin). */
  atualizarConexao: 'conexao',
  /** DELETE `/api/Estacionamento/{id}` */
  excluir: (id: number) => `${id}`,
  /** GET — `/api/Estacionamento/buscar-fotos/{id}` */
  buscarFotos: (id: number) => `buscar-fotos/${id}`,
  /** POST multipart: `/api/Estacionamento/upload-fotos` */
  uploadFotos: 'upload-fotos',
  /** DELETE — `/api/Estacionamento/deletar-fotos/{fotoId}` */
  deletarFoto: (fotoId: number) => `deletar-fotos/${fotoId}`,
} as const;
