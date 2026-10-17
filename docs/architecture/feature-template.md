# Feature template

Generate a module with:

```bash
pnpm generate:module -- --name billing-accounts
pnpm generate:module -- --name billing-accounts --command create-account --query get-account
```

The name and every action are kebab-case. The command refuses to overwrite an existing directory. Generated code typechecks. It does not create empty entities, value objects, repositories, policies, or event classes.

Output for a module with one command:

```text
modules/billing-accounts/
  billing-accounts.module.ts
  billing-accounts.module.spec.ts
  index.ts
  application/
    commands/
      create-account/
        create-account.command.ts
        create-account.handler.ts
        create-account.result.ts
        create-account.handler.spec.ts
```

A query uses `application/queries/<action>/` and the same four files. Add `domain/`, `infrastructure/`, and `presentation/http/` when the use case needs them. Folders with no files are omitted.

## Commands and queries

A command or query is an application input. It is not an HTTP DTO.

- `<action>.command.ts` or `<action>.query.ts` — input type
- `<action>.handler.ts` — `execute` method
- `<action>.result.ts` — application output
- `<action>.handler.spec.ts` — unit test

Handlers stay free of `@nestjs/*`. The module file registers them as providers. Replace the generated `execute` body before the module is registered in `AppModule`. The generated body only proves the type contract: it returns the supplied identifier or rejects an empty one.

HTTP DTOs and HTTP mappers live under `presentation/http/` when a controller exists. Persistence mappers live under `infrastructure/persistence/` when a port needs them. Do not add either mapper until there is a boundary to protect.

## Registration

The generator does not edit `AppModule`. Import the feature from `modules/<feature>` (the `index.ts` barrel) at the composition root when the feature is ready.

Cross-module callers use that barrel. They do not import `application/`, `domain/`, or `infrastructure/` from the outside.

## Tests

Handler tests construct the handler directly. They do not boot Nest and they do not require PostgreSQL.

A tenant-owned module also needs tests for a forged organization header, a revoked membership, another organization's record id, a job carrying the wrong organization, and a cache or storage key from another organization. The platform tests do not cover a module that has not been written. See `docs/security/tenant-isolation.md` and `docs/testing/testing-strategy.md`.
