import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { relaxContentSecurityPolicyForDevServer } from './src/shared/lib/contentSecurityPolicy'

const FONT_FILE_PATTERN = /\.woff2?$/

const devContentSecurityPolicyPlugin: Plugin = {
  name: 'my-cdi:dev-content-security-policy',
  apply: 'serve',
  transformIndexHtml: { order: 'pre', handler: relaxContentSecurityPolicyForDevServer }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@student': resolve('src/features/student/main'),
        '@frequentation': resolve('src/features/frequentation/main'),
        '@statistics': resolve('src/features/statistics/main'),
        '@settings': resolve('src/features/settings/main'),
        '@settings-shared': resolve('src/features/settings/shared'),
        '@backup': resolve('src/features/backup/main'),
        '@backup-shared': resolve('src/features/backup/shared'),
        '@student-shared': resolve('src/features/student/shared'),
        '@frequentation-shared': resolve('src/features/frequentation/shared'),
        '@statistics-shared': resolve('src/features/statistics/shared'),
        '@shared': resolve('src/shared'),
        '@lib': resolve('src/shared/lib'),
        '@types': resolve('src/shared/types')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@lib': resolve('src/shared/lib'),
        '@types': resolve('src/shared/types')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@student': resolve('src/features/student/renderer'),
        '@frequentation': resolve('src/features/frequentation/renderer'),
        '@statistics': resolve('src/features/statistics/renderer'),
        '@settings': resolve('src/features/settings/renderer'),
        '@settings-shared': resolve('src/features/settings/shared'),
        '@backup': resolve('src/features/backup/renderer'),
        '@backup-shared': resolve('src/features/backup/shared'),
        '@student-shared': resolve('src/features/student/shared'),
        '@frequentation-shared': resolve('src/features/frequentation/shared'),
        '@statistics-shared': resolve('src/features/statistics/shared'),
        '@shared': resolve('src/shared'),
        '@ui': resolve('src/shared/ui'),
        '@lib': resolve('src/shared/lib'),
        '@types': resolve('src/shared/types')
      }
    },
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', { target: '19' }]]
        }
      }),
      devContentSecurityPolicyPlugin
    ],
    build: {
      assetsInlineLimit: (filePath) => (FONT_FILE_PATTERN.test(filePath) ? false : undefined)
    }
  }
})
