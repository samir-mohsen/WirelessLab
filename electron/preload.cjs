const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wirelessLabDesktop', {
  isDesktop: true,
  platform: process.platform,
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(String(action));
    ipcRenderer.on('wirelesslab:menu-action', handler);
    return () => {
      ipcRenderer.removeListener('wirelesslab:menu-action', handler);
    };
  },
});
