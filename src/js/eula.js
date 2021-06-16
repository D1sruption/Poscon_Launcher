const ipcEula = require("electron").ipcRenderer
const app = require("electron").remote.app
const {dialog} = require("electron").remote;
const remote = require('electron').remote
const log = require('electron-log')
const settings = require('electron-settings');

window.$ = window.jQuery = require('jquery')

document.addEventListener('DOMContentLoaded', pageLoaded)

function pageLoaded(){
    //Sett buttons disabled
    document.getElementById('accept').disabled = true;
    document.getElementById('decline').disabled = true;
    
    $(".EULAOuter").scroll(function() {
        var outerDiv = $(this);
        var innerDiv = $(">.EULAInner", $(this));
        var ScrollMod = 1;
        if (outerDiv.offset().top < innerDiv.outerHeight()) {
            ScrollMod = -1;
        }
        if (Math.round((ScrollMod * innerDiv.offset().top) + outerDiv.height() + outerDiv.offset().top) >= innerDiv.outerHeight() && Math.abs(innerDiv.offset().top) != 0) {
            document.getElementById('accept').disabled = false;
            document.getElementById('decline').disabled = false;
            document.getElementById('accept').style = "transition: 0.2s;background: #403a60;text-align: center;padding: 0 1em;color: #ffffff;font-weight: 600;border: none;line-height: 40px;border-radius: 4px;outline: none;display: inline-block;user-select: none;"
            document.getElementById('decline').style = "transition: 0.2s;background: #403a60;text-align: center;padding: 0 1em;color: #ffffff;font-weight: 600;border: none;line-height: 40px;border-radius: 4px;outline: none;display: inline-block;user-select: none;"
            $(this).unbind("scroll");
        } else {
            document.getElementById('accept').disabled = true;
            document.getElementById('decline').disabled = true;
        }
    });

    $('#inspect').click(()=>{
        remote.getCurrentWindow().webContents.openDevTools()
    });

    $('#accept').click(()=>{
        if (document.getElementById('accept').disabled === false) {
            settings.set('config.hasEULAAccepted', true);
            log.info('New EULA setting: ' + settings.get('config.hasEULAAccepted'));
            ipcEula.send('tso-accepted', true);//Send to main->open settings
        }
    });

    $('#decline').click(()=>{
        if(document.getElementById('decline').disabled === false){
            settings.set('config.hasEULAAccepted', false);
            log.info('EULA denied new setting: '+ settings.get('config.hasEULAAccepted')+' will not download');
            ipcEula.send('tso-accepted', false);
        }
    })
}