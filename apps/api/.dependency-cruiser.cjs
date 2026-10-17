/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-inside-the-domain',
      severity: 'error',
      comment: 'Domain code depends only on other domain types.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: '^src/(common|platform|infrastructure|bootstrap|configs|modules/[^/]+/(application|infrastructure|presentation))/',
      },
    },
    {
      name: 'domain-does-not-import-frameworks',
      severity: 'error',
      comment: 'Domain code does not import Nest, Prisma, or database drivers.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(@nestjs/|@prisma/|prisma/|pg/)' },
    },
    {
      name: 'application-does-not-import-outer-layers',
      severity: 'error',
      comment: 'Application code depends on domain and common technical helpers.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: {
        path: '^src/(infrastructure|bootstrap|configs|platform|modules/[^/]+/(infrastructure|presentation))/',
      },
    },
    {
      name: 'application-does-not-import-frameworks',
      severity: 'error',
      comment: 'Application use cases stay free of Nest, Prisma, and drivers.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: 'node_modules/(@nestjs/|@prisma/|prisma/|pg/)' },
    },
    {
      name: 'presentation-does-not-import-infrastructure-or-domain',
      severity: 'error',
      comment: 'HTTP adapters call application use cases and do not reach around them.',
      from: { path: '^src/modules/[^/]+/presentation/' },
      to: { path: '^src/(infrastructure|modules/[^/]+/(domain|infrastructure))/' },
    },
    {
      name: 'common-does-not-import-product-code',
      severity: 'error',
      comment: 'Technical helpers stay independent of platform and business modules.',
      from: { path: '^src/common/' },
      to: { path: '^src/(modules|platform|infrastructure|bootstrap)/' },
    },
    {
      name: 'infrastructure-does-not-import-modules',
      severity: 'error',
      comment: 'Shared adapters do not depend on business modules.',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment: 'Another module may be reached only through its index.ts public API.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '(^src/generated/|\\.spec\\.ts$)',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
