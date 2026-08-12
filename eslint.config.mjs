import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

/** Политика слоя: из какого типа элементов куда можно импортировать. */
const layerPolicy = (from, allowed) => ({
  from: { element: { type: from } },
  allow: allowed.map((type) => ({ to: { element: { type } } })),
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Правила слоёв (ТЗ §5): domain ни от чего не зависит, application — только
  // от domain и портов, infrastructure реализует порты, app/api — тонкий.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/modules/*/domain/**' },
        { type: 'application', pattern: 'src/modules/*/application/**' },
        { type: 'infrastructure', pattern: 'src/modules/*/infrastructure/**' },
        { type: 'presentation', pattern: 'src/modules/*/presentation/**' },
        { type: 'module-root', pattern: 'src/modules/*/*.*' },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'generated', pattern: 'src/generated/**' },
        { type: 'i18n', pattern: 'src/i18n/**' },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'root-file', pattern: 'src/*.*' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Домен — только чистые типы/утилиты
            layerPolicy('domain', ['domain', 'shared']),
            layerPolicy('application', ['domain', 'application', 'shared']),
            layerPolicy('infrastructure', [
              'domain',
              'application',
              'infrastructure',
              'shared',
              'generated',
            ]),
            layerPolicy('presentation', [
              'domain',
              'application',
              'presentation',
              'module-root',
              'shared',
            ]),
            layerPolicy('module-root', [
              'domain',
              'application',
              'infrastructure',
              'module-root',
              'shared',
            ]),
            layerPolicy('app', [
              'domain',
              'application',
              'presentation',
              'module-root',
              'shared',
              'app',
              'i18n',
            ]),
            // shared/security и shared/errors знают про Prisma-клиент и коды доменных ошибок
            layerPolicy('shared', ['shared', 'generated', 'domain', 'application']),
            layerPolicy('i18n', ['i18n']),
            layerPolicy('root-file', ['shared']),
            layerPolicy('generated', ['generated']),
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Локальные инструменты (портативные Node/PostgreSQL) и сгенерированный код:
    '.tools/**',
    '.local/**',
    'src/generated/**',
  ]),
]);

export default eslintConfig;
