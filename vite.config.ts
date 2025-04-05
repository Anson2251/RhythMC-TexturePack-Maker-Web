import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import dotenv from 'dotenv'

dotenv.config()
const backendBaseUrl = process.env.BACKEND_BASE_URL  ?? "http://localhost:8200"
const inDev = (process.env.NODE_ENV === "development")

export default defineConfig({
	plugins: [],
	base: "./",
	define: {
		__IN_DEV__: inDev,
		__BACKEND_BASE_URL__: JSON.stringify(backendBaseUrl),

		__FFMPEG_BASE_URL_SINGLE_THREAD__: JSON.stringify(process.env.FFMPEG_BASE_URL_SINGLE_THREAD ?? `${(inDev ? "/public" : "..")}/ffmpeg/single-thread`),
		__FFMPEG_BASE_URL_MULTIPLE_THREAD__: JSON.stringify(process.env.FFMPEG_BASE_URL_MULTIPLE_THREAD ?? `${(inDev ? "/public" : "..")}/ffmpeg/multiple-thread`),
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},
	server: {
		port: 3000,
		open: true,
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp"
		}
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
