import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const noAdapters = {
  group: ['**/adapters/**'],
  message: 'Depend on a port; only src/composition.ts and src/main.tsx wire adapters.',
}
const noUi = { group: ['**/ui/**'], message: 'Inner layers never reach out to the UI.' }
const noReact = {
  group: ['react', 'react/**', 'react-dom', 'react-dom/**'],
  message: 'The domain stays plain TypeScript, free of React.',
}

function forbid(...patterns) {
  return { 'no-restricted-imports': ['error', { patterns }] }
}

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // the hexagon: outside the adapters themselves, only the composition root may import one
  {
    files: ['src/**'],
    ignores: ['src/adapters/**', 'src/composition.ts', 'src/composition.test.ts', 'src/main.tsx'],
    rules: forbid(noAdapters),
  },
  { files: ['src/domain/**'], rules: forbid(noAdapters, noUi, noReact) },
  { files: ['src/ports/**'], rules: forbid(noAdapters, noUi) },
)
