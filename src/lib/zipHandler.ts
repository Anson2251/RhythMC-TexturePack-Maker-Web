import JSZip from 'jszip'
import { MD5, lib } from 'crypto-js'

type PackFile = Uint8Array
type PackFiles = Record<string, PackFile>

export function createPackMeta(songName: string, composerName: string): Uint8Array {
	const meta = {
		pack: {
			pack_format: 22,
			description: `§bRhythMC §3韵律方块 §6音乐资源包\n§c§o${songName} §f- §e${composerName}`,
			supported_formats: { min_inclusive: 22, max_inclusive: 99 }
		}
	}
	return new TextEncoder().encode(JSON.stringify(meta, null, 2))
}

export async function createZip(files: PackFiles, zipName: string): Promise<Blob> {
	const zip = new JSZip()
	for (const [path, data] of Object.entries(files)) {
		zip.file(path, data)
	}
	return await zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

export async function getFileHash(file: Blob): Promise<string> {
	try {
		// Try using browser's crypto.subtle first
		try {
			const buffer = await file.arrayBuffer()
			const hashBuffer = await crypto.subtle.digest('MD5', buffer)
			const hashArray = Array.from(new Uint8Array(hashBuffer))
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
		}
		catch {
			// Fallback to crypto-js
			const arrayBuffer = await file.arrayBuffer()
			const wordArray = MD5(lib.WordArray.create(arrayBuffer as any))
			return wordArray.toString()
		}
	} catch (error) {
		console.error('Hash generation failed:', error)
		return '00000000000000000000000000000000' // Return dummy hash if both methods fail
	}
}
