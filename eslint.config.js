import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Production-friendly rules - relax some strict typing for API endpoints
      '@typescript-eslint/no-explicit-any': 'warn', // Change from error to warning
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/ban-ts-comment': 'warn', // Allow @ts-ignore in exceptional cases
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowShortCircuit: true,
        allowTernary: true
      }],
      // Allow console statements in API/backend files
      'no-console': 'off',
      // Relax React rules for better developer experience
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn'
    }
  },
  {
    // Special rules for API and backend files
    files: ['api/**/*.ts', 'backend/**/*.ts', 'lib/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in API files for request/response handling
      '@typescript-eslint/ban-ts-comment': 'off', // Allow ts-ignore in API files
    }
  }
])
