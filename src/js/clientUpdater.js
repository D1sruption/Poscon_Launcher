const log = require('electron-log');
const settings = require('electron-settings');
const down = require('poscon-api-down');
const fs = require('fs');
const fsExtra = require('fs-extra')
const store = require('electron-store');
const keytar = require('keytar');
const tmpFolder = settings.get('config.tmpFolder');
const sim = require('../helpers/packeges');
let groups;

//Get encrypted data
keytar.getPassword('POSCONauth', 'launcher').then((key) => {
  let tokenData = new store({ name: 'data', encryptionKey: key });
  groups = tokenData.get('tokenData.groups');
  log.info('[ClientUpdater] Recived User group: '+ groups);
});

let XPlaneDirectory = settings.get('config.XPlaneDirectory');
let P3DFSXClientDir = settings.get('config.FSXP3DDirectory');
let RadarClientDir = settings.get('config.RadarDirectory');

/*********DETECT SOFTWARE SECTION***********/
//Search for files and folders inside the poscon plugin folder
if (XPlaneDirectory !== undefined) {
  sim.simExist(XPlaneDirectory+'\\Resources\\plugins\\POSCON\\','config.hasXPClientInstalled');
}

//P3D and FSX 
if(P3DFSXClientDir !== undefined) {
  sim.simExist(P3DFSXClientDir+'\\P3D Pilot Client\\', 'config.hasESPClient');
}

// Radar client
if(RadarClientDir !== undefined){
  sim.simExist(RadarClientDir, 'config.hasRadarClient');
}

/**** END SECTION  ****/

let buildChannel = 'Beta';

log.info('[ClientUpdaterJS]Initializing Client Updater...')


if (buildChannel == "Beta") {
  log.info('Rx check xplane updates');
  sim.isProcessRunning('X-Plane.exe', (isRunning)=>{
    if(isRunning === true){
      log.warn('X-Plane is running downloading update in temp setting pedding status true')
      fsExtra.ensureDir(tmpFolder+'clients\\xplane\\').then(()=>{
        checkUpdate(settings.get('config.XPlaneDirectory') + '\\Resources\\plugins\\POSCON\\', tmpFolder+'clients\\xplane\\',"clients/X-Plane/Beta/POSCON/", 'config.hasXPClientInstalled','config.XpUpdatePending', true);
      }).catch((err)=>{
        log.error('ERROR while validating path err:'+ err.message)
      })
    }else{
      settings.set('config.XpUpdatePending', false);//override the checkUpdate
      log.info('Checking update and downloading on Xplane Dir')
      checkUpdate(settings.get('config.XPlaneDirectory') + '\\Resources\\plugins\\POSCON\\', settings.get('config.XPlaneDirectory') + '\\Resources\\plugins\\POSCON\\',"clients/X-Plane/Beta/POSCON/", 'config.hasXPClientInstalled','config.XpUpdatePending', false);
    }
  });
}

if(buildChannel == "Beta"){
  log.info('Checking ESP Clients');
  sim.isProcessRunning('Prepar3D.exe', (isRunning)=>{
    if(isRunning === true){
      log.warn('Prepar3D is runnig  downloading on temp setting update status on pedding true')
      fsExtra.ensureDir(tmpFolder+'clients\\esp').then(()=>{
        checkUpdate(settings.get('config.FSXP3DDirectory')+'\\P3D Pilot Client\\',tmpFolder+'clients\\esp\\',"clients/simconnect/beta/",'config.hasESPClient','config.EspUpdatePending', true);
      }).catch((err)=>{
        log.error('ERROR while validating path err:'+ err.message)
      })
    }else{
      settings.set('config.EspUpdatePending', true);//override the checkUpdate
      log.info('Checking update and downloading P3D & FSX on Dir')
      checkUpdate(settings.get('config.FSXP3DDirectory')+'\\P3D Pilot Client\\',settings.get('config.FSXP3DDirectory')+'\\P3D Pilot Client\\',"clients/simconnect/beta/",'config.hasESPClient', 'config.EspUpdatePending', false);
    }
  })
}


if(buildChannel==='Beta'){
  sim.isProcessRunning('X-Plane.exe',(isRunning)=>{
    if(isRunning === true){
      log.warn('Not updating not adding to pendding queue');
    }else{
      log.info('Checking update and downloading on Models dir')
      checkUpdate(settings.get('config.XPlaneDirectory')+'\\Resources\\plugin\\POSCON\\Models',settings.get('config.XPlaneDirectory')+'\\Resources\\plugin\\POSCON\\Models', "clients/X-Plane/Beta/POSCON/Models", 'config.ModelsInstalled', 'config.ModelsUpdate', false);
    }
  })
}


/**
 * checkUpdates
 * @param {String} checkDir the dir to check updates
 * @param {String} destDir the actual destination dir
 * @param {String} remoteChannel cdn repo
 * @param {String} settingDest settings string 
 * @param {String} settingPendingDest if the update need to be pending
 * @param {Boolean} pendingStatus boolean 
 */
function checkUpdate(checkDir,destDir, remoteChannel, settingDest,settingPendingDest, pendingStatus){
    if(settings.get(settingDest)=== true){
      down.checkDownload('cdn.poscon.com', checkDir, "MD5", async (result) => {
        if (result.res) {
          log.info("Client updates found! Update will download:  "+ result.dwnLength + " files ");
          log.info("Checking: " + destDir);
          //CDN, Download Dir, What client, download item async
          down.getDownload('cdn.poscon.com', destDir, "MD5", 0, remoteChannel, async(downResult) => {
            if(downResult == "done") {
              log.info("::::::::::::DONE:::::::::::::");
            }
            if(pendingStatus === true){
              settings.set(settingPendingDest, pendingStatus);
            }
          },
          
          async(downItemResultXP) => {
            var xFormatResult = downItemResultXP.substring(downItemResultXP.lastIndexOf("/") + 1);
            var xResult = xFormatResult.split(" ")[0];
            log.info("==============DOWN ITEM RESULT===============");
            log.info("xResult: " + xResult);
          }

          );
          log.info("Finished");
        } else {
          log.info("No client updates available");
          settings.set(settingPendingDest, false);
        }
      }, remoteChannel);
    }else{
      log.info("skipping updater logic")
    }
  }
