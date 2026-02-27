const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { create } = require('youtube-dl-exec');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');

let ytDlpPath;
let ffmpegPath;

if (app.isPackaged) {
    ytDlpPath = path.join(process.resourcesPath, 'youtube-dl-bin', 'yt-dlp.exe');
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg-bin', 'ffmpeg.exe');
} else {
    ytDlpPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    ffmpegPath = ffmpegStatic;
}
const youtubedl = create(ytDlpPath);

// Config and State paths
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'ytdlox_config.json');
const downloadsDbPath = path.join(userDataPath, 'ytdlox_downloads.json');

// Default Config
const defaultConfig = {
    theme: 'dark',
    defaultQuality: 'max',
    maxDownloads: 2,
    defaultSaveDir: app.getPath('downloads'),
    language: 'en'
};

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler for Directory Selection
ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (result.canceled) {
        return null;
    } else {
        return result.filePaths[0];
    }
});

// Settings & Config Handlers
ipcMain.handle('config:get', () => {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
        return defaultConfig;
    } catch (e) {
        return defaultConfig;
    }
});

ipcMain.handle('config:set', (event, newConfig) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Search & Playlist handler
// Search & Playlist handler
ipcMain.handle('ytdl:search', async (event, query, searchType) => {
    try {
        let searchTarget = query;
        let pArgs = {
            dumpSingleJson: true,
            flatPlaylist: true,
            noCheckCertificates: true,
            noWarnings: true
        };

        if (searchType === 'video') {
            searchTarget = `ytsearch50:${query}`;
        } else if (searchType === 'channel' || searchType === 'playlist') {
            // Direct URL
            searchTarget = query;
            // Clean up common handle formats
            if (query.startsWith('@')) {
                searchTarget = `https://www.youtube.com/${query}`;
            }
        }

        const output = await youtubedl(searchTarget, pArgs);

        // output.entries exists for playlists/searches
        const entries = output.entries ? output.entries.map(e => ({
            id: e.id,
            title: e.title,
            uploader: e.uploader || e.channel || 'Unknown',
            duration: e.duration,
            url: e.url ? (e.url.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${e.url}`) : `https://www.youtube.com/watch?v=${e.id}`,
            thumbnail: e.thumbnails ? e.thumbnails[0]?.url : e.thumbnail
        })) : [{
            id: output.id,
            title: output.title,
            uploader: output.uploader,
            duration: output.duration,
            url: output.webpage_url,
            thumbnail: output.thumbnail
        }];

        return { success: true, data: entries };
    } catch (err) {
        console.error('Search error:', err);
        return { success: false, error: err.message };
    }
});

// IPC Handler to Fetch Video Info (Formats/Metadata)
ipcMain.handle('ytdl:getInfo', async (event, url) => {
    try {
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true
        });

        const formats = output.formats.map(format => ({
            id: format.format_id,
            ext: format.ext,
            resolution: format.resolution || 'Audio',
            fps: format.fps,
            filesize: format.filesize || format.filesize_approx,
            vcodec: format.vcodec,
            acodec: format.acodec,
            format_note: format.format_note
        }));

        return {
            success: true,
            data: {
                title: output.title,
                author: output.uploader,
                formats: formats
            }
        };
    } catch (err) {
        console.error('Error fetching info:', err);
        return { success: false, error: err.message };
    }
});

// IPC Handler for actual Downloads
ipcMain.handle('ytdl:download', async (event, { id, url, format, saveDir, options }) => {
    try {
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const outputPath = path.join(saveDir, '%(title)s.%(ext)s');

        let dlOptions = {
            output: outputPath,
            noWarnings: true,
            noCheckCertificates: true,
            ffmpegLocation: ffmpegPath
        };

        if (format && format !== 'default') {
            dlOptions.format = format;
        }

        if (options) {
            if (options.mergeOutputFormat) dlOptions.mergeOutputFormat = options.mergeOutputFormat;
            if (options.embedThumbnail) dlOptions.embedThumbnail = true;
            if (options.embedSubs) {
                dlOptions.writeSubs = true;
                dlOptions.writeAutoSubs = true;
                dlOptions.subLangs = 'all,-live_chat';
                dlOptions.embedSubs = true;
            }
            if (options.embedChapters) dlOptions.embedChapters = true;
            if (options.embedMetadata) dlOptions.embedMetadata = true;
        }

        return new Promise((resolve) => {
            const downloadProcess = youtubedl.exec(url, dlOptions);

            downloadProcess.stdout.on('data', (data) => {
                const outputStr = data.toString();
                // Parse percentage and speed if it matches standard yt-dlp output
                // Example: [download]  15.2% of  54.60MiB at    1.12MiB/s ETA 00:41
                const regex = /\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+[KMG]?iB)\s+at\s+([\d\.]+[KMG]?iB\/s)\s+ETA\s+([\d:]+)/;
                const match = outputStr.match(regex);
                if (match) {
                    event.sender.send('download-progress', {
                        id: id,
                        percent: parseFloat(match[1]),
                        size: match[2],
                        speed: match[3],
                        eta: match[4]
                    });
                } else if (outputStr.includes('[Merger]') || outputStr.includes('[ExtractAudio]')) {
                    event.sender.send('download-status', { id: id, status: 'Processing/Merging...' });
                }
            });

            downloadProcess.on('close', (code) => {
                if (code === 0) {
                    event.sender.send('download-complete', { id: id });
                    resolve({ success: true });
                } else {
                    event.sender.send('download-error', { id: id, error: `Process exited with code ${code}` });
                    resolve({ success: false, error: `Process exited with code ${code}` });
                }
            });

            downloadProcess.on('error', (err) => {
                event.sender.send('download-error', { id: id, error: err.message });
                resolve({ success: false, error: err.message });
            });
        });
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, error: err.message };
    }
});
