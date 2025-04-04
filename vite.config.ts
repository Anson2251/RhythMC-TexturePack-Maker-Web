import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import dotenv from 'dotenv'

dotenv.config()
const backendBaseUrl = process.env.BACKEND_BASE_URL  ?? "http://localhost:8200"

export default defineConfig({
	plugins: [],
	base: "./",
	define: {
		__IN_DEV__: (process.env.NODE_ENV === "development"),
		__BACKEND_BASE_URL__: JSON.stringify(backendBaseUrl)
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
