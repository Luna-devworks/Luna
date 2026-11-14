const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
let server = null, main = null;
const icon = path.join(__dirname, 'icon.png');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (main) { if (main.isMinimized()) main.restore(); main.focus(); } });

function createWindow() {
  main = new BrowserWindow({ width: 1280, height: 800, minWidth: 900, minHeight: 600, title: 'Luna', icon, backgroundColor: '#14111c', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  main.loadFile(path.join(__dirname, 'app', 'index.html'));
  main.webContents.setWindowOpenHandler(({ url }) => { require('electron').shell.openExternal(url); return { action: 'deny' }; });
  main.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && i.key === 'F11') { main.setFullScreen(!main.isFullScreen()); e.preventDefault(); }
  });
}
ipcMain.handle('luna:startServer', async () => {
  if (!server) {
    const { start } = require('./server/server.js');
    const webDir = path.join(__dirname, 'app');
    server = await start({ port: 8080, dataDir: path.join(app.getPath('userData'), 'luna-data'), webDir: fs.existsSync(webDir) ? webDir : null });
  }
  return { port: server.port, addresses: server.addresses };
});
app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
app.on('window-all-closed', () => { if (server) { try { server.stop(); } catch (e) {} } app.quit(); });
