const { app, BrowserWindow, autoUpdater, session, dialog } = require("electron");
const filter = {
  urls: ['https://*.poscon.net/*', '*://*.*.poscon.net']
}
const electron = require('electron');
var protocol = electron.protocol;
const log = require("electron-log");
const ipcMain = require("electron").ipcMain;
const DOMAIN = "https://releases.poscon.net/files";
const suffix =
  process.platform === "darwin"
    ? `/RELEASES.json?method=JSON&version=${app.getVersion()}`
    : "";
const path = require('path');
const isDev = require('electron-is-dev');
const gotTheLock = app.requestSingleInstanceLock();
const settings = require('electron-settings');
const poscon =require('poscon-api-client');
const {download} = require('electron-dl') //for downloading MSVC packages
const reg = require('winreg');
const fs = require('fs');
const fsExtra = require('fs-extra');
const sim = require('./helpers/packeges');

var exec = require('child_process').execFile;
var down = require('poscon-api-down');
var zip = require('cross-zip');

//Make single instance here before the whole thing loads!!
if (gotTheLock === false) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if(mainWindow) {
      if(mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus();
    }
  })
}

//set as default protocol client for poscon:// redirects
app.setAsDefaultProtocolClient('poscon');

//output current environment
log.info("Developer Env: " + isDev);

//monitor this..purpose is to prevent app from running while installing
//not sure if this will cause future issues or not.
if (require('electron-squirrel-startup')) return app.quit();

//set settings defaults
//settings.set('config.FSXP3DDirectory', process.env.APPDATA + '\\POSCON');
settings.set('config.IsFirstRun', true);
settings.set('config.tmpFolder', process.env.APPDATA +'\\POSCON Launcher Beta\\tmp\\')
//settings.set('config.XPlaneDirectory', 'C:\\Users\\aaron_fankhauser\\Desktop\\X-Plane 11\\'); //REMOVE THIS FOR PRODUCTION
//settings.set('config.HasSetXPDir', true);//REMOVE THIS FOR PRODUCTION

var xpDir = settings.get('config.XPlaneDirectory')+'\\';
var fsxp3dDir = settings.get('config.FSXP3DDirectory')+'\\';
var pluginDir = settings.get('config.XPlaneDirectory') + '\\Resources\\plugins\\POSCON\\';
var modelDir = settings.get('config.XPlaneDirectory') + '\\Models\\';
//var POSCONDir = settings.get('config.DefaultPOSCONDirectory');

var radarDirectory = settings.get('config.RadarDirectory'); //@TODO
var fsxP3dModelDir = settings.get('config.fsxp3dModelDirectory');
var MSVCMet = settings.get('config.IsMSVCInstalled');
var firstRun = settings.get('config.IsFirstRun');
var hasSetXPDir = settings.get('config.HasSetXPDir');
var mscvX64Uri = 'https://aka.ms/vs/16/release/vc_redist.x64.exe'

//print settings at start for debug::
log.info("Temp Folder: " + settings.get('config.tmpFolder'));
log.info("XP Directory: " + xpDir);
log.info("Has Set XP Dir: " + hasSetXPDir);
log.info("P3D/FSX POSCON Client Directory: " + fsxp3dDir);
log.info("XP Plugin Directory: " + pluginDir);
log.info("XP Model Directory: " + modelDir);
log.info("Radar Directory: " + radarDirectory);

//let isDev = true;
let access_token;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let loaderWindow;
let mainWindow;
let EULAWindow;
let windowSettings;
let modalWindow;
let loadingModal;

//Check registry MSCV
sim.checkMSCVx64();
sim.checkMSCVx86();

async function installMSVC(win) {
  if(fs.existsSync(process.env.APPDATA+'\\POSCON Launcher Beta\\tmp') === false){
    fs.mkdirSync(process.env.APPDATA+'\\POSCON Launcher Beta\\tmp')
  }
  let filename;
  await download(win,mscvX64Uri, {directory: process.env.APPDATA +'\\POSCON Launcher Beta\\tmp', onStarted:(item)=>{
    filename = item.getFilename();
  }})
  if(fs.existsSync(process.env.APPDATA +'\\POSCON Launcher Beta\\tmp\\'+filename)=== true){
    sim.execute(filename, '',process.env.APPDATA+'\\POSCON Launcher Beta\\tmp\\').then((res)=>{
      log.info('MSCV Installed')
      settings.set('config.IsMSVCInstalled', true);
    }).catch((err)=>{
      log.error(err)
      settings.set('config.IsMSVCInstalled', false);
    })
  }
}

//
const createLoader = () => {
  // Create the browser window.
  loaderWindow = new BrowserWindow({
    width: 400,
    height: 400,
    webPreferences: { webSecurity: false, allowRunningInsecureContent: true },
    frame: false,
    resizable: false,
    icon: path.join(__dirname, 'assets/icons/ico/asset_6.ico')
  });

  log.info("loaderWindow created");

  // and load the index.html of the app.
  loaderWindow.loadURL(`file:///${__dirname}/loader.html`);
  log.info("Loaded loaderWindow");

  // Open the DevTools.
  //loaderWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  loaderWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    //loaderWindow = null;
  });
}

const createAuthWindow = () => {
  // Create the browser window.
  authWindow = new BrowserWindow({
    width: 400,
    height: 400,
    webPreferences: { webSecurity: false, allowRunningInsecureContent: true, nodeIntegration: true },
    frame: false,
    resizable: false,
    icon: path.join(__dirname, 'assets/icons/ico/asset_6.ico')
  });

  log.info("auth window created");

  // and load the index.html of the app.
  authWindow.loadURL(`file:///${__dirname}/auth.html`,
  //mainWindow.loadURL(`https://hq.poscon.net/`,
  {userAgent: 'POSCONLauncher/0.1.0 (POSCON Launcher)'}
  );
  log.info("Loaded authWindow");
  authWindow.setMenuBarVisibility(false);

  // Open the DevTools.
  //authWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    authWindow.on("closed", () => {
      log.info("Auth Window Closed");
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      //mainWindow = null;
      //app.quit();
    });
}

const createEULAModal = ()=>{
  let position = mainWindow.getPosition();
  let mainWindowSize = mainWindow.getSize();
  EULAWindow = new BrowserWindow({
    x: Math.floor(position[0]+((mainWindowSize[0]/2)-(600/2))),
    y: Math.floor(position[1]+((mainWindowSize[1]/2)-(600/2))),
    width: 600,
    height: 600,
    resizable: false,
    show:true,
    parent:mainWindow,
    modal: true,
    webPreferences: {webSecurity:false, allowRunningInsecureContent: true, nodeIntegration: true},
    frame: false,
    icon:path.join(__dirname,'assets/icons/ico/asset_6.ico')
  });

  EULAWindow.loadURL(`file:///${__dirname}/eula.html`)

  EULAWindow.on('close', ()=>{
    mainWindow.webContents.send('settings-closed');
  })
}

const createModal = (options)=>{
  let position = mainWindow.getPosition();
  let mainWindowSize = mainWindow.getSize();

  modalWindow = new BrowserWindow({
    x:Math.floor(position[0]+((mainWindowSize[0]/2)-(500/2))),
    y:Math.floor(position[1]+((mainWindowSize[1]/2)-(200/2))),
    width:500,
    height:200,
    parent: mainWindow,
    show:false, 
    modal: true,
    resizable: false,
    webPreferences: {webSecurity: false, allowRunningInsecureContent: true, nodeIntegration: true},
    icon: path.join(__dirname, 'assets/icons/ico/asset_6.ico'),
    frame: false
  });

  modalWindow.loadURL(`file:///${__dirname}/modal.html`);

  modalWindow.on('ready-to-show',()=>{
    log.info('Modal open')
    let opts = options;
    modalWindow.webContents.send('display-info', opts);
  })

  modalWindow.on('close', ()=>{
    mainWindow.webContents.send('settings-closed');//fiers to the mainwindow 
  })
}

const createLoading = ()=>{
  let position = mainWindow.getPosition();
  let mainWindowSize = mainWindow.getSize();
  loadingModal = new BrowserWindow({
    x:Math.floor(position[0] + ((mainWindowSize[0]/2)-(300/2))),
    y:Math.floor(position[1] + ((mainWindowSize[1]/2)- (145/2))),
    width: 300, 
    height: 145,
    parent:mainWindow,
    modal:true,
    show:true,
    webPreferences:{webSecurity:false, allowRunningInsecureContent: true, nodeIntegration:true},
    frame:false,
    resizable:false,
    icon: path.join(__dirname,'assets/icons/ico/asset_6.ico')
  })
  loadingModal.loadURL(`file:///${__dirname}/loadingModal.html`)

  loadingModal.on("close", ()=>{
    log.info('Update finished')
  })
}

//Sttings modal
const createSettings = () => {
  //Get mainwindow as reference for window centering
  let position = mainWindow.getPosition();
  let mainWindowSize = mainWindow.getSize()

  //Window creation
  windowSettings = new BrowserWindow({
    x:Math.floor(position[0]+((mainWindowSize[0]/2)-(1100/2))),
    y:Math.floor(position[1]+((mainWindowSize[1]/2)-(600/2))),
    width: 1100,
    height: 600,
    parent: mainWindow,
    show: true,
    modal: true,
    webPreferences: { webSecurity: false, allowRunningInsecureContent: true, nodeIntegration: true },
    frame: false,
    resizable: true,
    icon: path.join(__dirname, 'assets/icons/ico/asset_6.ico')
  });

  log.info('Window Settings Created');

  //windowSettings.webContents.openDevTools()
  windowSettings.loadURL(`file:///${__dirname}/settings.html`);
  //********** WINDOW SETTING SECTION **********/ 
  //Called when settings closed
  windowSettings.on("close", () => {
    log.info('Settings windows closed');
    mainWindow.webContents.send('settings-closed');//fiers to the mainwindow 
    ipcMain.emit('settings-closed');
  })
  //********** END WINDOW SETTING SECTION **********/ 
}

const createMain = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: { webSecurity: false, allowRunningInsecureContent: true, nodeIntegration: true },
    frame: false,
    resizable: true,
    icon: path.join(__dirname, 'assets/icons/ico/asset_6.ico')
  });

  log.info("mainWindow created");

  protocol.registerHttpProtocol('poscon', (req, cb) => {
    const fullUrl = req.url;
    log.info('URL::::' + fullUrl);

    //***THIS NEXT SECTION HANDLES USER PRESSING ANY "LAUNCH" BUTTON */
    if(fullUrl.includes("launch-pilotclient")) {
      log.info("User requested P3D Pilot Client...");
      POSCONDir = settings.get('config.FSXP3DDirectory');
      let hasESPClient = settings.get('config.hasESPClient');

      //check msvc before launching
      if (hasESPClient === true) {
        ipcMain.emit('check-64bit-msvc');
        sim.isProcessRunning('PosCon.PilotClient.exe', (isRunning) => {
          if (!isRunning) {
            sim.execute('PosCon.PilotClient.exe', '-a', POSCONDir + '\\P3D Pilot Client\\').then((data) => {
              log.info(data);
            }).catch((err) => {
              var options = {
                title: "Unexpected Error",
                message: "We could not run the Client please ensure the path is correct",
                buttons: ["OK"]
              };
              dialog.showErrorBox(options.title, options.message);
              log.error(err);
            });
          } else {
            log.warn('Process already runnig');
            dialog.showErrorBox('Process Running', 'The process is already running');
          }
        })
      } else {
        //Open EULA -> Settings -> Download
        mainWindow.webContents.send('settings-req');
        createEULAModal();
        ipcMain.once('tso-accepted', (event, flag) => {
          if (flag === false) {
            EULAWindow.close()
          } else {
            EULAWindow.close();
            if (settings.get('config.hasESPClient') === undefined) {
              var options = {
                type: 'question',
                title: "Missing P3D & FSX path",
                message: "We noted that you do not have P3D & FSX Client Directory set. This is required to lunch P3D&FSX Client. We will open settings window",
                buttons: ["OK"]
              }
              mainWindow.webContents.send('settings-req');
              createModal(options);
              ipcMain.once('modal-response', (event, response) => {
                if (response === 0) {
                  modalWindow.close();
                  mainWindow.webContents.send('settings-req');
                  createSettings()
                }
              });
              //Listen for the settings window to close and fire the install process
              ipcMain.once('settings-closed', () => {
                POSCONDir = settings.get('config.FSXP3DDirectory');
                if (settings.get('config.hasESPClient') === false || settings.get('config.hasESPClient') === undefined) {
                  if (settings.get('config.FSXP3DDirectory') === undefined) {
                    dialog.showErrorBox('Unexpected Error', 'You probably did not entered your P3D Client.\n path error : No path provided')
                  } else {
                    fsExtra.ensureDir(POSCONDir + '\\P3D Pilot Client\\').then(() => {
                      installClient(POSCONDir + '\\P3D Pilot Client\\', "clients/simconnect/beta/", 'config.hasESPClient');
                    }).catch((err) => {
                      log.error('ERROR while validating path err:' + err)
                    });
                  }
                } else {
                  var options = {
                    type: 'question',
                    title: "Client already installed",
                    message: "We noted that you already have P3D & FSX Client . Would you like to launch now",
                    buttons: ["Yes", "No"]
                  }
                  mainWindow.webContents.send('settings-req');
                  createModal(options);
                  ipcMain.once('modal-response', (event, response) => {
                    if (response === 0) {
                      modalWindow.close();
                      sim.execute('PosCon.PilotClient.exe', '-a', POSCONDir + '\\P3D Pilot Client\\').then((data) => {
                        log.info(data);
                      }).catch((err) => {
                        var options = {
                          title: "Unexpected Error",
                          message: "We could not run the Client please ensure the path is correct",
                          buttons: ["OK"]
                        };
                        dialog.showErrorBox(options.title, options.message);
                        log.error(err);
                      });
                    }else{
                      modalWindow.close();
                    }
                  });
                }
              })
            } else {
              if (fs.existsSync(POSCONDir) === false) {
                var opts = {
                  title: 'Invalid destination path',
                  message: 'Destination path is invalid! Please check your settings',
                  buttons: ['OK']
                }
                mainWindow.webContents.send('settings-req');
                createModal(opts);
                ipcMain.once('modal-response', (event, res) => {
                  if (res === 0) {
                    modalWindow.close();
                  }
                })
              } else {
                log.info('Passing dir: ' + POSCONDir)
                installClient(POSCONDir + '\\P3D Pilot Client\\', "clients/simconnect/beta/", 'config.hasESPClient');
                ipcMain.emit('check-64bit-msvc')//Start installation process
              }
            }
          }
        })
      }
    }

    if(fullUrl.includes("launch-xplane")) {
      log.info("User requested XPlane...");
      var pluginDir = settings.get('config.XPlaneDirectory') + '\\Resources\\plugins\\POSCON\\';
      hasSetXPDir = settings.get('config.HasSetXPDir');
      let hasXPClientInstalled = settings.get('config.hasXPClientInstalled');
      //check if user has 64bit MSVC installed before launching...
      if(hasXPClientInstalled) {
        ipcMain.emit('check-64bit-msvc')//Start installation process
        sim.isProcessRunning('X-Plane.exe', (isRunning)=>{
          if(!isRunning){
            sim.execute('X-Plane.exe', '--fps_test=0', xpDir).then().catch((err)=>{
              log.error(err);
              var options = {
                title: "Unexpected Error",
                message: "We could not run X-Plane please ensure the path is correct",
                buttons: ["OK"]
            };
            dialog.showErrorBox(options.title, options.message);
            log.error(err);
            });
          }else{
            log.warn('Process already runnig');
            dialog.showErrorBox('Process Running', 'The process is already running');
          }
        })
      } else {
        //EULA -> Settings -> Download    
        mainWindow.webContents.send('settings-req')
        createEULAModal();
        ipcMain.once('tso-accepted', (event, flag) => {
          if (flag === false) {
            EULAWindow.close()
          } else {
            EULAWindow.close()//Close eula
            if (settings.get('config.XPlaneDirectory') === undefined) {
              var options = {
                type: 'question',
                title: "Missing X-Plane path",
                message: "We noted that you do not have X-Plane Directory set. This is required to lunch X-Plane. We will open settings window",
                buttons: ["OK"]
              }
              mainWindow.webContents.send('settings-req');
              createModal(options)
              ipcMain.once('modal-response', (event, response) => {
                if (response === 0) {
                  modalWindow.close();
                  mainWindow.webContents.send('settings-req');
                  createSettings()
                }
              });
              //Listen for the settings window to close and fire the install process
              ipcMain.once('settings-closed', () => {
                //fetch new dir
                var pluginDir = settings.get('config.XPlaneDirectory') + '\\Resources\\plugins\\POSCON\\';
                //Download and install 
                log.info('Main has recived the request')
                if (settings.get('config.hasXPClientInstalled') === false || settings.get('config.hasXPClientInstalled') === undefined) {
                  if (settings.get('config.XPlaneDirectory') === undefined) {
                    dialog.showErrorBox('Unexpected Error', 'You probably did not entered your Xplane path error : No path provided')
                  } else {
                    fsExtra.ensureDir(pluginDir).then(() => {
                      installClient(pluginDir, "clients/X-Plane/Beta/POSCON/", 'config.hasXPClientInstalled');
                    }).catch((err) => {
                      log.error('ERROR while validating path err:' + err)
                    })
                  }
                } else {
                  var options = {
                    type: 'question',
                    title: "Client already installed",
                    message: "We noted that you already have XPlane Client . Would you like to lunch now",
                    buttons: ["Yes", "No"]
                  }
                  mainWindow.webContents.send('settings-req');
                  createModal(options);
                  ipcMain.once('modal-response', (event, response) => {
                    if (response === 0) {
                      sim.execute('X-Plane.exe', '--fps_test=0', xpDir).then().catch((err) => {
                        log.error(err);
                        var options = {
                          title: "Unexpected Error",
                          message: "We could not run X-Plane please ensure the path is correct",
                          buttons: ["OK"]
                        };
                        dialog.showErrorBox(options.title, options.message);
                        log.error(err);
                      });
                    } else {
                      modalWindow.close()
                    }
                  })
                }
              })
            } else {
              //End up here if the dir is set
              if (fs.existsSync(xpDir) === false) {
                var opts = {
                  title: 'Invalid destination path',
                  message: 'Destination path is invalid! Please check your settings',
                  buttons: ['OK']
                }
                mainWindow.webContents.send('settings-req');
                createModal(opts);
                ipcMain.once('modal-response', (event, res) => {
                  if (res === 0) {
                    modalWindow.close();
                  }
                })
              } else {
                installClient(pluginDir, "clients/X-Plane/Beta/POSCON/", 'config.hasXPClientInstalled');
              }
            }
          }
        })
      }
    }

    if(fullUrl.includes("launch-radar")) {
      log.info("User requested Radar...");
      if(settings.get('config.hasRadarClient') === true){
        sim.isProcessRunning('RadarClient.exe', (isRunning)=>{
          if(!isRunning){
            sim.execute('RadarClient.exe', '', settings.get('config.RadarDirectory')+ '\\Radar Client\\').then(()=>{
              log.info('Loading...')
            }).catch((err)=>{
              log.error(err);
              var options = {
                title: "Unexpected Error",
                message: "We could not run RadarClient.exe please ensure the path is correct",
                buttons: ["OK"]
            };
            dialog.showErrorBox(options.title, options.message);
            log.error(err);
            });
          }else{
            log.warn('Process already runnig');
            dialog.showErrorBox('Process Running', 'The process is already running');
          }
        })
      }else{
        //Installation logic 
        //Search settings for Radar location and start it
        //cdn not yet ready for logic
      }
    }

    if(fullUrl.includes("logout")) {
      log.info("User requested logout...");
      ipcMain.emit('logout', false) //channel, bool force auth without user interaction(t/f)
    }

    //Window setting protocol handle the opening
    if (fullUrl.includes("launcher-settings")) {
      log.info("User requested launcher settings");
      mainWindow.webContents.send('settings-req');
      createSettings();
    }

    /**** UNISTALL PROCESS ****/
    //P3D
    if(fullUrl.includes('uninstall-p3d')){
      log.info("User requested unistall process");
      let opts = {
        title: 'Unistall Process',
        message:'Would you like to uninstall P3D client?',
        buttons:["Yes", "No"]
      }
      createModal(opts);
      ipcMain.once('modal-response', (event, response)=>{
        if(response === 0){
          modalWindow.close();
          //unistall
          sim.unistallClients(settings.get('config.FSXP3DDirectory')+'\\', 'P3D Pilot Client', 'config.hasESPClient', ipcMain)
        }else{
          modalWindow.close();
          //Do nothing user decided to not leave us
        }
      })
    }

    //xplane 
    if(fullUrl.includes('uninstall-xplane')){
      log.info("User requested unistall process");
      let opts = {
        title: 'Unistall Process',
        message:'Would you like to uninstall XPlane client?',
        buttons:["Yes", "No"]
      }
      createModal(opts);
      ipcMain.once('modal-response', (event, response)=>{
        if(response === 0){
          modalWindow.close();
          //unistall
          sim.unistallClients(settings.get('config.XPlaneDirectory')+'\\Resources\\plugins\\','POSCON', 'config.hasXPClientInstalled', ipcMain);
        }else{
          modalWindow.close();
          //Do nothing user decided to not leave us
        }
      })
    }

    //radar 
    if(fullUrl.includes('uninstall-radar')){
      log.info("User requested unistall process");
      let opts = {
        title: 'Unistall Process',
        message:'Would you like to unistall P3D client?',
        buttons:["Yes", "No"]
      }
      createModal(opts);
      ipcMain.once('modal-response', (event, res)=>{
        if(res === 0){
          //unistall
          modalWindow.close();
        }else{
          modalWindow.close()
        }
      })
    }
    //***END "LAUNCH" BUTTON SECTION */
  }, (err) => {
    if(!err) {
      log.info("Registered poscon protocol succesfully!");
    } else ("URL ERROR:::" + err);
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file:///${__dirname}/index.html`,
  //mainWindow.loadURL(`https://hq.poscon.net/`,
  {
    userAgent: 'POSCONLauncher/0.0.7 (POSCON Launcher)',
    extraHeaders: `Authorization: Bearer ${access_token}`
  }
  );
  log.info("Loaded mainWindow");

  mainWindow.setMenuBarVisibility(false);

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

//attept a token  refresh every 55mins
setInterval(async()=>{
  let token;
  token = await poscon.auth.authorize(true).catch(async(err)=>{
    //Make a second attept
    if(err.code === 'ETIMEOUT'){
     token = await poscon.auth.authorize(false/**Let the api decide what to do with it */).catch((err)=>{
       log.error('Error thrown by SSO host at'+ err.host + 'error code:'+ err.code)
     });
    }
  });
  log.warn('Attepting token refresh...');
  if(token){
    log.info('New token expiration: '+ token.claims.exp);
    mainWindow.loadURL(`file:///${__dirname}/index.html`,
    {
      userAgent: 'POSCONLauncher/0.0.7 (POSCON Launcher)',
      extraHeaders: `Authorization: Bearer ${token.access_token}`
    });
    log.info('Token refreshed successfully');
  }
  // this is in case the token is null a re auth is needed
  poscon.auth.once('tokenchange',()=>{
    log.info('tokenchange detected for refresh...silent = true, not passing force');
    token = poscon.auth.authorize(true, false);
    if(!token){
      log.error('Token refresh failded');
    }
  });
}, 3300000);

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    log.info("Main Window Closed");
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    //mainWindow = null;
    //app.quit();
  });

  
  app.on('window-all-closed', function() {
    log.info("All windows closed!");
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  settings.set('config.IsFirstRun', false);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", function() {
  log.info("App is ready...");

  ipcMain.on('logout', (event, arg) => {
    log.warn("Rx logout request with arg: " + arg);

    createAuthWindow()
    authWindow.webContents.send('logout-auth');
    setTimeout(function() {
      
      mainWindow.close();
    }, 1000)
  })

  //Start installation process
  ipcMain.once('check-64bit-msvc', () => {
    log.info("Checking 64bit MSVC installation via registry...");
    sim.checkMSCVx64();
    if(settings.get('config.IsMSVCInstalled') === false){
      //DO something
      var options = {
        type:'question',
        title: "Missing MSVC++ Package Detected",
        message: "We noted that you do not have C++ Redistributable installed. This is required to use our clients. Would you like to install?",
        buttons: ["Yes", "No"]
      }
    
      //use the messagebox in this fashion to pause the app while awaiting user input
      let response = dialog.showMessageBox(options);
      log.info("Dialog Response: " + response);
      if(response == 1) {
        app.quit();
      }else if(response == 0){
        installMSVC(mainWindow);
      }
    }
  })

  ipcMain.once('unistall-done',()=>{
    mainWindow.webContents.send('settings-req');
    var opts = {
      title:'Success',
      message:'Unistall completed successfully! hope to see you again in POSCON sky',
      buttons: ["OK"]
    }
    createModal(opts)
    ipcMain.once('modal-response', (event, response)=>{
        modalWindow.close();
        mainWindow.webContents.send('reload-webview');
    })
  })

ipcMain.once('installation-com', (event, settingDest)=>{
  log.info("::::::::::::DONE:::::::::::::");
  if(loadingModal){
    loadingModal.close();
  }
  var opts = {
    title: 'success',
    message: 'Client installed successfuly',
    buttons: ['OK']
  }
  createModal(opts);
  ipcMain.once('modal-response', (event, res) => {
    if (res === 0) {
      modalWindow.close();
      ipcMain.emit('check-64bit-msvc')//Start installation process
      mainWindow.webContents.send('reload-webview')
    }
  })
})

  //Fire on update finished
  ipcMain.once('update-finished',(Temp)=>{
    log.info('Validating updates...')
    if(settings.get('config.updateStatus') === false || settings.get('config.updateStatus') === undefined){
      dialog.showErrorBox('Unexpected Error', 'The updated has not be installed check log for details.')
    }else{
      fsExtra.emptyDirSync(Temp);
      log.info('Update completed!:)')
    }
  })

  //if we are in dev mode we want to skip the updater logic
  if(isDev) {
    log.info("Flow is DEV");
    createAuthWindow();

    ipcMain.on('start-main', function(event, args) {
      access_token = args;
      log.info(`Creating Main with arg: ` + access_token);
      var clientUpdatater = require('./js/clientUpdater');

      setTimeout(function() {

        session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
          details.requestHeaders['Authorization'] = `Bearer ${access_token}`
          details.requestHeaders['User-Agent'] = `POSCONLauncher/0.0.7 (POSCON Launcher)`
          callback({ requestHeaders: details.requestHeaders })
        })

        createMain();
        authWindow.close();

        if(settings.get('config.XpUpdatePending')=== true){
          log.warn('the update is ready to be installed');
          opts = {
            title:'Update pending',
            message:'An X-Plane update is ready to be installed! would you like to install now',
            buttons:['Yes', 'No']
          }
          mainWindow.webContents.send('settings-req');
          createModal(opts)
          ipcMain.once('modal-response', (event, response)=>{
            if(response === 0){
              let Temp = settings.get('config.tmpFolder')+'clients\\xplane\\POSCON'
              let pluginDir = settings.get('config.XPlaneDirectory')+'\\Resources\\plugins\\POSCON\\';
              modalWindow.close();
             sim.installUpdatesPending(Temp, pluginDir, ipcMain);
            }else{
              log.warn('User decide to takeoff without clearence [update deffered]');
              settings.set('config.XpUpdatePeding', true)
              modalWindow.close();
            }
          })
        }

        if(settings.get('config.EspUpdatePeding') === true){
          log.warn('[ESP Updater]The update is ready to be installed')
          opts = {
            title:'Update pending',
            message: 'A Prepar3D Client update is ready to be installed! would you like to install now',
            buttons: ['Yes', 'No']
          }
          createModal(opts);
          ipcMain.once('modal-response', (event, response)=>{
            if(response === 0){
              let Temp = settings.get('config.tmpFolder')+ 'clients\\esp\\P3D Pilot Client';
              let espClient = settings.get('config.FSXP3DDirectory')+'\\P3D Pilot Client\\';
              modalWindow.close();
              sim.installUpdatesPending(Temp, espClient, ipcMain);
            }else{
              log.warn('User decide to takeoff without clearence [update deffered]');
              settings.set('config.EspUpdatePeding', true)
              modalWindow.close();
            }
          })
        }
      }, 3000)
    });

  } else {
    log.info("Flow is PROD")
    createLoader();

    ipcMain.on('start-auth', function() {
      log.info("Received start-auth");

      createAuthWindow();
      loaderWindow.close();
    });

    ipcMain.on('start-main', function(event, args) {
      access_token = args;
      log.info(`Creating Main with arg: ` + access_token);
      var clientUpdatater = require('./js/clientUpdater');

      setTimeout(function() {

        session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
          details.requestHeaders['Authorization'] = `Bearer ${access_token}`
          details.requestHeaders['User-Agent'] = `POSCONLauncher/0.0.7 (POSCON Launcher)`
          callback({ requestHeaders: details.requestHeaders })
        })
        createMain();
        authWindow.close();
        //let's check for pending updates
        if(settings.get('config.XpUpdatePending')=== true){
          log.warn('[X-Plane Updater]The update is ready to be installed');
          opts = {
            title:'Update pending',
            message:'A X-Plane update is ready to be installed! would you like to install now',
            buttons:['Yes', 'No']
          }
          mainWindow.webContents.send('settings-req');
          createModal(opts)
          ipcMain.once('modal-response', (event, response)=>{
            if(response === 0){
              let Temp = settings.get('config.tmpFolder')+'clients\\xplane\\POSCON'
              let pluginDir = settings.get('config.XPlaneDirectory')+'\\Resources\\plugins\\POSCON\\';
              modalWindow.close();
              sim.installUpdatesPending(Temp, pluginDir, ipcMain);
            }else{
              log.warn('User decide to takeoff without clearence [update deffered]');
              settings.set('config.XpUpdatePeding', true)
              modalWindow.close();
            }
          })
        }

        if(settings.get('config.EspUpdatePeding') === true){
          log.warn('[ESP Updater]The update is ready to be installed')
          opts = {
            title:'Update pending',
            message: 'A Prepar3D Client update is ready to be installed! would you like to install now',
            buttons: ['Yes', 'No']
          }
          createModal(opts);
          ipcMain.once('modal-response', (event, response)=>{
            if(response === 0){
              let Temp = settings.get('config.tmpFolder')+ 'clients\\esp\\P3D Pilot Client';
              let espClient = settings.get('config.FSXP3DDirectory')+'\\P3D Pilot Client\\';
              modalWindow.close();
              createLoading();
              sim.installUpdatesPending(Temp, espClient, ipcMain);
            }else{
              log.warn('User decide to takeoff without clearence [update deffered]');
              settings.set('config.EspUpdatePeding', true)
              modalWindow.close();
            }
          })
        }
      }, 3000)
    });
  }

  if(isDev) {
    //@TODO
    //Add some events here??
  } else {

    loaderWindow.webContents.on("did-finish-load", () => {

      log.info("loaderWindow finished load...");

      //check for updates
      ipcMain.on('online', (event, result) => {
        autoUpdater.checkForUpdates();
      }); 

      ipcMain.on('offline', (event, result) => {
        log.info("App is offline...quiting!")
        //@TODO
        //Additional conditions?
        app.quit();
      });

      // *****START AUTO UPDATER LOGIC***** //
      autoUpdater.setFeedURL({
        url: `${DOMAIN}/poscon_launcher/1d51c68a0a7b4e49f1362dc6c36832a2/${process.platform}/${process.arch}${suffix}`,
        serverType: 'json',
      });
    
        autoUpdater.on("checking-for-update", () => {
          log.info("checking for update in indexjs");
          loaderWindow.webContents.send('update-check');
          log.info("Checking for update in indexjs");
        });
    
        autoUpdater.on('update-available', () => {
          log.info("update available!");
          loaderWindow.webContents.send('update-available');
    
          autoUpdater.on('update-downloaded', function (event,releaseName) {
              // # restart app, then update will be applied
              log.info("update downloaded!");
              loaderWindow.webContents.send('update-dl');
              ipcMain.on('update-install', function(event, arg) {
                autoUpdater.quitAndInstall();
              });
          });
    
        });
    
        autoUpdater.on("update-not-available", info => {
          log.info("update not available");
          loaderWindow.webContents.send("update-not-available");
          updateNotAvail = true;
        });
    
        autoUpdater.on("error", error => {
          log.error("AutoUpdater Error: ");
          log.error(error.message);
          log.error(error.stack);
          log.error(dialog.showErrorBox("Error!", error.message));
        });
        // *****END AUTO UPDATER LOGIC***** //
    });
  }

  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if(mainWindow === null) {
      createMain();
    }
  });
});

app.on('will-quit', (event) => {
  log.warn("App is requesting quit...");
});

ipcMain.on('quit-app', function() {
  app.quit();
});

app.on('window-all-closed', e => {
  app.quit();
  //e.preventDefault()
});


/****** PACKEGES RELATED FUNCTION SECTION ******/
/**
 * Install client via CDN to the destDir
 * @param {String} destDir Path like detination dir
 * @param {String} remoteChannel cdn remote repo path
 * @param {String} settingDest setting key to update
 */
function installClient(destDir, remoteChannel, settingDest) {
  let increment;
  down.checkDownload('cdn.poscon.com', destDir, "MD5", async (result) => {
    log.info(result.res + result.dwnLength)
    if (result.res) {
      mainWindow.webContents.send('settings-req');
      createLoading();
      increment = 80/result.dwnLength;
      log.info("Client updates found!");
      log.info("Checking: " + destDir);
      //CDN, Download Dir, What client, download item async
      down.getDownload('cdn.poscon.com', destDir, "MD5", 0, remoteChannel, async(downResult) => {
        if(downResult == "done") {
          installModels(destDir, destDir)
          settings.set(settingDest, true);
        }
      },
      
      async(downItemResultXP) => {
        var xFormatResult = downItemResultXP.substring(downItemResultXP.lastIndexOf("/") + 1);
        var xResult = xFormatResult.split(" ")[0];
        log.info("==============DOWN ITEM RESULT===============");
        log.info("xResult: " + xResult);
        loadingModal.webContents.send('update-install-progress',increment)
      }

      );
      log.info("Finished");
    } else {
      log.info("No client updates available");
      dialog.showErrorBox('Unexpected Error', 'Unexpected Error while downloading')
    }
  }, remoteChannel);
}

/**
 * Install models
 * @param {String} destDir destination path
 * @param {String} outDir output of the dowbloaded zip file
 */
function installModels(inDir, outDir) {
  let tmpDir = settings.get('config.tmpFolder');
  if (fsExtra.existsSync(inDir + 'models.zip') === true) {
    fsExtra.move(inDir + 'models.zip', tmpDir + 'models.zip', { overwrite: true }).then(() => {
      log.info('Preparing files...');
      fsExtra.ensureDir(outDir + 'Models\\').then(() => {
        zip.unzip(tmpDir + 'models.zip', tmpDir, (err) => {
          log.info('extracting files')
          if (err) {
            dialog.showErrorBox(err.title, err.message)
            loadingModal.close();
          } else {
            sim.compInstallation(tmpDir, outDir, loadingModal,ipcMain);
          }
        })
      }).catch((err) => {
        log.error(err)
      });
    }).catch((err) => {
      log.error(err);
      loadingModal.close()
      dialog.showErrorBox(err.title, err.message);
    })
  } else {
    log.warn('[File Handler] nothing to install');
    ipcMain.emit('installation-com');
  }
}