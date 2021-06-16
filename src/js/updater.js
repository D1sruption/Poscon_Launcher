// Set up temporary loading logic
// Will replace this later with downloadPercent logic
const ipcTest = require('electron').ipcRenderer
const log = require('electron-log')
const checkInternetConnected = require('check-internet-connected')
var updateAvailable = false
var updateDownloaded = false
var updateNotAvail = false
var s1Comp; var s2Comp; var s3Comp = false
var statusText = document.getElementById('progressText')
var value = 0
var b1 = document.querySelector('.ldBar')
var b = new ldBar(b1)

let startPoscon = false;

b.set(0)
log.info('Initiate logging from updaterjs...')
log.info('Value: ' + value)

// ipc Calls:
// update-check
// update-available
// update-dl
// update-not-available

// check internet connection before attempting update
// if unable to resolve the release server, then force close the app
const config = {
  timeout: 5000, // timeout connecting to each server(A and AAAA), each try (default 5000)
  retries: 3, // number of retries to do before failing (default 5)
  domain: 'releases.poscon.net'// the domain to check DNS record of
}

checkInternetConnected(config)
  .then(() => {
    log.info('Internet connected!')
    ipcTest.send('online')
  // alert('Online!');
  }).catch((error) => {
    log.error('Unable to contact POSCON network!' + error)
    statusText.innerHTML = 'Unable to contact POSCON...'
    // @TODO
    // Replace alert with dialog box allowing actions
    alert('Unable to contact POSCON. App will now exit. Please reconnect and try again...')
    ipcTest.send('offline')
  })

var progress = setInterval(function () {
  if (value < 25 && value > 0 && !s1Comp) {
    statusText.innerHTML = 'Checking for updates...'
    s1Comp = true
  }

  if (updateAvailable && value < 50 && !s2Comp) {
    statusText.innerHTML = 'Downloading Update...'
    log.info('[updaterjs]Update Available')
    log.info('Value: ' + value)
    value += 1
    b.set(value)
    if (value === 50) {
      s2Comp = true
      log.info('s2Comp = true')
    }
  }

  if (updateDownloaded && value < 100 && s2Comp && !s3Comp) {
    statusText.innerHTML = 'Preparing Installer...'
    log.info('[updaterjs]Update Downloaded')
    log.info('Value: ' + value)
    value += 1
    b.set(value)
    if (value === 100) {
      s3Comp = true
      log.info('s3Comp = true')
    }
  }

  if (updateNotAvail && value <= 100) {
    statusText.innerHTML = 'No update available...'
    log.info('[updaterjs]Update Not Available!')
    log.info('Value: ' + value)
    value += 5
    b.set(value)
    if (value === 100) {
      log.warn('No update available and value = ' + value + ' Starting Auth...')
      startPoscon = true
      //ipcTest.send('start-auth')
      //clearInterval()
      setTimeout(function() {
        ipcTest.send('start-auth')
        clearInterval()
      }, 4500)
    }
  }

  if(startPoscon) {
    statusText.innerHTML = 'Starting POSCON'
    log.info('[updaterjs]Update not available && starting poscon')
    log.info(`Value: ${value}`)
  }

  if (value === 100 && updateDownloaded) {
    statusText.innerHTML = 'Installing....'
    log.warn('[updaterjs]Update installing...')
    ipcTest.send('update-install')
    clearInterval()
  }
}, 50)

ipcTest.on('update-check', (event, result) => {
  log.info('update-check')
  //@TODO
  //Perhaps add an update checker variable here and do something with it?
})

ipcTest.on('update-available', (event, result) => {
  updateAvailable = true
})

ipcTest.on('update-dl', (event, result) => {
  updateDownloaded = true
})

ipcTest.on('update-not-available', (event, result) => {
  updateNotAvail = true
})
