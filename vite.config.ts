import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
	plugins: [],
	base: "./",
	define: {
		__IN_DEV__: (process.env.NODE_ENV === "development")
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},
	server: {
		port: 3000,
		open: true
	},
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
		emptyOutDir: true
	},
	optimizeDeps: {
		exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
	},
})
