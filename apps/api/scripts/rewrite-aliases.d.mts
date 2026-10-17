export function rewriteAliasSpecifier(
  fromFile: string,
  specifier: string,
  distRoot: string,
): string;
export function rewriteSource(source: string, fromFile: string, distRoot: string): string;
export function rewriteDist(distRoot: string): number;
