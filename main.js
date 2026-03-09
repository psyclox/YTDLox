const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { create } = require('youtube-dl-exec');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');

// These are initialized once app is ready (inside app.whenReady)
let youtubedl;
let ffmpegPath;
let configPath;

// Returns default config — called after app is ready so app.getPath works
function getDefaultConfig() {
    return {
        theme: 'dark',
        defaultQuality: 'max',
        maxDownloads: 2,
        defaultSaveDir: app.getPath('downloads'),
        language: 'en'
    };
}

function createWindow() {
    const win = new BrowserWindow({
        width: 960,
        height: 720,
        minWidth: 800,
        minHeight: 600,
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
    // Initialize paths now that app is fully ready
    const ytDlpPath = app.isPackaged
        ? path.join(process.resourcesPath, 'youtube-dl-bin', 'yt-dlp.exe')
        : path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');

    ffmpegPath = app.isPackaged
        ? path.join(process.resourcesPath, 'ffmpeg-bin', 'ffmpeg.exe')
        : ffmpegStatic;

    youtubedl = create(ytDlpPath);

    const userDataPath = app.getPath('userData');
    configPath = path.join(userDataPath, 'ytdlox_config.json');

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
        return getDefaultConfig();
    } catch (e) {
        return getDefaultConfig();
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

// Shell handlers – open file or reveal in folder
ipcMain.handle('shell:openFile', async (event, filePath) => {
    const result = await shell.openPath(filePath);
    return result; // empty string on success, error message on failure
});

ipcMain.handle('shell:openFolder', (event, filePath) => {
    shell.showItemInFolder(filePath);
    return { success: true };
});

// Search & Playlist handler
ipcMain.handle('ytdl:search', async (event, query, searchType, offset = 0) => {
    try {
        let searchTarget = query;
        let pArgs = {
            dumpSingleJson: true,
            flatPlaylist: true,
            noCheckCertificates: true,
            noWarnings: true,
            socketTimeout: 15
        };

        if (searchType === 'video') {
            const limit = 20;
            searchTarget = `ytsearch${offset + limit}:${query}`;
            pArgs.playlistItems = `${offset + 1}-${offset + limit}`;
        } else if (searchType === 'channel' || searchType === 'playlist') {
            searchTarget = query;
            if (query.startsWith('@')) {
                searchTarget = `https://www.youtube.com/${query}/videos`;
            } else if (query.includes('youtube.com/') && !query.includes('/watch') && !query.includes('/playlist') && !query.endsWith('/videos')) {
                if (query.includes('/c/') || query.includes('/channel/') || query.includes('/@')) {
                    searchTarget = searchTarget.replace(/\/$/, '') + '/videos';
                }
            }
            const limit = 20;
            pArgs.playlistItems = `${offset + 1}-${offset + limit}`;
        }

        const output = await youtubedl(searchTarget, pArgs);

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
            preferFreeFormats: true,
            noPlaylist: true,
            socketTimeout: 15
        });

        const formats = output.formats.map(format => ({
            id: format.format_id,
            ext: format.ext,
            resolution: format.resolution || 'Audio',
            fps: format.fps,
            filesize: format.filesize || format.filesize_approx,
            vcodec: format.vcodec,
            acodec: format.acodec,
            format_note: format.format_note,
            tbr: format.tbr,
            abr: format.abr
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

        const outputTemplate = path.join(saveDir, '%(title)s.%(ext)s');

        let dlOptions = {
            output: outputTemplate,
            noWarnings: true,
            noCheckCertificates: true,
            ffmpegLocation: ffmpegPath,
            socketTimeout: 30
        };

        const isAudioOnly = options && options.isAudioOnly;

        if (isAudioOnly) {
            // Audio-only: extract and convert to desired format
            dlOptions.extractAudio = true;
            dlOptions.audioFormat = (options.audioContainer || 'mp3').toLowerCase();
            dlOptions.audioQuality = 0; // best
            // Use the specific format ID if provided, otherwise best audio
            if (format && format !== 'default' && format !== 'bestaudio/best') {
                dlOptions.format = format;
            } else {
                dlOptions.format = 'bestaudio/best';
            }
        } else {
            // Video download
            if (format && format !== 'default') {
                dlOptions.format = format;
            }
            if (options && options.mergeOutputFormat) {
                dlOptions.mergeOutputFormat = options.mergeOutputFormat;
            }
        }

        if (options) {
            if (options.embedThumbnail) dlOptions.embedThumbnail = true;
            if (options.embedSubs) {
                // FIX: Do NOT set writeSubs — that creates sidecar .srt files.
                // Only embedSubs ensures subtitles are embedded without writing separate files.
                dlOptions.embedSubs = true;
                dlOptions.subLangs = 'all,-live_chat';
            }
            if (options.embedChapters) dlOptions.embedChapters = true;
            if (options.embedMetadata) dlOptions.embedMetadata = true;
        }

        return new Promise((resolve) => {
            const downloadProcess = youtubedl.exec(url, dlOptions);

            let errorLog = '';
            let resolvedFilePath = null; // Track actual output file path

            downloadProcess.stdout.on('data', (data) => {
                const outputStr = data.toString();

                // Parse download progress
                // Example: [download]  15.2% of  54.60MiB at    1.12MiB/s ETA 00:41
                const progressRegex = /\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+[KMG]?iB)\s+at\s+([\d\.]+[KMG]?iB\/s)\s+ETA\s+([\d:]+)/;
                const match = outputStr.match(progressRegex);
                if (match) {
                    event.sender.send('download-progress', {
                        id: id,
                        percent: parseFloat(match[1]),
                        size: match[2],
                        speed: match[3],
                        eta: match[4]
                    });
                } else if (outputStr.includes('[Merger]') || outputStr.includes('[ExtractAudio]')) {
                    event.sender.send('download-status', { id: id, status: 'Processing...' });
                }

                // Track the resolved output file path from yt-dlp stdout lines:
                // "[download] Destination: C:\...\filename.ext"
                // "[ExtractAudio] Destination: C:\...\filename.mp3"
                // "[Merger] Merging formats into "C:\...\filename.mkv""
                const destMatch = outputStr.match(/\[download\] Destination: (.+)/);
                const extractMatch = outputStr.match(/\[ExtractAudio\] Destination: (.+)/);
                const mergerMatch = outputStr.match(/\[Merger\] Merging formats into "(.+)"/);

                if (mergerMatch) {
                    resolvedFilePath = mergerMatch[1].trim();
                } else if (extractMatch) {
                    resolvedFilePath = extractMatch[1].trim();
                } else if (destMatch) {
                    resolvedFilePath = destMatch[1].trim();
                }
            });

            if (downloadProcess.stderr) {
                downloadProcess.stderr.on('data', (data) => {
                    errorLog += data.toString() + ' ';
                });
            }

            downloadProcess.on('close', (code) => {
                if (code === 0) {
                    event.sender.send('download-complete', {
                        id: id,
                        filePath: resolvedFilePath || null
                    });
                    resolve({ success: true });
                } else {
                    const finalErr = errorLog.trim() || `Process exited with code ${code}`;
                    console.error('Download failed:', finalErr);
                    event.sender.send('download-error', {
                        id: id,
                        error: finalErr.length > 150 ? finalErr.substring(0, 150) + '...' : finalErr
                    });
                    resolve({ success: false, error: finalErr });
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
