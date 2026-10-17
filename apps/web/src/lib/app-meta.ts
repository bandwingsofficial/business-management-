export const appMeta = {
  name: 'Softtech Core',
  description: 'Business management platform',
} as const;

export function getAppTitle(): string {
  return appMeta.name;
}
