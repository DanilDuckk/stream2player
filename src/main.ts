import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { DownloadConfig } from '@/src/types/config';
import { runDownload } from '@/src/services/download-service';

let controller: AbortController | null = null;
const MIN_CONTENT_HEIGHT = 430;
const MAX_CONTENT_HEIGHT = 760;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  const log = (line: string) => win.webContents.send('log', line);
  const progress = (done: number, total: number) =>
    win.webContents.send('progress', { done, total });

  ipcMain.handle('choose-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('resize-window', (_event, requestedHeight: number) => {
    if (!Number.isFinite(requestedHeight)) return { ok: false };

    const height = Math.min(
      MAX_CONTENT_HEIGHT,
      Math.max(MIN_CONTENT_HEIGHT, Math.ceil(requestedHeight)),
    );
    const [width] = win.getContentSize();
    win.setContentSize(width, height);
    return { ok: true, height };
  });

  ipcMain.handle('stop-download', () => {
    if (controller) {
      controller.abort();
      log('[INFO] Stopping... (finishing current step)');
    }
    return { ok: true };
  });

  ipcMain.handle('start-download', async (_event, config: DownloadConfig) => {
    if (!config.downloadDir) {
      log('[ERROR] Please choose a download folder first.');
      return { ok: false };
    }

    controller = new AbortController();
    const { signal } = controller;

    try {
      return await runDownload(config, {
        cacheDir: app.getPath('userData'),
        signal,
        log,
        progress,
      });
    } catch (err) {
      if (signal.aborted) {
        log('[INFO] Stopped by user.');
        return { ok: false, stopped: true };
      }
      log(`[ERROR] ${err instanceof Error ? err.message : String(err)}`);
      return { ok: false };
    } finally {
      controller = null;
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
