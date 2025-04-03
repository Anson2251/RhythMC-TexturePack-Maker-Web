import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { processAudioWithFFmpeg, getAudioDuration, loadFfmpeg, extractCoverArt } from '../lib/audioProcessor'
import { createPackMeta, createZip, downloadBlob, getFileHash } from '../lib/zipHandler'

export class AppController {
	private ffmpeg = new FFmpeg()

	private fullZipBlob: Blob | null = null
	private charterZipBlobs: Record<string, Blob> = {}

	private progressBar: HTMLDivElement
	private progressText: HTMLDivElement

	private thumbnailImg: HTMLImageElement
	private thumbnailArea: HTMLDivElement
	private thumbnailFile: File | null = null

	constructor(
		private audioFileInput: HTMLInputElement,
		private songNameInput: HTMLInputElement,
		private composerNameInput: HTMLInputElement,
		private processBtn: HTMLButtonElement,
		private statusDiv: HTMLDivElement,
		private resultDiv: HTMLDivElement,
		private downloadFullBtn: HTMLButtonElement,
		private downloadCharterBtns: HTMLDivElement
	) {
		console.info("initialising app controller")
		this.thumbnailImg = document.getElementById('thumbnailImg') as HTMLImageElement
		this.thumbnailArea = document.getElementById('thumbnailArea') as HTMLDivElement
		this.progressBar = this.statusDiv.parentElement!.querySelector('.progress-bar')!
		this.progressText = this.statusDiv.parentElement!.querySelector('.progress-text')!
		this.setupEventListeners()

		this.ffmpeg.on("progress", ({ progress }) => {
			const percent = Math.round(Math.min(Math.max(0, progress * 100), 100))
			this.updateProgress(percent)
		})

		this.loadFfmpeg(async () => {
			if (audioFileInput.files && audioFileInput.files.length > 0) {
				this.ffmpeg.writeFile('input', await fetchFile(this.audioFileInput.files![0]))
				console.log('Previously added audio file detected, attempting to handle cover art...')
				this.handleMusicFileCover()
			}
		})
	}

	private loadFfmpeg(cb: () => void) {
		this.statusDiv.textContent = '正在加载 FFmpeg WASM...'
		let currentProgress = 0
		const updateProgressFfmpeg = setInterval(() => {
			if (currentProgress >= 90) clearInterval(updateProgressFfmpeg)
			currentProgress += 1
			this.updateProgress(currentProgress)
		}, 100)

		loadFfmpeg(this.ffmpeg).then(() => {
			this.statusDiv.textContent = 'FFmpeg 已就绪'
			console.info("FFmpeg ready")
			clearInterval(updateProgressFfmpeg)
			setTimeout(() => this.updateProgress(100), 100)
			cb()
		})
			.catch((error) => {
				this.statusDiv.textContent = 'FFmpeg 加载失败'
				console.error(error)
				clearInterval(updateProgressFfmpeg)
				setTimeout(() => this.updateProgress(0), 100)
			})
	}

	private handleThumbnailFile(file: File) {
		if (!file.type.startsWith('image/')) {
			this.statusDiv.textContent = '请选择有效的图片文件'
			return
		}

		this.thumbnailFile = file
		const reader = new FileReader()
		reader.onload = (e) => {
			this.thumbnailImg.src = e.target?.result as string
			this.thumbnailImg.style.display = 'block'
			const placeholder = this.thumbnailArea.querySelector('.thumbnail-placeholder') as HTMLElement
			placeholder.style.display = 'none'
		}
		reader.readAsDataURL(file)
	}

	private updateProgress(percent: number) {
		percent = Math.round(Math.min(Math.max(0, percent), 100))
		this.progressBar.style.width = `${percent}%`
		this.progressText.textContent = `${percent}%`
	}

	private setupEventListeners() {
		// Setup thumbnail drag and drop
		this.thumbnailArea.addEventListener('dragover', (e) => {
			e.preventDefault()
			this.thumbnailArea.classList.add('dragover')
		})

		this.thumbnailArea.addEventListener('dragleave', () => {
			this.thumbnailArea.classList.remove('dragover')
		})

		this.thumbnailArea.addEventListener('drop', (e) => {
			e.preventDefault()
			this.thumbnailArea.classList.remove('dragover')

			if (e.dataTransfer?.files.length) {
				this.handleThumbnailFile(e.dataTransfer.files[0])
			}
		})

		this.thumbnailArea.addEventListener('click', () => {
			const input = document.createElement('input')
			input.type = 'file'
			input.accept = 'image/*'
			input.onchange = (e) => {
				if (input.files?.length) {
					this.handleThumbnailFile(input.files[0])
				}
			}
			input.click()
		})

		this.audioFileInput.addEventListener('input', async () => {
			this.statusDiv.textContent = '音乐文件已添加'
			await this.handleMusicFileCover()
		})

		this.processBtn.addEventListener('click', async () => {
			if (!this.audioFileInput.files?.length) {
				this.statusDiv.textContent = '请选择音频文件'
				return
			}

			const file = this.audioFileInput.files[0]
			const songName = this.songNameInput.value
			const composerName = this.composerNameInput.value

			if (!songName || !composerName) {
				this.statusDiv.textContent = '请输入歌曲名称和曲师名称'
				return
			}

			try {
				this.statusDiv.textContent = '正在处理...'
				await this.processAudio(file, songName, composerName)
			} catch (error) {
				this.statusDiv.textContent = `处理失败: ${error}`
				console.error(error)
			}
		})
	}

	private async handleMusicFileCover() {
		this.ffmpeg.writeFile('input', await fetchFile(this.audioFileInput.files![0]))
		const coverArt = await extractCoverArt(this.ffmpeg)
		if (coverArt) {
			const blob = new Blob([coverArt], { type: 'image/png' })
			this.handleThumbnailFile(new File([blob], 'cover.png', { type: 'image/png' }))
		}
	}

	private async processAudio(file: File, songName: string, composerName: string) {
		if (!this.ffmpeg.loaded) await this.ffmpeg.load()
		const placeholder = this.downloadCharterBtns.querySelector('.charter-placeholder') as HTMLDivElement
		this.resultDiv.innerHTML = "<i>待计算</i>"
		placeholder.style.display = 'inherit'
		this.downloadFullBtn.style.display = 'none'
		this.downloadFullBtn.onclick = () => { }
		this.downloadCharterBtns.querySelectorAll('button').forEach(btn => btn.remove())

		this.updateProgress(0)

		const needConversion = !file.type.endsWith('ogg')
		let step = 1
		const totalSteps = needConversion ? 4 : 3

		this.statusDiv.textContent = `(${step}/${totalSteps}) 正在${needConversion ? "转换" : "处理"}音频...`
		const { mainAudio, getSegment } = await processAudioWithFFmpeg(this.ffmpeg, file, () => {
			if (!needConversion) return;
			step++;
			this.statusDiv.textContent = `(${step}/${totalSteps}) 正在处理音频...`
		})

		this.updateProgress(100)

		step++
		this.statusDiv.textContent = `(${step}/${totalSteps})正在计算音频时长...`
		const duration = await getAudioDuration(file)
		const length = Math.floor(duration * 20) // Convert to ticks

		// Create full pack
		const fullPack: Record<string, Uint8Array> = {
			'assets/minecraft/sounds/mob/horse/death.ogg': mainAudio,
			'pack.mcmeta': createPackMeta(songName, composerName)
		}

		// Add thumbnail if provided
		if (this.thumbnailFile) {
			fullPack['pack.png'] = new Uint8Array(await this.thumbnailFile.arrayBuffer())
		}

		// Create charter packs
		const charterPacks: Record<string, Record<string, Uint8Array>> = {}
		let segmentCount = 0

		while (true) {
			const segment = await getSegment(segmentCount)
			if (!segment) break

			const partNum = segmentCount + 1
			const charterPack: Record<string, Uint8Array> = {
				[`assets/minecraft/sounds/mob/irongolem/death.ogg`]: segment,
				'pack.mcmeta': createPackMeta(songName, composerName)
			}
			// Add thumbnail to charter pack if provided
			if (this.thumbnailFile) {
				charterPack['pack.png'] = new Uint8Array(await this.thumbnailFile.arrayBuffer())
			}
			charterPacks[`part-${partNum}`] = charterPack
			segmentCount++
		}

		// Create ZIP files
		step++
		this.statusDiv.textContent = `(${step}/${totalSteps}) 正在创建ZIP文件...`
		this.fullZipBlob = await createZip(fullPack, `${songName}.zip`)
		const partZips = await Promise.all(
			Object.entries(charterPacks).map(([name, files]) =>
				createZip(files, `${name}.zip`)
			)
		)

		// Update UI
		this.downloadFullBtn.style.display = 'block'
		this.downloadFullBtn.onclick = () => downloadBlob(this.fullZipBlob!, `${songName}.zip`)


		placeholder.style.display = 'none'

		partZips.forEach((zip, i) => {
			const partNum = i + 1
			this.charterZipBlobs[`part-${partNum}`] = zip
			const btn = document.createElement('button')
			btn.textContent = `下载谱师包 ${partNum}`
			btn.onclick = () => downloadBlob(zip, `part-${partNum}.zip`)
			this.downloadCharterBtns.appendChild(btn)
		})

		// Output result
		const encoder = new TextEncoder()
		const encodedName = btoa(String.fromCharCode(...encoder.encode(songName)))
		const result = `${await getFileHash(this.fullZipBlob)}:${length}:${encodedName}`

		this.resultDiv.textContent = result
		this.statusDiv.textContent = '处理完成!'
	}
}
