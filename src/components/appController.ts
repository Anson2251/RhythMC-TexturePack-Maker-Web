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
		private accessCodeInput : HTMLInputElement,
		private processBtn: HTMLButtonElement,
		private statusDiv: HTMLDivElement,
		private resultDiv: HTMLDivElement
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
		if(typeof SharedArrayBuffer !== 'undefined') {
			this.statusDiv.textContent = "多线程支持已启用"
			this.updateProgress(0)
		}
		this.statusDiv.textContent = '正在加载 FFmpeg WASM...'
		let currentProgress = 0
		const updateProgressFfmpeg = setInterval(() => {
			if (currentProgress >= 90) clearInterval(updateProgressFfmpeg)
			currentProgress += 1
			this.updateProgress(currentProgress)
		}, 100)

		loadFfmpeg(this.ffmpeg)
			.then(() => {
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
		const logContainer = this.resultDiv.parentElement?.parentElement?.querySelector('.log-container')
		if (logContainer) {
			const timestamp = new Date().toLocaleTimeString()
			const statusText = this.statusDiv.textContent || ''
			logContainer.innerHTML += `<span data-timestamp>[${timestamp}]</span> <span data-status>${statusText}</span> <span data-percent>(${percent}%)</span>\n`
			logContainer.scrollTop = logContainer.scrollHeight
		}
	}


	private setupEventListeners() {
		// Setup result div click to copy
		this.resultDiv.addEventListener('click', () => {
			if (this.resultDiv.textContent) {
				const originalText = this.resultDiv.textContent
				if(originalText == "待计算")return
				navigator.clipboard.writeText(originalText)
					.then(() => {
						this.resultDiv.textContent = '已复制到剪贴板'
						setTimeout(() => {
							this.resultDiv.textContent = originalText
						}, 1000)
					})
					.catch(err => {
						console.error('复制失败:', err)
						this.statusDiv.textContent = '复制失败'
					})
			}
		})

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
			const accessCode = this.accessCodeInput.value

			if (!songName || !composerName) {
				this.statusDiv.textContent = '请输入歌曲名称和曲师名称'
				return
			}

			if(location.hostname !== 'localhost' && accessCode !== 'pass') {
				if (!accessCode) {
					this.statusDiv.textContent = '请向Frk申请制作材质包权限。'
					return
				}
				if(! await this.verifyKey(accessCode)) {
					this.statusDiv.textContent = '密钥验证失败，请检查密钥是否正确。'
					return
				}
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
	private async verifyKey(accessCode: string): Promise<boolean> {
		try {
			this.statusDiv.textContent = `正在验证密钥...`
			this.updateProgress(0)
			const response = await fetch(`${__BACKEND_BASE_URL__}/api/verify`, {
				method: 'GET',
				headers: {
					'X-Auth-Token': accessCode
				}
			})
			if (!(response.status == 200)) {
				this.statusDiv.textContent = `验证失败: ${response.status}`
				this.updateProgress(0)
				return false
			}
			this.statusDiv.textContent = `验证成功!`
			this.updateProgress(100)
			return true
		} catch (error) {
			this.statusDiv.textContent = `验证失败: ${error}`
			this.updateProgress(0)
			return false
		}
	}
	private async uploadTexturePack(file: Blob, endpoint: string, part?: number, hash?: string): Promise<string> {
		const formData = new FormData()
		formData.append('file', file)
		if (part) {
			formData.append('part', part.toString())
		}

		try {
			const response = await fetch(`${__BACKEND_BASE_URL__}/api/texture/${endpoint}`, {
				method: 'POST',
				headers: {
					'X-Auth-Token': this.accessCodeInput.value,
					// Contains Hash? if Yes add Hash to header
					'X-PlayerPack-Hash': hash || ''
				},
				body: formData
			})

			if (!response.ok) {
				this.resultDiv.textContent=`上传失败: ${response.status}`
			}

			if (endpoint === 'player') {
				return await response.text()
			}
			return 'Upload successful'
		} catch (error) {
			console.error('上传错误:', error)
			throw error
		}
	}

	private async processAudio(file: File, songName: string, composerName: string) {
		if (!this.ffmpeg.loaded) await this.ffmpeg.load()
		this.resultDiv.innerHTML = "<i>待计算</i>"

		this.updateProgress(0)

		const needConversion = !file.type.endsWith('ogg')
		let step = 1
		const totalSteps = needConversion ? 5 : 4

		this.statusDiv.textContent = `(${step}/${totalSteps}) 正在${needConversion ? "转换" : "处理"}音频...`
		const { mainAudio, getSegment } = await processAudioWithFFmpeg(this.ffmpeg, file, () => {
			if (!needConversion) return;
			step++;
			this.statusDiv.textContent = `(${step}/${totalSteps}) 正在处理音频...`
		})

		this.updateProgress(100)

		step++
		this.statusDiv.textContent = `(${step}/${totalSteps})正在计算音频时长...`
		this.updateProgress(0)
		const duration = await getAudioDuration(file)
		const length = Math.floor(duration * 20) // Convert to ticks
		this.updateProgress(100)
		step++
		this.statusDiv.textContent = `(${step}/${totalSteps})正在生成材质包...`
		this.updateProgress(0)
		// Create full pack
		const fullPack: Record<string, Uint8Array> = {
			'assets/minecraft/sounds/mob/horse/death.ogg': mainAudio,
			'pack.mcmeta': createPackMeta(songName, composerName)
		}
		this.updateProgress(10)

		// Add thumbnail if provided
		if (this.thumbnailFile) {
			fullPack['pack.png'] = new Uint8Array(await this.thumbnailFile.arrayBuffer())
		}
		this.updateProgress(30)
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
		this.updateProgress(60)
		// Create ZIP files
		step++
		this.statusDiv.textContent = `(${step}/${totalSteps}) 正在创建ZIP文件...`
		this.fullZipBlob = await createZip(fullPack, `${songName}.zip`)
		let charter_count = Object.entries(charterPacks).length
		const partZips = await Promise.all(
			Object.entries(charterPacks).map(([name, files]) =>
				createZip(files, `${name}.zip`),
			)
		)
		partZips.forEach((zip, i) => {
			const partNum = i + 1
			this.statusDiv.textContent = `(${step}/${totalSteps}) 正在创建ZIP文件... (${i+1}/${charter_count})`
			this.updateProgress(60+40/charter_count*(i+1))
			this.charterZipBlobs[`part-${partNum}`] = zip
		})
		this.updateProgress(100)


		// Upload texture packs
		this.statusDiv.textContent = '正在上传材质包...'
		this.updateProgress(0)
		const hash = await this.uploadTexturePack(this.fullZipBlob!, 'player',charter_count)
		this.updateProgress(50)
		// Upload charter packs
		await Promise.all(
			Object.entries(this.charterZipBlobs).map(([name, blob]) => {
				const partNum = parseInt(name.split('-')[1])
				this.statusDiv.textContent = `正在上传材质包... ${partNum}/${charter_count}`
				this.updateProgress(50+ 50/charter_count*partNum)
				return this.uploadTexturePack(blob, 'charter', partNum, hash)
			})
		)
		// Output result
		const encoder = new TextEncoder()
		const encodedName = btoa(String.fromCharCode(...encoder.encode(songName)))
		const result = `${hash}:${length}:${encodedName}`

		this.resultDiv.textContent = result
		this.statusDiv.textContent = `使用 /editor create ${result} 来创建该谱面。`
		this.updateProgress(100)
		this.statusDiv.textContent = '处理并上传完成!'
		this.updateProgress(100)
	}
}
