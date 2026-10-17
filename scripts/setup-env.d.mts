export interface EnvSetupPlan {
  readonly ok: boolean;
  readonly created: boolean;
  readonly targetPath: string;
  readonly message: string;
}

export function planEnvFileSetup(input: {
  readonly rootDir: string;
  readonly templateName: string;
  readonly targetName: string;
}): EnvSetupPlan;
