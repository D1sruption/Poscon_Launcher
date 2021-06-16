const log = require('electron-log');
const proc = require('child_process');
const settings = require('electron-settings');
const fs = require('fs')
const fsExtra = require('fs-extra');
const reg = require('winreg');

/**
 * 
 * @param {string} processName The executable name to check
 * @param {function} cb The callback function
 * @returns {boolean} True: Process running, else false
 */
exports.isProcessRunning = (processName, cb) =>{
    const cmd = (()=>{
        switch (process.platform) {
            case 'win32' : return `tasklist`;
            case 'darwin' : return `ps -ax | grep ${processName}`;
            case 'linux' : return `ps -A`;
            default: return false;
        }
    })();
    proc.exec(cmd, (err, stdout, stderr) => {
        cb(stdout.toLowerCase().indexOf(processName.toLowerCase()) > -1);
    });
}


exports.simExist = (checkDir, settingsKey) =>{
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
 * Function to execute exe
 * @param {string} fileName The name of the executable file to run.
 * @param {string[]} params List of string arguments.
 * @param {string} path Current working directory of the child process.
 */
exports.execute = (fileName, params, path)=>{
    log.info("Expected URL:: " + path + fileName);
    let promise = new Promise((resolve, reject) => {
      proc.execFile(fileName,{ cwd: path}, (err, data) => {
        log.info(data)
          if (err) reject(err);
          else resolve(data);
      });
    });
  return promise;
}

/**
 * Install pending updates already downloaded but not installed
 * @param {String} Temp Temp dir
 * @param {String} destDir Destination dir
 * @param {ipcMain} ipcMain ipcMain
 */
exports.installUpdatesPending = (Temp, destDir, ipcMain)=>{
    if(fsExtra.pathExistsSync(Temp+'\\')=== true && fs.readdirSync(Temp).length > 0){
        let files = fs.readdirSync(Temp+'\\');
        let fileNumber = fs.readdirSync(Temp+'\\').length;
        let index= 0;
        files.map((file)=>{
          fsExtra.copy(Temp+'\\'+file, destDir+file).then(()=>{
            settings.set('config.updateStatus' ,true);
            log.info('Copied file to dest: ' + destDir + ' File name: '+ file);
          }).catch((err)=>{
            settings.set('config.updateStatus' ,false);
            log.error('ERROR while copying file reason: '+ err.message);
          }).finally(()=>{
            index += 1
            if(index === fileNumber){
              ipcMain.emit('update-finished', Temp);
            }
          })
        });
      }else{
        log.warn('Nothing to install')
      }
}

exports.checkMSCVx64 = ()=>{
  const key = new reg({
    hive: reg.HKLM,
    key:'\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64'
  })
  
  key.values((err, res)=>{
    if(err) log.error(err);
    try {
      var defaultValue = res[0];
      log.info("REG::" + defaultValue.value);
      if(defaultValue != null && defaultValue.value.includes('14.24.28127.04') === true){
        log.info("User has C++ Redistributable x64 requirement met!");
        settings.set('config.IsMSVCInstalled', true);
        log.info("New MSVC setting: " + settings.get('config.IsMSVCInstalled'));
      }else{
        log.error("User needs to install C++ Redistributable package!");
        settings.set('config.IsMSVCInstalled', false);
        log.info("New MSVC setting: " + settings.get('config.IsMSVCInstalled'));
      }
    } catch (err) {
      log.error("User needs to install C++ Redistributable package!");
      settings.set('config.IsMSVCInstalled', false);
      log.info("New MSVC setting: " + settings.get('config.IsMSVCInstalled'));
    }
  })
}

exports.checkMSCVx86 = () =>{
  const key = new reg({
    hive: reg.HKLM,
    key:'\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x86'
  })
  
  key.values((err, res)=>{
    if(err) log.error(err);
    try {
      var defaultValue = res[0];
      log.info("REG::" + defaultValue.value);
      if(defaultValue != null && defaultValue.value.includes('14.23.27820.00') === true){
        log.info("User has C++ Redistributable x86 requirement met!");
        settings.set('config.IsMSVCInstalledx86', true);
        log.info("New MSVC setting: " + settings.get('config.IsMSVCInstalledx86'));
      }else{
        log.error("User needs to install C++ Redistributable package!");
        settings.set('config.IsMSVCInstalledx86', false);
        log.info("New MSVC setting: " + settings.get('config.IsMSVCInstalledx86'));
      }
    } catch (err) {
      log.error("User needs to install C++ Redistributable package!");
      settings.set('config.IsMSVCInstalledx86', false);
      log.info("New MSVC setting: " + settings.get('config.IsMSVCInstalledx86'));
    }
  })
}

exports.unistallClients = (destDir, folderName, settingDest,ipcMain)=>{
  fsExtra.emptyDir(destDir+folderName).then((res)=>{
    log.info(res);
  }).catch((err)=>{
    log.error(err)
  }).finally(()=>{
    if(fs.readdirSync(destDir+folderName).length === 0){
      fsExtra.remove(destDir+folderName).then((res)=>{
        log.info(res)
      }).catch((err)=>{
        log.info(err)
      }).finally(()=>{
        settings.set(settingDest, false)
        ipcMain.emit('unistall-done');
      })
    }
  })
}


/**
 * @description move files to the proper folder this is used for model installation Handling
 * @param {String} tmpDir temp dir
 * @param {string} outDir output dir
 * @param {ipcMain} ipcMain Main inter process com obj
 */
exports.compInstallation = (tmpDir,outDir,loadingModal,ipcMain)=>{
  log.info('here')
  if(fsExtra.existsSync(tmpDir+'x-plane')){
    let files = fsExtra.readdirSync(tmpDir + 'x-plane');
    let noFiles = fsExtra.readdirSync(tmpDir + 'x-plane').length;
    if (noFiles > 0) {
      let index = 0;
      files.map((file) => {
        log.info('Trying moving file: ' + file);
        fsExtra.move(tmpDir + 'x-plane\\' + file, outDir + 'Models\\' + file).then(()=>{
          index++;
          log.info("===============================================================================================")
          log.info('File moved successfully at index: ' + index + ', file name: ' + file);
          log.info("===============================================================================================\n")
        }).catch((err)=>{
          log.error(err)
        }).finally(()=>{
          if (index === noFiles) {
            loadingModal.webContents.send('update-install-progress', 20);
            log.info('Completed')
            ipcMain.emit('installation-com');
          }
        });
      })
    }
  }
}