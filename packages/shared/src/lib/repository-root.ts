import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function resolveRepositoryRoot(startDirectory = process.cwd()): string {
  let candidate = resolve(startDirectory);

  while (true) {
    if (
      existsSync(join(candidate, 'package.json'))
      && existsSync(join(candidate, 'content'))
      && existsSync(join(candidate, 'packages', 'shared'))
    ) {
      return candidate;
    }

    const parent = dirname(candidate);
    if (parent === candidate) {
      throw new Error(`Repository-Root aus ${startDirectory} nicht gefunden.`);
    }
    candidate = parent;
  }
}
