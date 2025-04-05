import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { isRelativePath, toBlobURL } from '@/lib/inet'

const multiThreadAvailable = (() => {
  try {
    return typeof SharedArrayBuffer !== 'undefined' &&
           window.crossOriginIsolated
  } catch {
    return false
  }
})()

let ffmpegLoading = false
// let baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.9/dist/esm'
let baseURL = multiThreadAvailable ? __FFMPEG_BASE_URL_MULTIPLE_THREAD__ : __FFMPEG_BASE_URL_SINGLE_THREAD__
if(isRelativePath(baseURL)) {
    baseURL = new URL(baseURL, import.meta.url).href
}
console.log(baseURL, `${baseURL}/ffmpeg-core.js?url`)
export async function loadFfmpeg(ffmpeg: FFmpeg, progress: ((progress: number) => void)) {
	if (!ffmpeg.loaded && !ffmpegLoading) {
		ffmpegLoading = true
		console.info('Loading FFmpeg...')
		let progressNum = 0

		await ffmpeg.load({
            coreURL: await toBlobURL(new URL(`${baseURL}/ffmpeg-core.js?url`).href, 'text/javascript', false, (event) => {
				progress((progressNum + event.received / event.total) / (multiThreadAvailable ? 3 : 2))
				if(event.done) {
					progressNum += 1
				}
			}),
            wasmURL: await toBlobURL(new URL(`${baseURL}/ffmpeg-core.wasm?url`).href, 'application/wasm', true, (event) => {
				progress((progressNum + event.received / event.total) / (multiThreadAvailable ? 3 : 2))
				if(event.done) {
					progressNum += 1
				}
			}),
            ...(multiThreadAvailable ? {
				workerURL: await toBlobURL(new URL(`${baseURL}/ffmpeg-core.worker.js?url`).href, 'text/javascript', true, (event) => {
					progress((progressNum + event.received / event.total) / 3)
				}),
			} : {})
        });
	}
}

async function convertToOgg(ffmpeg: FFmpeg, file: File): Promise<void> {
	const fileName = file.name.toLowerCase()
	const isOgg = fileName.endsWith('.ogg')

	await ffmpeg.writeFile('input', await fetchFile(file))

	if (!isOgg) {
		await ffmpeg.exec([
			'-i', 'input',
			'-ac', '1',
			'-y',
			'-map', '0:a',
			'-map_metadata', '-1',
			'-acodec', 'libvorbis',
			'converted.ogg'
		])
		await ffmpeg.writeFile('input', await ffmpeg.readFile('converted.ogg'))
	}
}

export async function extractCoverArt(ffmpeg: FFmpeg): Promise<Uint8Array | null> {
	try {
		await ffmpeg.exec([
			'-i', 'input',
			'-map', '0:v',
			'-vframes', '1',
			'-y',
			'cover.png'
		])
		return await ffmpeg.readFile('cover.png') as Uint8Array
	} catch {
		return null
	}
}

async function processMainAudio(ffmpeg: FFmpeg): Promise<Uint8Array> {
	await ffmpeg.exec([
		'-i', 'input',
		'-ac', '1',
		'-y',
		'-map', '0:a',
		'-map_metadata', '-1',
		'death.ogg'
	])
	return await ffmpeg.readFile('death.ogg') as Uint8Array
}

async function createSegments(ffmpeg: FFmpeg): Promise<(index: number) => Promise<Uint8Array | null>> {
	await ffmpeg.exec([
		'-i', 'input',
		'-f', 'segment',
		'-segment_time', '15',
		'-c', 'copy',
		'segment%03d.ogg'
	])

	return async (index: number) => {
		const segmentName = `segment${String(index).padStart(3, '0')}.ogg`
		try {
			return await ffmpeg.readFile(segmentName) as Uint8Array
		} catch {
			return null
		}
	}
}

export async function processAudioWithFFmpeg(ffmpeg: FFmpeg, file: File, cb?: (arg: string) => void) {
	if (!ffmpeg.loaded) {
		await ffmpeg.load()
	}

	await convertToOgg(ffmpeg, file)
	if (cb) cb('convert')
	const mainAudio = await processMainAudio(ffmpeg)
	const getSegment = await createSegments(ffmpeg)

	return {
		mainAudio,
		getSegment,
	}
}

export async function getAudioDuration(file: File): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio()
		audio.src = URL.createObjectURL(file)
		audio.onloadedmetadata = () => {
			resolve(audio.duration)
			URL.revokeObjectURL(audio.src)
		}
	})
}
