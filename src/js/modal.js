const ipcModal = require("electron").ipcRenderer
const app = require("electron").remote.app
const {dialog} = require("electron").remote;
const remote = require('electron').remote
const log = require('electron-log')
const settings = require('electron-settings');
const fs = require('fs');

window.$ = window.jQuery = require('jquery')

document.addEventListener('DOMContentLoaded',pageLoaded)

function pageLoaded(){
    ipcModal.on('display-info', (event,options)=>{
        document.getElementById('titleModal').innerHTML = options.title
        document.getElementById('modalMessage').innerHTML = options.message
        if(options.buttons !== undefined && options.buttons.length <= 2){
            if(options.buttons.length === 1){
                document.getElementById('btnDef').innerHTML = options.buttons[0];
                document.getElementById('btn').style = 'display:none'
            }else if(options.buttons.length === 2){
                document.getElementById('btnDef').innerHTML = options.buttons[0];
                document.getElementById('btn').innerHTML = options.buttons[1]
            }
        }
        remote.getCurrentWindow().show();
    });

    $('#btnDef').click(()=>{
        let response = 0;
        ipcModal.send('modal-response', response);
    })

    $('#btn').click(()=>{
        let response = 1;
        ipcModal.send('modal-response', response);
    })
}