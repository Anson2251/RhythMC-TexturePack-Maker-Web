import './style/main.less'
import { AppController } from './components/appController'

// Get DOM elements
const audioFileInput = document.getElementById('audioFile') as HTMLInputElement
const songNameInput = document.getElementById('songName') as HTMLInputElement
const composerNameInput = document.getElementById('composerName') as HTMLInputElement
const accessCodeInput = document.getElementById('accessCode') as HTMLInputElement
const processBtn = document.getElementById('processBtn') as HTMLButtonElement
const statusDiv = document.getElementById('statusText') as HTMLDivElement
const resultDiv = document.getElementById('result') as HTMLDivElement


document.body.onload = () => {
	// Initialize app controller
	console.info('document loaded')
	new AppController(
		audioFileInput,
		songNameInput,
		composerNameInput,
		accessCodeInput,
		processBtn,
		statusDiv,
		resultDiv
	)
}

