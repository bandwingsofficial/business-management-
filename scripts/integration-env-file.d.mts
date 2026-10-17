export function applyIntegrationEnvFile(
  filePath: string,
  target: NodeJS.ProcessEnv,
): { readonly loaded: number; readonly present: boolean };

export function loadIntegrationEnv(rootDir: string): {
  readonly path: string;
  readonly file: { readonly loaded: number; readonly present: boolean };
  readonly env: NodeJS.ProcessEnv;
};
