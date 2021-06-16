const ipcSettings = require("electron").ipcRenderer
const app = require("electron").remote.app
const {dialog} = require("electron").remote;
const remote = require('electron').remote
const log = require('electron-log')
const settings = require('electron-settings');
const fs = require('fs');

const fsxp3dPathSetting = settings.get('config.FSXP3DDirectory'); 
const radarPathSetting = settings.get('config.RadarDirectory');
const xplanePathSetting = settings.get('config.XPlaneDirectory');
const connectionSetting = settings.get('config.connectionPower');
const fsxp3dModelSetting  = settings.get('config.fsxp3dModelDirectory');

window.$ = window.jQuery = require('jquery')

document.addEventListener('DOMContentLoaded', pageLoaded);

//Path remove exe and return string if exe is not found return null
function searchSimExe(path, exeFile) {
    if(fs.readdirSync(path).indexOf(exeFile)> -1){
        return true;
    }else{
        return false;
    }
}

//General function to open OFD
function createOFD(options){
    let ofdGeneral;
    try {
        ofdGeneral = dialog.showOpenDialog(options)
        ofdGeneral = ofdGeneral.toString()
        return ofdGeneral;
    } catch (err) {
        log.error(err);
        return null;
    }
}

function simExist(checkDir, settingsKey){
    if(fs.existsSync(checkDir).valueOf() === true){
        if(fs.readdirSync(checkDir).length > 0){
            settings.set(settingsKey, true)
            log.info('detected value:  '+ settings.get(settingsKey)+ ' for : '+ checkDir);
            return true;
        }else{
            settings.set(settingsKey, false)
            log.info('detected value:  '+ settings.get(settingsKey)+ ' for : '+ checkDir)
            return false;
        }
    }else{
        settings.set(settingsKey, false)
        log.info('detected value:  '+ settings.get(settingsKey)+ ' for : '+ checkDir)
        return false;
    }
}

/**
 * @description Executed on DOM loaded handle save and all other elements
 */
function pageLoaded (){

    $('#submit').click(()=>{
        // save data from here on sub
        const fsxp3dPath = document.getElementById("fsxp3dDir").innerHTML;
        const xplanePath = document.getElementById("xplaneDir").innerHTML;
        const radarPath = document.getElementById("radarDir").innerHTML;
        const fsxp3dModelPath = document.getElementById("fsxp3dModelsDir").innerHTML;
        const connectionPower = $('#inputSpeed').val();



        if(fsxp3dPath !== undefined && fsxp3dPath !== 'Not Detected' && fsxp3dPath !== fsxp3dPathSetting){
            settings.set('config.FSXP3DDirectory', fsxp3dPath);
            let res = simExist(fsxp3dPath+'\\P3D Pilot Client', 'config.hasESPClient');
            log.info('New Directory for P3D : '+settings.get('config.FSXP3DDirectory')+ ' Exist : '+ res);
        }

        if(radarPath !== undefined && radarPath !== 'Not Detected' && radarPath !== radarPathSetting){
            settings.set('config.RadarDirectory', radarPath);
            let res = simExist(radarPath, 'config.hasRadarClient')
            log.info('New Directory for FSX : '+settings.get('config.RadarDirectory')+ ' Exist : '+ res);
        }

        if( xplanePath !== undefined && xplanePath !== 'Not Detected' && xplanePath !== xplanePathSetting){
            settings.set('config.XPlaneDirectory', xplanePath);
            let res = simExist(xplanePath+'\\Resources\\plugins\\POSCON\\','config.hasXPClientInstalled');
            log.info('New Directory for X-plane : '+settings.get('config.XPlaneDirectory')+ ' Exist : '+ res);

        }

        if(fsxp3dModelPath !== undefined && fsxp3dModelPath !== 'Not Detected' && fsxp3dModelPath !== fsxp3dModelSetting){
            settings.set('config.fsxp3dModelDirectory', fsxp3dModelPath);
            log.info('New Directory for Model : ' + settings.get('config.fsxp3dModelDirectory'));
        }

        if($('#inputSpeed').val()!== connectionSetting){
            settings.set('config.connectionPower',connectionPower)
            log.info('New connection power settings value: '+ settings.get('config.connectionPower'));
        }

        remote.getCurrentWindow().close();// close window after save

    });

    $('#fsxp3dDirBtn').click(()=>{
        let ofdFSXP3d;
        let options = {
            title: "Select your AppData POSCON destination folder for P3D & FSX Client",
            defaultPath: process.env.APPDATA+'\\POSCON\\',
            properties: ['openDirectory'],
        };
        ofdFSXP3d = createOFD(options);
        if(ofdFSXP3d !== null){
            document.getElementById('fsxp3dDir').innerHTML = ofdFSXP3d;
        }else{
            document.getElementById('fsxp3dDir').innerHTML = 'Not Detected';
        }
    });

    $('#radarDirBtn').click(()=>{
        let ofdRadar;
        let options = {
            title: "Select your destination folder for Radar Client",
            defaultPath: "C:\\Program Files (x86)\\POSCON",
            properties: ['openDirectory'],
        };
        ofdRadar = createOFD(options);
        if(ofdRadar !== null){
            document.getElementById('radarDir').innerHTML = ofdRadar;
        }else{
            document.getElementById('radarDir').innerHTML = 'Not Detected';
        }
    });

    $('#xplaneDirBtn').click(()=>{
        let ofdXplane;
        let options = {
            title: "Select your XPlane folder",
            defaultPath: "C:\\",
            properties: ['openDirectory'],
        }
        ofdXplane = createOFD(options);
        isExeFinded = searchSimExe(ofdXplane, 'X-Plane.exe');
        if(isExeFinded === true){
            document.getElementById('xplaneDir').innerHTML = ofdXplane;
        }else{
            dialog.showErrorBox('File Not Found','We could not locate your X-Plane.exe file')
            document.getElementById('xplaneDir').innerHTML = 'Not Detected';
        }
        
    })

    $('#fsxp3dModelsBtn').click(()=>{
        let ofdModel;
        try {
            ofdModel = dialog.showOpenDialog({
                title: 'Select your  P3D & FSX Models folder',
                defaultPath: "C:\\",
                properties:['openDirectory'],
            });
            ofdModel = ofdModel.toString();
            document.getElementById('fsxp3dModelsDir').innerHTML = ofdModel;
        } catch (err) {
            log.error('[OFD ERROR]: '+ err);
        }
    })

    $('#inspect').click(()=>{
        remote.getCurrentWindow().webContents.openDevTools()
    });

    $("#close").click(()=>{
        remote.getCurrentWindow().close();
    });
}

/**
 * Set innerHTML settings  onload so that the user knows 
 * what he has selected 
 * NOTE: XPlane base dir Loaded
 */
window.onload = function(){
    let fsxp3dEle = this.document.getElementById('fsxp3dDir');
    let xplaneEle = this.document.getElementById('xplaneDir');
    let radarEle = this.document.getElementById('radarDir');
    let fsxp3dModelEle = this.document.getElementById('fsxp3dModelsDir');

    
    if(fsxp3dPathSetting === undefined || fsxp3dPathSetting === '' || fsxp3dPathSetting ==='C:\\'){
        fsxp3dEle.innerHTML ='Not Detected';
    }else{
        fsxp3dEle.innerHTML = fsxp3dPathSetting;
    }

    if(radarPathSetting === undefined || radarPathSetting === '' || radarPathSetting ==='C:\\'){
        radarEle.innerHTML ='Not Detected';
    }else{
        radarEle.innerHTML = radarPathSetting;
    }

    if(xplanePathSetting === undefined || xplanePathSetting === ''|| xplanePathSetting ==='C:\\'){
        xplaneEle.innerHTML = 'Not Detected';
    }else{
        xplaneEle.innerHTML = xplanePathSetting;
    }

    if(fsxp3dModelSetting === undefined || fsxp3dModelSetting === '' || fsxp3dModelSetting === 'C:\\'){
        fsxp3dModelEle.innerHTML = 'Not Detected';
    }else{
        fsxp3dModelEle.innerHTML = fsxp3dModelSetting;
    }

    if(connectionSetting === undefined || connectionSetting === '-'){
        $('#inputSpeed').val("-");
    }else{
        $('#inputSpeed').val(connectionSetting);
    }
}

