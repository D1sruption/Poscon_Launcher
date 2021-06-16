const ipcAuth = require('electron').ipcRenderer;
const log = require('electron-log');
const poscon = require('poscon-api-client');
const settings = require('electron-settings');
const keytar = require('keytar');
const store = require('electron-store');
var crypto = require('crypto-js')

var isFirstRun = settings.get('config.IsFirstRun');
log.info("[AUTHJS]Is First Run: " + isFirstRun);

let userName;
let at;

if(isFirstRun) {
  login();//Force auth
  log.info("FirstRun login called")
  $("#btnAuthorize").hide();
}

ipcAuth.on('logout-auth', () => {
  log.info("logout received from authjs")
  signout()
})

$("#btnAuthorize").click(function () {
  log.info("User requested login...")
  login();
})

/**
 *@description 
 *
 */
async function login() {
  let token;
    token = await poscon.auth.authorize(false/*Pop up if necessary*/);
    if(token){
      updateUI(token);
      const authData = new store({name:'data',encryptionKey:token.access_token});
      authData.set({tokenData: token.claims});
      keytar.setPassword('POSCONauth', 'launcher', token.access_token);
    }else{
      $("#btnAuthorize").show();
    }
    //Listening for the event then update UI elements
    poscon.auth.on("tokenchange", async() => {

      log.info('tokenchange detected...silent = true, not passing force');
      token = await poscon.auth.authorize(true, false); //Ask for init
      if (token) {
        updateUI(token);
      } else {
        log.warn('Waiting interaction')
      }
    });
}

async function updateUI(token){
  if (token) {
    const access_token = token.access_token // always keep refresh_token secret!
    log.info(`Using ${access_token} to call new APIs on behalf of ${token.claims.name}`)
    userName = token.claims.name;
    log.info(`Authorized...Welcome back ${token.claims.name}`)
    // let's try to use the access_token now
    try {
      $('#authorizingLabel').text("Welcome, " + token.claims.name)
      $("#btnAuthorize").hide();

      ipcAuth.send('start-main', token.access_token);
      log.info('Tx authorized...');

      log.info('New Token Expiration: ' + token.claims.exp)

      at = token.access_token;
    } catch (ex) {
      // alert(ex.toString());
      log.error('ERROR: Couldnt get user info')
    }
  }else{
    log.warn('Please sign in first');
  }
}
  // Signs out
  async function signout () {
    await poscon.auth.clear()
    poscon.auth.on("tokenchange", null);
    //$('#btnUsername').text(' ')
    //$('#btnRefreshToken').text(' ')
    //$('#btnForce').text(' ')
    //$('#btnAuthorize').text('Sign In')
    log.warn('User logged out!')
    // onTokenChange will be called back if a token existed
  }