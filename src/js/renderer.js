const ipcRenderer = require('electron').ipcRenderer
const app = require('electron').remote.app
const appVersion = require('electron').remote.app.getVersion()
const remote = require('electron').remote
const child_process = require('child_process')
const log = require('electron-log')
const settings = require('electron-settings');
window.$ = window.jQuery = require('jquery')

document.addEventListener('DOMContentLoaded', pageLoaded)
function pageLoaded () {
  // This code will run after the page has been loaded
  $('#titlebar_lblversion').text('v' + appVersion + '-beta')

  // set titlebar functionality
  $('#titlebar_btnclose').click(function () {
    // send close event to main
    app.quit()
    remote.getCurrentWindow().close()
    ipcRenderer.send('quit-app');
  })

  $('#titlebar_btnmin').click(function () {
    remote.BrowserWindow.getFocusedWindow().minimize()
  })

  $("#btnAuthorize").click(function() {
    log.info("User requested login...")
  })

  ipcRenderer.on('logout', () => {
    log.info("logout received from renderer")

    ipcRenderer.send('logout-auth')
  })

}
window.onload =()=>{
  var webview = document.querySelector('webview');
  webview.addEventListener('dom-ready', ()=>{
    log.info('Settings status...')
    if(settings.get('config.hasXPClientInstalled') === false || settings.get('config.hasXPClientInstalled') === undefined){
      webview.executeJavaScript(`document.getElementById('xplaneLaunchBtn').innerHTML = 'Download'`)
      webview.executeJavaScript(`document.getElementById('xplaneDownloadBtn').innerHTML = 'Download'`)
    }

    if(settings.get('config.hasESPClient') === false || settings.get('config.hasESPClient') === undefined){
      webview.executeJavaScript(`document.getElementById('p3dLaunchBtn').innerHTML = 'Download'`)
      webview.executeJavaScript(`document.getElementById('p3dDownloadBtn').innerHTML = 'Download'`)
    }

    if(settings.get('config.hasRadarClient') === false || settings.get('config.hasRadarClient')=== undefined){
      webview.executeJavaScript(`document.getElementById('radarLaunchBtn').innerHTML = 'Download'`)
      webview.executeJavaScript(`document.getElementById('radarDownloadBtn').innerHTML = 'Download'`)
    }
    
    ipcRenderer.on('reload-webview', ()=>{
      webview.reload()
    });
  });
}



//Will overlay the mainWindow while modal setting open
ipcRenderer.on('settings-req',(event, args)=>{
  log.info('ipcRender has recived the request');
  document.getElementById("step-modal").style= " display: block;position: relative;width: 100vw;height: 100vh;background:rgba(26,21,44, 0.9); top: 0px;left: 0;";
});

//this will call after the setting windows is  closed to remove overlay
ipcRenderer.on('settings-closed', (event, args)=>{
 document.getElementById('step-modal').style ='display: none;position: absolute;width: 100vw;height:100vh;background: #1e1933; top: 0px;left: 0;'
})

//utility function
function showToast() {
  // Get the snackbar DIV
  var x = document.getElementById("snackbar");

  // Add the "show" class to DIV
  x.className = "show";

  // After 3 seconds, remove the show class from DIV
  setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

//utility function
function copyStringToClipboard (str) {
  // Create new element
  var el = document.createElement('textarea');
  // Set value (string to be copied)
  el.value = str;
  // Set non-editable to avoid focus and move outside of view
  el.setAttribute('readonly', '');
  el.style = {position: 'absolute', left: '-9999px'};
  document.body.appendChild(el);
  // Select text inside element
  el.select();
  // Copy text to clipboard
  document.execCommand('copy');
  // Remove temporary element
  document.body.removeChild(el);
  log.info("String copied: " + str)
}

