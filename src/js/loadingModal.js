const ipcProgress = require('electron').ipcRenderer;
const remote = require('electron').remote
const log = require('electron-log');
let b1 = document.querySelector('.ldBar');
let b = new ldBar(b1);
b.set(0)
let tot = 0;

ipcProgress.on('update-install-progress', (event, increment)=>{
    document.getElementById('progressText').innerHTML = 'Downloading...';
    tot += increment
    b.set(tot)
    if(tot > 50){
        document.getElementById('progressText').innerHTML = 'Installing...';
    }
    if(tot > 80){
        document.getElementById('progressText').innerHTML = 'Copying new files...';
    }

    if(tot >= 100){
        document.getElementById('progressText').innerHTML = 'Finalizing Installation...';
    }
})

ipcProgress.on('no-update', (event, status)=>{
    document.getElementById('progressText').innerHTML = status;
    setTimeout(()=>{
        remote.getCurrentWindow().close();
    }, 4000)
})