# Dependency rules

Softtech Core is a modular monolith. A feature module owns its business behavior. NestJS, Prisma, and provider SDKs sit at the edges.

## Direction

```text
presentation → application → domain
```

Infrastructure implements ports that the application or domain defines. Application and domain code do not import infrastructure implementations, NestJS, Prisma, or provider SDKs.

The module file (`<feature>.module.ts`) is the composition root for that feature. It may import NestJS and wire handlers. That permission does not extend to files under `domain/` or `application/`.

## What each folder may import

| From              | Allowed                                                  | Not allowed                                                                            |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `domain/`         | Other types in the same domain                           | Application, infrastructure, presentation, `common/`, NestJS, Prisma, database drivers |
| `application/`    | Same-module domain, `common/` technical helpers          | NestJS, Prisma, infrastructure, presentation, platform, configuration                  |
| `presentation/`   | Same-module application, NestJS, `common/`               | Domain internals, infrastructure                                                       |
| `common/`         | Generic technical helpers                                | Business modules, platform, infrastructure, bootstrap                                  |
| `infrastructure/` | Drivers and configuration needed to implement an adapter | Business modules                                                                       |
| Another module    | That module's `index.ts`                                 | Its handlers, repositories, Prisma models, or other private files                      |

`platform/` holds shared product capabilities such as health. It is not a place for business rules. `common/` holds pagination, redaction, correlation ids, and the request-validation hook. It does not hold business policy.

Simple reads can stay a query plus a thin handler. They do not need entities, value objects, or repositories unless those types protect a real invariant.

## Enforcement

`apps/api/.dependency-cruiser.cjs` encodes the table above for production source. Spec files are excluded because they are allowed to assemble the process under test. Run:

```bash
pnpm check:architecture
```

The API test `src/architecture/boundaries.spec.ts` builds a temporary module tree with one legal module and several illegal imports, then expects the illegal edges to fail.

A public export belongs in `modules/<feature>/index.ts`. Today the generator exports the Nest module class only. Add an application service to that file when another module has a real reason to call it.

## Transactions and authorization

A command handler is the transaction boundary for its use case. The handler calls a port; the infrastructure adapter opens the Prisma transaction. HTTP controllers do not call Prisma and do not decide authorization.

`PrismaService`, Redis, storage, and email adapters live under `apps/api/src/infrastructure` and `apps/api/src/platform`. Feature handlers must take those capabilities through a port. They must not construct a client. There is no business module yet, so the generator still emits framework-free handlers only.

The web app must not import NestJS, Prisma, `pg`, or Redis. `apps/web/src/architecture.spec.ts` reads the web source and fails if those packages appear.
