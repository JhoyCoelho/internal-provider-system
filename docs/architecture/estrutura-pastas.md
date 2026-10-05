# Estrutura de pastas sugerida

A estrutura abaixo separa claramente a API, as regras de negócio, a camada de infraestrutura e o frontend. O objetivo é permitir que o sistema cresça em módulos isolados, mantendo API-first e fácil integração futura com ERP/CRM.

```text
sistema-interno/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   └── env.ts
│   │   │   ├── lib/
│   │   │   │   ├── jwt.ts
│   │   │   │   └── prisma.ts
│   │   │   ├── middleware/
│   │   │   │   ├── authMiddleware.ts
│   │   │   │   └── rbacMiddleware.ts
│   │   │   ├── routes/
│   │   │   │   └── auth.routes.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   └── auth.controller.ts
│   │   │   │   ├── usuarios/
│   │   │   │   │   └── usuarios.service.ts
│   │   │   │   ├── ordens-remocao/
│   │   │   │   │   ├── remocao.service.ts
│   │   │   │   │   └── remocao.controller.ts
│   │   │   │   ├── checklists/
│   │   │   │   │   ├── checklist.service.ts
│   │   │   │   │   └── checklist.controller.ts
│   │   │   │   ├── caixa/
│   │   │   │   │   ├── caixa.service.ts
│   │   │   │   │   └── caixa.controller.ts
│   │   │   │   └── auditoria/
│   │   │   │       ├── auditoria.service.ts
│   │   │   │       └── auditoria.controller.ts
│   │   │   ├── shared/
│   │   │   │   ├── errors/
│   │   │   │   ├── utils/
│   │   │   │   ├── validators/
│   │   │   │   └── logger.ts
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   ├── lib/
│       │   ├── styles/
│       │   └── types/
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── architecture/
│   │   └── estrutura-pastas.md
│   └── database/
│       └── schema.sql
├── package.json
├── tsconfig.base.json
├── .gitignore
├── README.md
└── .eslintrc.json
``` 

## Convenções principais

- API-first: toda lógica do negócio fica na API.
- Serviços por módulo: cada funcionalidade tem serviço e controller isolados.
- RBAC centralizado: permissões e perfis em um módulo bem definido.
- UUID v4: todas as entidades de domínio devem possuir id do tipo UUID.
- Auditoria: toda escrita crítica deve disparar log no módulo de auditoria.
