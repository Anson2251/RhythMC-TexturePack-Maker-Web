import './style/main.less'
import { AppController } from './components/appController'

// Get DOM elements
const audioFileInput = document.getElementById('audioFile') as HTMLInputElement
const songNameInput = document.getElementById('songName') as HTMLInputElement
const composerNameInput = document.getElementById('composerName') as HTMLInputElement
const processBtn = document.getElementById('processBtn') as HTMLButtonElement
const statusDiv = document.getElementById('statusText') as HTMLDivElement
const resultDiv = document.getElementById('result') as HTMLDivElement
const downloadFullBtn = document.getElementById('downloadFull') as HTMLButtonElement
const downloadCharterBtns = document.getElementById('downloadCharterBtns') as HTMLDivElement


document.body.onload = () => {
	// Initialize app controller
	console.info('document loaded')
	new AppController(
		audioFileInput,
		songNameInput,
		composerNameInput,
		processBtn,
		statusDiv,
		resultDiv,
		downloadFullBtn,
		downloadCharterBtns
	)
}

