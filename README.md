# Fyberlink ISP

MVP interno API-first para operação de provedor de internet.

## Stack

- API: Node.js, TypeScript, Express e Prisma
- Web: Next.js e Tailwind CSS
- Banco: PostgreSQL
- Sessão web: cookie JWT `HttpOnly`, `Secure` em produção e `SameSite=Lax`
- Runtime esperado: Node.js 22 LTS ou 24 (>=22 <25)

## Segurança e segredos

- Não versione `apps/api/.env`, `.env.local`, chaves, certificados nem arquivos de upload.
- `.gitignore` já ignora `.env`, `.env.*`, `*.pem`, `*.key` e `uploads/`; `.env.example` é apenas um modelo sem credenciais válidas.
- Nunca use `docker-compose.yml` como configuração de produção: as credenciais ali são exclusivamente locais.
- O login exige senha com pelo menos 12 caracteres. O administrador inicial deve usar uma senha aleatória com pelo menos 16 caracteres.
- O seed não cria usuários demo. Só cria um administrador se `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` estiverem configuradas; uma execução posterior não troca a senha existente.
- Em produção, a API exige `WEB_ORIGINS` HTTPS e um `JWT_SECRET` aleatório com pelo menos 64 caracteres.
- Sessões são entregues apenas em cookie `HttpOnly`; não ficam acessíveis ao JavaScript do navegador.
- CORS e mutações autenticadas por cookie validam a origem permitida. O login tem rate limit e usuários/perfis inativos não autenticam.
- A Auditoria é somente leitura pela API pública. Eventos são escritos pelos fluxos internos da aplicação.

Antes de inicializar o Git, confira que o arquivo local não será adicionado:

```powershell
git check-ignore -v apps/api/.env
git status --short
```

Se algum segredo já tiver sido commitado anteriormente, removê-lo do arquivo atual não é suficiente: revogue/troque o segredo e limpe o histórico Git antes de publicar.

## Desenvolvimento local

Pré-requisitos: Node.js 22 ou 24, npm e PostgreSQL.

1. Instale dependências com `npm install`.
2. Inicie PostgreSQL local ou use `docker compose up -d postgres` apenas para desenvolvimento, definindo `POSTGRES_PASSWORD` no ambiente local.
3. Copie `apps/api/.env.example` para `apps/api/.env`, substitua a senha local na URL e defina um `JWT_SECRET` aleatório com pelo menos 32 caracteres.
4. Rode `npm --workspace apps/api run prisma:generate` e `npm --workspace apps/api run prisma:migrate`.
5. Para criar dados-base (papéis, permissões e templates), rode `npm --workspace apps/api run prisma:seed`.
6. Para criar o primeiro administrador local, configure `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` no ambiente do comando de seed. Use senha com 16 ou mais caracteres. Essas variáveis não devem ser commitadas.
7. Inicie `npm run dev:api` e `npm run dev:web`, em terminais separados. Acesse `http://localhost:3000/login`.

O seed pode criar/atualizar os dados de configuração do MVP. Não o execute contra banco com dados operacionais que queira preservar sem revisar o script primeiro.

## Railway: arquitetura

Crie um projeto Railway com três serviços:

1. **PostgreSQL** provisionado pela Railway.
2. **API**, conectada ao repositório com Root Directory na raiz do monorepo.
3. **Web**, conectada ao mesmo repositório e também com Root Directory na raiz.

É um monorepo npm compartilhado, então não defina `apps/api` ou `apps/web` como Root Directory: os comandos de workspace e o `package-lock.json` ficam na raiz. Use comandos específicos por serviço. A Railway documenta esse modelo em [monorepos](https://docs.railway.com/guides/monorepo), [PostgreSQL](https://docs.railway.com/guides/postgresql), [variáveis](https://docs.railway.com/guides/variables) e [health checks](https://docs.railway.com/guides/healthchecks).

## Railway: serviço API

Build Command:

```sh
npm --workspace apps/api run build
```

Pre-deploy Command:

```sh
npm --workspace apps/api run prisma:deploy
```

Start Command:

```sh
npm --workspace apps/api run start
```

Healthcheck Path: `/health`.

Configure estas variáveis no serviço API:

- `DATABASE_URL`: referência à variável `DATABASE_URL` do serviço PostgreSQL, por exemplo `${{Postgres.DATABASE_URL}}` (use o nome real do serviço).
- `JWT_SECRET`: segredo aleatório criptograficamente forte com pelo menos 64 caracteres; gere, por exemplo, 64 bytes aleatórios em hexadecimal (128 caracteres hex). Não reutilize o segredo local.
- `NODE_ENV=production`
- `WEB_ORIGINS`: origem HTTPS exata do serviço web, sem caminho, por exemplo `https://<dominio-web>`.
- `TRUST_PROXY=true` para que rate limiting registre o IP encaminhado pela Railway.
- `PORT` é fornecida pela Railway; não fixe a porta de produção.

### Bootstrap inicial (executar uma única vez)

Depois que PostgreSQL e API estiverem provisionados, adicione temporariamente ao serviço API:

- `INITIAL_ADMIN_EMAIL`: e-mail real que será usado pelo administrador.
- `INITIAL_ADMIN_PASSWORD`: senha aleatória com pelo menos 16 caracteres.

Execute o seed uma única vez dentro do container da API, com as variáveis temporárias configuradas no serviço:

```sh
railway ssh --service API -- npm --workspace apps/api run prisma:seed
```

Use o nome real do serviço. Depois de confirmar o primeiro login, remova `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` das variáveis Railway. O seed também cria perfis, permissões e templates; não o inclua no pre-deploy recorrente. Não grave os valores no repositório.

### Criar colaboradores

Para criar um técnico ou colaborador sem inserir senha diretamente no banco, defina temporariamente `USER_EMAIL`, `USER_NAME`, `USER_ROLE` e `USER_PASSWORD` no ambiente Railway da API. A senha deve ter 16 a 72 bytes. Execute dentro do container pela Railway CLI:

```sh
railway ssh --service API -- npm --workspace apps/api run user:create
```

Use o nome/ID real do serviço da API. Perfis aceitos: `MASTER_ADMIN`, `SUPERVISOR`, `COORDENADOR`, `DIRETORIA`, `TECNICO`, `FINANCEIRO`, `COMERCIAL` e `OPERADOR_CAIXA`. O comando não sobrescreve uma conta existente. Remova as quatro variáveis temporárias após a execução.

## Railway: serviço Web

Build Command:

```sh
npm --workspace apps/web run build
```

Start Command:

```sh
npm --workspace apps/web run start
```

Configure `NEXT_PUBLIC_API_URL` com a URL HTTPS pública da API antes do build, por exemplo `https://<dominio-api>`. O valor é incorporado ao bundle do navegador; alterar a variável exige novo build/deploy.

Gere domínios públicos HTTPS para Web e API. O banco deve permanecer privado e ser acessado pela referência interna da Railway. Se usar domínios próprios, prefira web e API em subdomínios do mesmo domínio registrável, compatível com o cookie `SameSite=Lax`; mantenha `WEB_ORIGINS` igual à origem exata do frontend.

## Após o deploy

1. Verifique `https://<dominio-api>/health`; deve responder `200` com `database: "ready"`.
2. Acesse `https://<dominio-web>/login` e autentique com a conta inicial.
3. Teste um usuário inativo, login inválido, permissões de técnico, Remoção, Checklists, upload de foto e filtros de Auditoria.
4. Configure backup automático do PostgreSQL e teste a restauração antes de inserir dados reais.
5. Monitore logs, uso de banco, limite de uploads e custos de armazenamento/rede.

As imagens de Remoção são comprimidas no navegador, mas ainda ficam armazenadas como Base64 no PostgreSQL. Para uso operacional com volume crescente, planeje armazenamento privado de objetos e mantenha no banco apenas a URL/chave do arquivo.
