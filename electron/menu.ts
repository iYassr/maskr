import { app, Menu, BrowserWindow, shell, dialog } from 'electron'

export function createApplicationMenu(mainWindow: BrowserWindow) {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences...',
                accelerator: 'CmdOrCtrl+,',
                click: () => {
                  mainWindow.webContents.send('menu:preferences')
                }
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu:openFile')
          }
        },
        { type: 'separator' },
        {
          label: 'Export Sanitized...',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu:export')
          }
        },
        {
          label: 'Export Original with Annotations...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu:exportAnnotated')
          }
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }])
      ]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const }
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
        { type: 'separator' },
        {
          label: 'Select All Detections',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            mainWindow.webContents.send('menu:selectAllDetections')
          }
        },
        {
          label: 'Deselect All Detections',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            mainWindow.webContents.send('menu:deselectAllDetections')
          }
        }
      ]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Show Original',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('menu:showOriginal')
          }
        },
        {
          label: 'Show Sanitized',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('menu:showSanitized')
          }
        },
        {
          label: 'Side by Side',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('menu:sideBySide')
          }
        }
      ]
    },

    // Profiles menu
    {
      label: 'Profiles',
      submenu: [
        {
          label: 'Default',
          click: () => {
            mainWindow.webContents.send('menu:loadProfile', 'default')
          }
        },
        {
          label: 'Strict (All PII)',
          click: () => {
            mainWindow.webContents.send('menu:loadProfile', 'strict')
          }
        },
        {
          label: 'Minimal (Contacts Only)',
          click: () => {
            mainWindow.webContents.send('menu:loadProfile', 'minimal')
          }
        },
        { type: 'separator' },
        {
          label: 'Save Current as Profile...',
          click: () => {
            mainWindow.webContents.send('menu:saveProfile')
          }
        },
        {
          label: 'Manage Profiles...',
          click: () => {
            mainWindow.webContents.send('menu:manageProfiles')
          }
        }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }])
      ]
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/iYassr/DocSanitizer#readme')
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/iYassr/DocSanitizer/issues')
          }
        },
        { type: 'separator' },
        {
          label: 'About DocSanitizer',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About DocSanitizer',
              message: 'DocSanitizer',
              detail: `Version: ${app.getVersion()}\n\nA local-first document sanitization tool that detects and masks sensitive information before sharing with AI applications.\n\nAll processing is done locally - no data leaves your device.`
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
