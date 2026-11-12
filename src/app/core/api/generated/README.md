# Tipos gerados (OpenAPI)

Os arquivos nesta pasta são gerados automaticamente a partir do **OpenAPI (Swagger)** do backend. **Não edite manualmente.**

## Como gerar/atualizar

Na raiz do projeto:

```bash
npm run generate:api
```

- Baixa o spec de: `https://gtsbackend.azurewebsites.net/swagger/v1/swagger.json`
- Regenera `api-types.ts` com os tipos TypeScript (paths, components/schemas)

## Quando rodar

- **Sempre que o backend mudar**: novos endpoints, DTOs alterados, novos parâmetros ou respostas.
- **Após clone do repositório**: se a pasta `generated/` não existir ou estiver desatualizada.
- **Em CI (opcional)**: pode rodar `generate:api` e comparar diff para garantir que o front está alinhado ao contrato.

## Uso no código

Importe tipos do barrel `core/api` ou diretamente de `core/api/generated`:

```ts
import type { ApiSchemas, components } from '../core/api/generated';

// DTOs do backend (request/response)
type EstacionamentoPost = ApiSchemas['EstacionamentoPostInput'];
type LoginBody = ApiSchemas['LoginInput'];

// No ApiService
this.api.post<ApiSchemas['EstacionamentoPostInput']>('Estacionamento', body);
this.api.get<...>('Estacionamento/' + id);
```

O **ApiService** (`get<T>`, `post<T>`, etc.) já está preparado para usar esses tipos no genérico `T`.
