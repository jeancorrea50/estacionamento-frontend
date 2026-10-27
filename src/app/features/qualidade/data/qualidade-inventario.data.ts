import type { QualidadeModulo } from '../models/qualidade.models';

/**
 * Inventário derivado do código real (rotas, menus, services, specs).
 * Não inventa módulos ausentes; gaps ficam explícitos em tipoCobertura/notas.
 */
export const QUALIDADE_INVENTARIO: QualidadeModulo[] = [
  {
    id: 'mod-auth',
    titulo: 'Autenticação e sessão',
    telas: [
      {
        id: 'tela-login',
        titulo: 'Login',
        rota: '/',
        funcionalidades: [
          {
            id: 'fn-login',
            titulo: 'Entrar no sistema',
            casos: [
              {
                id: 'AUTH-LOGIN-001',
                titulo: 'Login com credenciais válidas redireciona para /app',
                objetivo: 'Validar fluxo de autenticação e sessão JWT',
                preCondicoes: ['Usuário cadastrado', 'API /auth/Usuario/Login disponível'],
                passos: [
                  'Abrir rota de login',
                  'Informar usuário e senha válidos',
                  'Submeter formulário',
                ],
                resultadoEsperado: 'Sessão criada e redirecionamento para área autenticada',
                camada: 'frontend',
                severidade: 'critica',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/'],
                arquivos: ['src/app/features/login/', 'src/app/core/services/auth.service.ts'],
                endpoints: ['/api/auth/Usuario/Login'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-patio',
    titulo: 'Pátio / Movimentações',
    telas: [
      {
        id: 'tela-movimentacoes',
        titulo: 'Movimentações',
        rota: '/app/patio/movimentacoes',
        funcionalidades: [
          {
            id: 'fn-lista-mov',
            titulo: 'Lista, filtros e chips',
            casos: [
              {
                id: 'PATIO-MOV-001',
                titulo: 'Buscar movimentações com Em aberto',
                objetivo: 'Confirmar filtro somenteEmAberto alinhado à API EntradaSaida',
                preCondicoes: ['Estacionamento selecionado na sessão'],
                passos: [
                  'Abrir Movimentações',
                  'Marcar/desmarcar Em aberto',
                  'Clicar Buscar',
                  'Conferir lista e status',
                ],
                resultadoEsperado: 'Lista reflete somenteEmAberto enviado ao GET /EntradaSaida',
                camada: 'frontend',
                severidade: 'alta',
                tipoCobertura: 'hibrido',
                rotas: ['/app/patio/movimentacoes'],
                arquivos: [
                  'src/app/features/movimentos/pages/movimentos-page/movimentos-page.component.ts',
                  'src/app/features/movimentos/entrada-saida/entrada-saida.service.ts',
                ],
                endpoints: ['/api/EntradaSaida'],
                automacaoSpecPaths: [
                  'src/app/features/movimentos/entrada-saida/entrada-saida.service.spec.ts',
                  'src/app/features/movimentos/pages/movimentos-page/movimentos-page.component.spec.ts',
                ],
              },
              {
                id: 'PATIO-MOV-002',
                titulo: 'Exportar PDF respeita filtros e Em aberto',
                objetivo: 'PDF via MovimentacaoRelatorio com SomenteEmAberto e chips',
                preCondicoes: ['Registros visíveis na lista'],
                passos: [
                  'Aplicar chip Todos e Em aberto desmarcado',
                  'Exportar PDF',
                  'Conferir cabeçalho de filtros e linhas',
                ],
                resultadoEsperado: 'PDF contém os mesmos critérios da tela; sem Status Entrada forçado em Todos',
                camada: 'frontend',
                severidade: 'alta',
                tipoCobertura: 'hibrido',
                rotas: ['/app/patio/movimentacoes'],
                arquivos: [
                  'src/app/features/movimentos/pages/movimentos-page/movimentos-exportacao.util.ts',
                  'src/app/features/patio/services/movimentacao-relatorio.service.ts',
                ],
                endpoints: ['/api/MovimentacaoRelatorio'],
                automacaoSpecPaths: [
                  'src/app/features/movimentos/pages/movimentos-page/movimentos-exportacao.util.spec.ts',
                  'src/app/features/patio/pages/movimentacao-relatorio/movimentacao-relatorio-pdf.spec.ts',
                ],
              },
              {
                id: 'PATIO-MOV-003',
                titulo: 'Tempo no pátio na lista (entrada/saída)',
                objetivo: 'Exibir permanência calculada na UI operacional',
                preCondicoes: ['Movimento com saída ou em aberto'],
                passos: ['Abrir lista', 'Conferir coluna Tempo no pátio'],
                resultadoEsperado: 'Duração coerente com entrada/saída (mesmo critério do componente)',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/patio/movimentacoes'],
                arquivos: [
                  'src/app/features/movimentos/pages/movimentos-page/movimentos-page.component.ts',
                ],
              },
              {
                id: 'PATIO-MOV-004',
                titulo: 'E2E busca por placa (Playwright)',
                objetivo: 'Fluxo de placa documentado no e2e existente',
                preCondicoes: ['Playwright configurado; ambiente de teste'],
                passos: ['Executar npm run test:e2e fora do browser', 'Gerar artefato public/qa/playwright-summary.json'],
                resultadoEsperado: 'Artefato CI reflete o resultado real do spec e2e',
                camada: 'e2e',
                severidade: 'alta',
                tipoCobertura: 'automatizado',
                rotas: ['/app/patio/movimentacoes'],
                arquivos: ['tests/e2e/movimentos-placa.spec.ts'],
                automacaoSpecPaths: ['tests/e2e/movimentos-placa.spec.ts'],
              },
            ],
          },
          {
            id: 'fn-excedente',
            titulo: 'Excedente de acordo',
            casos: [
              {
                id: 'PATIO-EXC-001',
                titulo: 'Flag ehExcedente exibida na cobertura',
                objetivo: 'Validar badge Excedente quando API marca ehExcedente',
                preCondicoes: ['Movimento com ehExcedente=true no payload'],
                passos: ['Listar movimentos', 'Localizar linha excedente'],
                resultadoEsperado: 'Badge Excedente visível; sem inventar valor R$',
                camada: 'contrato',
                severidade: 'alta',
                tipoCobertura: 'sem_cobertura',
                endpoints: ['/api/EntradaSaida'],
                notas: 'Contrato atual expõe boolean; período dinâmico de excedente não é enviado pela API.',
              },
              {
                id: 'PATIO-EXC-002',
                titulo: 'Período dinâmico de excedente (capacidade de vagas)',
                objetivo:
                  'Validar regra: 2 vagas; 3ª entrada conta excedente até liberar vaga — se implementada no backend',
                preCondicoes: ['Acordo com 2 vagas', 'Ambiente de homologação'],
                passos: [
                  'Placa1 entra 09:00',
                  'Placa2 entra 09:10',
                  'Placa3 entra 09:20',
                  'Placa1 sai 09:30',
                  'Conferir ocupação e cobrança',
                ],
                resultadoEsperado:
                  'Se a regra vigente calcular intervalo: placa3 com ~10 min excedente. Se o backend só marcar ehExcedente na entrada, registrar divergência — não alterar o comportamento.',
                camada: 'manual',
                severidade: 'critica',
                tipoCobertura: 'sem_cobertura',
                notas:
                  'Bloqueado para automação no front: GET MovimentacaoRelatorio não envia tempo/período de excedente. Validar no backend antes de automatizar.',
              },
            ],
          },
        ],
      },
      {
        id: 'tela-entrada-saida',
        titulo: 'Entrada e Saída (portaria)',
        rota: '/app/patio/entrada-saida',
        funcionalidades: [
          {
            id: 'fn-registro-rapido',
            titulo: 'Registro rápido / buscar por placa',
            casos: [
              {
                id: 'PATIO-ES-001',
                titulo: 'Buscar por placa preenche motorista/veículo',
                objetivo: 'Mapper e alerta de vagas do acordo',
                preCondicoes: ['Placa cadastrada'],
                passos: ['Informar placa', 'Aguardar lookup', 'Conferir campos e alerta de acordo'],
                resultadoEsperado: 'Dados mapeados; vagas ocupadas/contratadas se a API enviar',
                camada: 'frontend',
                severidade: 'alta',
                tipoCobertura: 'hibrido',
                rotas: ['/app/patio/entrada-saida'],
                arquivos: [
                  'src/app/features/movimentos/mappers/entrada-saida-buscar-por-placa.mapper.ts',
                ],
                endpoints: ['/api/EntradaSaida/buscar-por-placa'],
                automacaoSpecPaths: [
                  'src/app/features/movimentos/mappers/entrada-saida-buscar-por-placa.mapper.spec.ts',
                  'src/app/features/movimentos/entrada-saida/entrada-saida-form.component.spec.ts',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-rel-mov',
        titulo: 'Relatório de Movimentações',
        rota: '/app/patio/movimentacoes/relatorio',
        funcionalidades: [
          {
            id: 'fn-rel-pdf',
            titulo: 'Consulta e PDF cliente',
            casos: [
              {
                id: 'PATIO-REL-001',
                titulo: 'PDF: permanência derivada e valor sem inventar R$',
                objetivo: 'Colunas Excedente/Valor/Permanência conforme contrato',
                preCondicoes: ['Filtros válidos'],
                passos: ['Buscar', 'Exportar PDF', 'Conferir Permanência e Valor'],
                resultadoEsperado:
                  'Permanência preenchida (API ou entrada/saída). Valor "—" se API não enviar.',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'automatizado',
                rotas: ['/app/patio/movimentacoes/relatorio'],
                arquivos: [
                  'src/app/features/patio/pages/movimentacao-relatorio/movimentacao-relatorio-pdf.ts',
                ],
                endpoints: ['/api/MovimentacaoRelatorio'],
                automacaoSpecPaths: [
                  'src/app/features/patio/pages/movimentacao-relatorio/movimentacao-relatorio-pdf.spec.ts',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-financeiro',
    titulo: 'Financeiro',
    telas: [
      {
        id: 'tela-faturamento',
        titulo: 'Faturamento',
        rota: '/app/financeiro/faturamento',
        funcionalidades: [
          {
            id: 'fn-faturas',
            titulo: 'Faturas e itens',
            casos: [
              {
                id: 'FIN-FAT-001',
                titulo: 'Mapper de fatura e valorExcedente',
                objetivo: 'Contrato de itens de fatura sem inventar campos',
                preCondicoes: ['Payload de fatura real ou fixture de teste'],
                passos: ['Rodar specs de mapper/service', 'Conferir mapeamento'],
                resultadoEsperado: 'valorExcedente e ehExcedente coerentes com DTO',
                camada: 'contrato',
                severidade: 'alta',
                tipoCobertura: 'automatizado',
                arquivos: [
                  'src/app/features/financeiro/mappers/fatura.mapper.ts',
                  'src/app/features/financeiro/services/fatura.service.ts',
                ],
                endpoints: ['/api/financeiro/Fatura'],
                automacaoSpecPaths: [
                  'src/app/features/financeiro/mappers/fatura.mapper.spec.ts',
                  'src/app/features/financeiro/services/fatura.service.spec.ts',
                ],
              },
            ],
          },
          {
            id: 'fn-config-cobranca',
            titulo: 'Configuração de cobrança / acordo',
            casos: [
              {
                id: 'FIN-CFG-001',
                titulo: 'Acordo: vagas mensais e tipo cobrança excedente',
                objetivo: 'Payload de acordo alinhado ao Swagger',
                preCondicoes: ['Perfil com acesso à config'],
                passos: ['Abrir Config. cobrança', 'Editar acordo', 'Salvar'],
                resultadoEsperado: 'vagas* e tipoCobrancaExcedente persistidos via API',
                camada: 'frontend',
                severidade: 'alta',
                tipoCobertura: 'hibrido',
                rotas: ['/app/financeiro/faturamento/cobranca'],
                endpoints: ['/api/financeiro/ConfiguracaoCobranca'],
                automacaoSpecPaths: [
                  'src/app/features/financeiro/mappers/configuracao-cobranca.mapper.spec.ts',
                  'src/app/features/financeiro/services/configuracao-cobranca.service.spec.ts',
                  'src/app/features/financeiro/pages/faturamento-page/config-cobranca/config-cobranca-acordo.util.spec.ts',
                ],
              },
            ],
          },
          {
            id: 'fn-pagamentos',
            titulo: 'Pagamentos',
            casos: [
              {
                id: 'FIN-PAG-001',
                titulo: 'Service/mapper de pagamento',
                objetivo: 'Cobertura unitária existente',
                preCondicoes: [],
                passos: ['Executar specs via npm test', 'Publicar vitest-summary.json'],
                resultadoEsperado: 'Artefato CI reflete resultado real',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'automatizado',
                endpoints: ['/api/financeiro/pagamento'],
                automacaoSpecPaths: [
                  'src/app/features/financeiro/mappers/pagamento.mapper.spec.ts',
                  'src/app/features/financeiro/services/pagamento.service.spec.ts',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-cadastro',
    titulo: 'Cadastro',
    telas: [
      {
        id: 'tela-transportadoras',
        titulo: 'Transportadoras',
        rota: '/app/cadastro/transportadoras',
        funcionalidades: [
          {
            id: 'fn-trn',
            titulo: 'CRUD / listagem',
            casos: [
              {
                id: 'CAD-TRN-001',
                titulo: 'Service transportadora (unit)',
                objetivo: 'Contrato HTTP do service',
                preCondicoes: [],
                passos: ['npm test no spec do service'],
                resultadoEsperado: 'Spec verde no artefato Vitest',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'automatizado',
                endpoints: ['/api/Transportadora'],
                automacaoSpecPaths: [
                  'src/app/features/cadastro/services/transportadora.service.spec.ts',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-veiculos',
        titulo: 'Veículos',
        rota: '/app/cadastro/veiculos',
        funcionalidades: [
          {
            id: 'fn-vei',
            titulo: 'Listagem / placa',
            casos: [
              {
                id: 'CAD-VEI-001',
                titulo: 'Service veículo + util placa BR',
                objetivo: 'Máscara/normalização e service',
                preCondicoes: [],
                passos: ['Rodar specs placa-br e veiculo.service'],
                resultadoEsperado: 'Artefato Vitest com resultados reais',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'automatizado',
                automacaoSpecPaths: [
                  'src/app/features/cadastro/services/veiculo.service.spec.ts',
                  'src/app/features/cadastro/utils/placa-br.spec.ts',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-estacionamento-form',
        titulo: 'Formulário estacionamento',
        rota: '/app/cadastro/estacionamentos',
        funcionalidades: [
          {
            id: 'fn-est-form',
            titulo: 'Mapper do formulário',
            casos: [
              {
                id: 'CAD-EST-001',
                titulo: 'Mapper estacionamento-form',
                objetivo: 'Payload alinhado ao DTO',
                preCondicoes: [],
                passos: ['Rodar estacionamento-form.mapper.spec'],
                resultadoEsperado: 'Spec real no artefato',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'automatizado',
                automacaoSpecPaths: [
                  'src/app/features/cadastro/pages/estacionamento-form/estacionamento-form.mapper.spec.ts',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-convites',
        titulo: 'Convites transportadora',
        rota: '/app/cadastro/transportadoras/convites',
        funcionalidades: [
          {
            id: 'fn-convite',
            titulo: 'Fluxo de convite',
            casos: [
              {
                id: 'CAD-CONV-001',
                titulo: 'Checklist manual: convite e vínculo',
                objetivo: 'Fluxo público + cadastro sem automação dedicada',
                preCondicoes: ['Token de convite válido em homolog'],
                passos: [
                  'Gerar convite',
                  'Abrir link público',
                  'Completar cadastro',
                  'Conferir vínculo no pátio',
                ],
                resultadoEsperado: 'Transportadora vinculada conforme API ConviteTransportadora',
                camada: 'manual',
                severidade: 'alta',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/convite/transportadora/:token'],
                endpoints: ['/api/ConviteTransportadora', '/api/public/convite-transportadora'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-agendamento',
    titulo: 'Agendamento',
    telas: [
      {
        id: 'tela-agendamento',
        titulo: 'Agendamentos',
        rota: '/app/agendamento',
        funcionalidades: [
          {
            id: 'fn-ag',
            titulo: 'CRUD / confirmação',
            casos: [
              {
                id: 'AG-001',
                titulo: 'Checklist manual: criar e cancelar agendamento',
                objetivo: 'Cobrir gap sem spec dedicado na feature',
                preCondicoes: ['Estacionamento e horário configurados'],
                passos: ['Criar', 'Editar', 'Cancelar', 'Confirmar entrada se aplicável'],
                resultadoEsperado: 'Status e datas coerentes com /api/Agendamento',
                camada: 'manual',
                severidade: 'alta',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/agendamento'],
                endpoints: ['/api/Agendamento'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-admin',
    titulo: 'Administração',
    telas: [
      {
        id: 'tela-usuario',
        titulo: 'Usuários',
        rota: '/app/administracao/usuario',
        funcionalidades: [
          {
            id: 'fn-usr',
            titulo: 'Gestão de usuários',
            casos: [
              {
                id: 'ADM-USR-001',
                titulo: 'Checklist manual: listar e permissões usuario.visualizar',
                objetivo: 'Guard permissionGuard na rota',
                preCondicoes: ['Perfil com usuario.visualizar'],
                passos: ['Acessar rota', 'Listar', 'Criar/editar se permitido'],
                resultadoEsperado: 'Acesso bloqueado sem permissão; CRUD via API Usuario',
                camada: 'manual',
                severidade: 'alta',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/administracao/usuario'],
                endpoints: ['/api/auth/Usuario'],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-permissao',
        titulo: 'Permissão / perfis',
        rota: '/app/administracao/permissao',
        funcionalidades: [
          {
            id: 'fn-perm',
            titulo: 'Perfis e árvore de permissões',
            casos: [
              {
                id: 'ADM-PERM-001',
                titulo: 'Checklist manual: alterar permissões de perfil',
                objetivo: 'ACL de menus/ações',
                preCondicoes: ['Admin'],
                passos: ['Abrir Permissão', 'Alterar árvore', 'Salvar', 'Re-login e conferir menu'],
                resultadoEsperado: 'Menus filtrados conforme SessionAccess',
                camada: 'manual',
                severidade: 'critica',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/administracao/permissao'],
                endpoints: ['/api/auth/Permissao'],
                automacaoSpecPaths: [
                  'src/app/core/services/session-access.service.spec.ts',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-ecossistema',
        titulo: 'Ecossistema',
        rota: '/app/administracao/ecossistema',
        funcionalidades: [
          {
            id: 'fn-eco',
            titulo: 'Mapa funcional',
            casos: [
              {
                id: 'ADM-ECO-001',
                titulo: 'Abrir mapa do ecossistema',
                objetivo: 'Tela de documentação interativa carrega',
                preCondicoes: ['Usuário autenticado com menu'],
                passos: ['Navegar para Ecossistema', 'Interagir com nós'],
                resultadoEsperado: 'Mapa renderiza a partir dos dados locais do feature',
                camada: 'frontend',
                severidade: 'baixa',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/administracao/ecossistema'],
                notas: 'Renderizar ≠ validar regras de negócio dos módulos ligados.',
              },
            ],
          },
        ],
      },
      {
        id: 'tela-qualidade',
        titulo: 'Qualidade e Testes',
        rota: '/app/administracao/qualidade',
        funcionalidades: [
          {
            id: 'fn-qa',
            titulo: 'Central de qualidade',
            casos: [
              {
                id: 'ADM-QA-001',
                titulo: 'Registrar resultado manual com evidência',
                objetivo: 'Histórico local sanitizado; sem marcar aprovado sem evidência',
                preCondicoes: [],
                passos: [
                  'Abrir esta tela',
                  'Selecionar um caso',
                  'Registrar Aprovado com evidência',
                  'Exportar relatório',
                ],
                resultadoEsperado: 'Status persistido localmente; aviso de não sincronização',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'hibrido',
                rotas: ['/app/administracao/qualidade'],
                arquivos: [
                  'src/app/features/qualidade/repositories/local-qualidade-execution.repository.ts',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-gerenciamento',
    titulo: 'Gerenciamento',
    telas: [
      {
        id: 'tela-menu-admin',
        titulo: 'Menu',
        rota: '/app/gerenciamento/menu',
        funcionalidades: [
          {
            id: 'fn-menu',
            titulo: 'CRUD de menus',
            casos: [
              {
                id: 'GER-MENU-001',
                titulo: 'Checklist: publicar submenu Qualidade no backend',
                objetivo: 'Seed idempotente alinhado ao Ecossistema',
                preCondicoes: ['Admin role'],
                passos: ['Abrir Gerenciamento > Menu', 'Aguardar seed', 'Conferir submenu'],
                resultadoEsperado: 'Rota /app/administracao/qualidade no menu do servidor',
                camada: 'manual',
                severidade: 'media',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/gerenciamento/menu'],
                endpoints: ['/api/auth/Menu'],
              },
            ],
          },
        ],
      },
      {
        id: 'tela-banco',
        titulo: 'Banco de dados',
        rota: '/app/gerenciamento/bancoDados',
        funcionalidades: [
          {
            id: 'fn-bd',
            titulo: 'Conexões (somente leitura de status via API)',
            casos: [
              {
                id: 'GER-BD-001',
                titulo: 'Checklist: listar conexões sem operação destrutiva em prod',
                objetivo: 'UI consome /BancoDadosConexao; migrations não estão neste repo',
                preCondicoes: ['Homolog'],
                passos: ['Listar', 'Testar conexão se disponível', 'Não migrar produção'],
                resultadoEsperado: 'Status exibido; sem scripts SQL neste frontend',
                camada: 'manual',
                severidade: 'critica',
                tipoCobertura: 'sem_cobertura',
                endpoints: ['/api/BancoDadosConexao'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-config',
    titulo: 'Configurações',
    telas: [
      {
        id: 'tela-parametros',
        titulo: 'Parâmetros',
        rota: '/app/configuracoes/parametros',
        funcionalidades: [
          {
            id: 'fn-param',
            titulo: 'Configuração do estacionamento / fuso',
            casos: [
              {
                id: 'CFG-001',
                titulo: 'Service EstacionamentoConfiguracao (unit)',
                objetivo: 'timeZoneId e parâmetros',
                preCondicoes: [],
                passos: ['Rodar spec do service'],
                resultadoEsperado: 'Resultado no artefato Vitest',
                camada: 'frontend',
                severidade: 'media',
                tipoCobertura: 'automatizado',
                endpoints: ['/api/EstacionamentoConfiguracao'],
                automacaoSpecPaths: [
                  'src/app/features/configuracoes/services/estacionamento-configuracao.service.spec.ts',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-rede',
    titulo: 'Rede credenciada',
    telas: [
      {
        id: 'tela-rede',
        titulo: 'Mapa da rede',
        rota: '/app/rede-credenciada',
        funcionalidades: [
          {
            id: 'fn-rede',
            titulo: 'Mapa / estacionamentos',
            casos: [
              {
                id: 'REDE-001',
                titulo: 'Checklist: carregar mapa com estacionamentos da API',
                objetivo: 'GET Estacionamento/mapa',
                preCondicoes: ['Sessão válida'],
                passos: ['Abrir Rede credenciada', 'Conferir pins'],
                resultadoEsperado: 'Pontos vindos da API; sem inventar coordenadas',
                camada: 'manual',
                severidade: 'media',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/rede-credenciada'],
                endpoints: ['/api/Estacionamento/mapa'],
                automacaoSpecPaths: ['src/app/shared/maps/ponto-mapa.model.spec.ts'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-relatorios',
    titulo: 'Relatórios (módulo)',
    telas: [
      {
        id: 'tela-relatorios',
        titulo: 'Relatórios',
        rota: '/app/relatorios',
        funcionalidades: [
          {
            id: 'fn-rel-mod',
            titulo: 'Placeholder',
            casos: [
              {
                id: 'REL-001',
                titulo: 'Módulo em desenvolvimento',
                objetivo: 'Documentar gap: UI “Em desenvolvimento”',
                preCondicoes: [],
                passos: ['Abrir /app/relatorios'],
                resultadoEsperado: 'Estado parcial documentado; sem service de API próprio',
                camada: 'manual',
                severidade: 'baixa',
                tipoCobertura: 'sem_cobertura',
                rotas: ['/app/relatorios'],
                notas: 'Não tratar renderização do placeholder como validação funcional.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mod-core',
    titulo: 'Core / shared (utilitários)',
    telas: [
      {
        id: 'tela-utils',
        titulo: 'Utilitários testados',
        funcionalidades: [
          {
            id: 'fn-utils',
            titulo: 'Specs de suporte',
            casos: [
              {
                id: 'CORE-001',
                titulo: 'Utils e shared com cobertura unitária',
                objetivo: 'chunk-load, local-iso, tipo-carga, chave-pix, diarias, kpi',
                preCondicoes: [],
                passos: ['npm test nos specs listados'],
                resultadoEsperado: 'Artefato Vitest com status real por arquivo',
                camada: 'frontend',
                severidade: 'baixa',
                tipoCobertura: 'automatizado',
                automacaoSpecPaths: [
                  'src/app/app.spec.ts',
                  'src/app/core/utils/chunk-load-recovery.spec.ts',
                  'src/app/shared/utils/local-iso-datetime.spec.ts',
                  'src/app/shared/models/tipo-carga.spec.ts',
                  'src/app/features/cadastro/utils/chave-pix-format.spec.ts',
                  'src/app/features/cadastro/services/endereco-geolocalizacao.service.spec.ts',
                  'src/app/features/movimentos/utils/calcular-diarias.spec.ts',
                  'src/app/features/movimentos/pages/movimentos-page/kpi-tendencia.util.spec.ts',
                  'src/app/features/financeiro/pages/faturamento-page/config-cobranca/faturamento-config-cobranca.helpers.spec.ts',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export function listarTodosCasosQualidade(): {
  caso: import('../models/qualidade.models').QualidadeCaso;
  moduloId: string;
  moduloTitulo: string;
  telaId: string;
  telaTitulo: string;
  funcionalidadeId: string;
  funcionalidadeTitulo: string;
}[] {
  const out: ReturnType<typeof listarTodosCasosQualidade> = [];
  for (const mod of QUALIDADE_INVENTARIO) {
    for (const tela of mod.telas) {
      for (const fn of tela.funcionalidades) {
        for (const caso of fn.casos) {
          out.push({
            caso,
            moduloId: mod.id,
            moduloTitulo: mod.titulo,
            telaId: tela.id,
            telaTitulo: tela.titulo,
            funcionalidadeId: fn.id,
            funcionalidadeTitulo: fn.titulo,
          });
        }
      }
    }
  }
  return out;
}
