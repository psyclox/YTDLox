document.addEventListener('DOMContentLoaded', async () => {
    // --- Global State ---
    let appConfig = {
        theme: 'dark',
        defaultQuality: 'max',
        maxDownloads: 2,
        defaultSaveDir: '',
        language: 'en'
    };
    let ytDataCache = {}; // Cache format info by video ID/URL
    let selectedVideoFormat = null;
    let availableAudioFormats = [];
    let activeDownloads = new Set();
    let selectedSearchUrls = new Set();

    // UI Elements
    const urlInput = document.getElementById('url-input');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const progressList = document.getElementById('progress-list');

    // Details Elements
    const videoTitle = document.getElementById('video-title');
    const videoAuthor = document.getElementById('video-author');
    const videoEmpty = document.getElementById('video-empty');
    const videoQuality = document.getElementById('video-quality');
    const audioEmpty = document.getElementById('audio-empty');
    const audioQuality = document.getElementById('audio-quality');
    const optContainer = document.getElementById('opt-container');

    // Modals
    const settingsModal = document.getElementById('settings-modal');
    const audioSelectModal = document.getElementById('audio-select-modal');
    const tipsPopup = document.getElementById('tips-popup');

    // Initialize
    if (window.electronAPI) {
        appConfig = await window.electronAPI.getConfig();
        // Update UI with config
        document.getElementById('default-save-dir').value = appConfig.defaultSaveDir;
        document.getElementById('max-downloads').value = appConfig.maxDownloads;
        document.getElementById('max-downloads-val').textContent = appConfig.maxDownloads;

        const themeSelect = document.getElementById('app-theme');
        if (themeSelect) themeSelect.value = appConfig.theme || 'dark';
        const qualitySelect = document.getElementById('app-default-quality');
        if (qualitySelect) qualitySelect.value = appConfig.defaultQuality || 'max';

        applyTheme(appConfig.theme || 'dark');
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // Panel Toggling Logic
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    document.getElementById('toggle-left-btn')?.addEventListener('click', () => {
        leftPanel.classList.toggle('panel-collapsed');
        leftPanel.classList.remove('panel-maximized');
    });
    document.getElementById('maximize-left-btn')?.addEventListener('click', () => {
        leftPanel.classList.toggle('panel-maximized');
        leftPanel.classList.remove('panel-collapsed');
    });
    document.getElementById('toggle-right-btn')?.addEventListener('click', () => {
        rightPanel.classList.toggle('panel-collapsed');
    });

    // Show Tips popup briefly
    setTimeout(() => {
        tipsPopup.classList.add('show');
        setTimeout(() => tipsPopup.classList.remove('show'), 5000);
    }, 2000);

    // --- Tab Logic ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabIndicator = document.querySelector('.tab-indicator');

    function updateTabIndicator(activeTab) {
        if (!tabIndicator || !activeTab) return;
        const navRect = activeTab.parentElement.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        tabIndicator.style.width = `${tabRect.width}px`;
        tabIndicator.style.transform = `translateX(${tabRect.left - navRect.left}px)`;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            document.getElementById(targetId)?.classList.add('active');
            updateTabIndicator(tab);
        });
    });
    updateTabIndicator(document.querySelector('.tab-btn.active'));

    const toggleBtns = document.querySelectorAll('.toggle-btn:not(.disabled)');
    toggleBtns.forEach(btn => btn.addEventListener('click', () => btn.classList.toggle('active')));

    // --- Settings Modal ---
    document.getElementById('settings-btn').addEventListener('click', () => settingsModal.style.display = 'flex');
    document.getElementById('close-settings').addEventListener('click', () => settingsModal.style.display = 'none');

    document.getElementById('max-downloads').addEventListener('input', (e) => {
        document.getElementById('max-downloads-val').textContent = e.target.value;
        appConfig.maxDownloads = parseInt(e.target.value);
        if (window.electronAPI) window.electronAPI.setConfig(appConfig);
    });

    document.getElementById('app-theme')?.addEventListener('change', (e) => {
        appConfig.theme = e.target.value;
        applyTheme(appConfig.theme);
        if (window.electronAPI) window.electronAPI.setConfig(appConfig);
    });

    document.getElementById('app-default-quality')?.addEventListener('change', (e) => {
        appConfig.defaultQuality = e.target.value;
        if (window.electronAPI) window.electronAPI.setConfig(appConfig);
    });

    document.getElementById('default-save-btn').addEventListener('click', async () => {
        if (window.electronAPI) {
            const dir = await window.electronAPI.selectDirectory();
            if (dir) {
                document.getElementById('default-save-dir').value = dir;
                appConfig.defaultSaveDir = dir;
                window.electronAPI.setConfig(appConfig);
            }
        }
    });

    // Helper to format time
    function formatTime(seconds) {
        if (!seconds) return '';
        const s = parseInt(seconds);
        if (isNaN(s)) return seconds + 's';
        const m = Math.floor(s / 60);
        const remS = s % 60;
        return `${m}:${remS.toString().padStart(2, '0')}`;
    }

    // --- Search Logic ---
    async function performSearch(query) {
        if (!query || !window.electronAPI) return;

        const searchType = document.getElementById('search-type')?.value || 'video';

        searchResults.innerHTML = '<div class="empty-state-small"><i class="ri-loader-4-line ri-spin"></i> Searching...</div>';
        selectedSearchUrls.clear();
        updateDownloadSelectedBtn();

        const response = await window.electronAPI.searchVideo(query, searchType);
        if (response.success && response.data.length > 0) {
            searchResults.innerHTML = response.data.map((item, idx) => `
                <div class="search-item progress-item" style="border-color: transparent; display: flex; flex-direction: row; align-items: flex-start; gap: 12px; transition: all 0.2s ease;">
                    <div style="padding-top: 4px;">    
                        <input type="checkbox" class="search-checkbox" value="${item.url}" style="width: 16px; height: 16px; cursor: pointer;">
                    </div>
                    ${item.thumbnail ? `
                    <div class="search-thumbnail-container" style="flex-shrink: 0; display: none;">
                        <img src="${item.thumbnail}" style="width: 120px; height: 68px; object-fit: cover; border-radius: 6px;">
                    </div>` : ''}
                    <div style="flex: 1; cursor: pointer; display: flex; flex-direction: column; justify-content: center; min-height: 24px;" onclick="window.selectVideo('${item.url}')">
                        <div class="progress-title" style="max-width: 100%; white-space: normal; line-height: 1.3; margin-bottom: 4px;">${item.title}</div>
                        <div class="progress-stats" style="margin-top: auto;">
                            <span>${item.uploader || 'Unknown'}</span>
                            ${item.duration ? `<span>${formatTime(item.duration)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');

            // Small hack to handle responsive thumbnail display via pure JS since standard CSS container queries are tricky with fixed classes here
            const updateThumbnails = () => {
                const isMax = leftPanel.classList.contains('panel-maximized');
                document.querySelectorAll('.search-thumbnail-container').forEach(el => {
                    el.style.display = isMax ? 'block' : 'none';
                });
            };

            // Re-apply when DOM updates
            updateThumbnails();

            // Bind to maximize button
            document.getElementById('maximize-left-btn')?.addEventListener('click', () => {
                setTimeout(updateThumbnails, 50); // slight delay for class toggle
            });

            // Attach checkbox listeners
            document.querySelectorAll('.search-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) selectedSearchUrls.add(e.target.value);
                    else selectedSearchUrls.delete(e.target.value);
                    updateDownloadSelectedBtn();
                });
            });
        } else {
            searchResults.innerHTML = '<div class="empty-state-small">No results found.</div>';
        }
    }

    function updateDownloadSelectedBtn() {
        const btn = document.getElementById('download-selected-btn');
        if (!btn) return;
        if (selectedSearchUrls.size > 0) {
            btn.style.display = 'flex';
            btn.innerHTML = `Download Selected (${selectedSearchUrls.size}) <i class="ri-download-line ml-2"></i>`;
        } else {
            btn.style.display = 'none';
        }
    }

    document.getElementById('download-selected-btn')?.addEventListener('click', async () => {
        if (!appConfig.defaultSaveDir) return alert('Please set a Default Save Directory first!');
        for (const url of selectedSearchUrls) {
            window.selectVideo(url);
            // small delay to let UI fetch Info for each before executing
            await new Promise(r => setTimeout(r, 1500));
            document.getElementById('download-btn').click();
            await new Promise(r => setTimeout(r, 500));
        }
        selectedSearchUrls.clear();
        document.querySelectorAll('.search-checkbox').forEach(cb => cb.checked = false);
        updateDownloadSelectedBtn();
    });

    searchBtn.addEventListener('click', () => performSearch(searchInput.value.trim()));
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(searchInput.value.trim()); });

    // --- Video Selection & Formats ---
    window.selectCard = function (element, isVideo) {
        const container = isVideo ? videoQuality : audioQuality;
        container.querySelectorAll('.quality-card').forEach(c => c.classList.remove('active'));
        element.classList.add('active');
        if (isVideo) selectedVideoFormat = element.getAttribute('data-format');
        else selectedAudioFormat = element.getAttribute('data-format');
    }

    window.selectVideo = async function (url) {
        urlInput.value = url;
        loadVideoInfo(url);
    };

    async function loadVideoInfo(url) {
        if (!url || !window.electronAPI) return;

        videoEmpty.style.display = 'flex';
        videoEmpty.innerHTML = '<i class="ri-loader-4-line ri-spin"></i><p>Fetching Native Formats...</p>';
        videoQuality.style.display = 'none';
        audioEmpty.style.display = 'flex';
        audioEmpty.innerHTML = '<i class="ri-loader-4-line ri-spin"></i><p>Fetching Native Formats...</p>';
        audioQuality.style.display = 'none';

        const response = await window.electronAPI.getVideoInfo(url);
        if (response.success) {
            const data = response.data;
            ytDataCache[url] = data;

            videoTitle.value = data.title;
            videoAuthor.value = data.author;

            let videoFormats = data.formats.filter(f => f.vcodec !== 'none' && f.resolution !== 'Audio');
            let audioFormats = data.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');

            // Cache Audio Formats for the Multiple Audio Modal
            audioFormats = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
            availableAudioFormats = audioFormats;

            // Render Video Formats
            videoFormats = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
            if (videoFormats.length > 0) {
                // Determine target index based on quality pref
                let targetIdx = 0; // max by default
                if (appConfig.defaultQuality === 'medium') {
                    // Try to pick something around 1080p or 720p
                    targetIdx = videoFormats.findIndex(f => f.height <= 1080) || 0;
                } else if (appConfig.defaultQuality === 'low') {
                    // Try to pick something around 480p or lower
                    targetIdx = videoFormats.findIndex(f => f.height <= 480) || videoFormats.length - 1;
                }
                // safeguard
                if (targetIdx < 0 || targetIdx >= videoFormats.length) targetIdx = 0;

                selectedVideoFormat = videoFormats[targetIdx].id;
                videoQuality.innerHTML = videoFormats.map((fmt, index) => `
                    <div class="quality-card ${index === targetIdx ? 'active' : ''}" data-format="${fmt.id}" onclick="selectCard(this, true)">
                        <div class="quality-format">${fmt.ext.toUpperCase()}</div>
                        <div class="quality-details">
                            <div class="quality-header">
                                <span class="resolution">${fmt.resolution}</span>
                                <span class="id-tag">id: ${fmt.id}</span>
                            </div>
                            <div class="quality-tags">
                                <span class="tag dark">${fmt.vcodec}</span>
                                ${fmt.acodec === 'none' ? `<span class="tag dark" style="opacity: 0.7;"><i class="ri-volume-mute-line"></i> No Audio</span>` : ''}
                                ${fmt.filesize ? `<span class="tag purple">${(fmt.filesize / 1024 / 1024).toFixed(1)} MB</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
                videoEmpty.style.display = 'none';
                videoQuality.style.display = 'flex';
            }

            // Render Audio Formats
            if (audioFormats.length > 0) {
                audioQuality.innerHTML = audioFormats.map((fmt, index) => `
                    <div class="quality-card ${index === 0 ? 'active' : ''}" data-format="${fmt.id}" onclick="selectCard(this, false)">
                        <div class="quality-format" style="background:var(--tag-purple);">${fmt.ext.toUpperCase()}</div>
                        <div class="quality-details">
                            <div class="quality-header">
                                <span class="resolution">${fmt.format_note || 'Audio Only'}</span>
                                <span class="id-tag">id: ${fmt.id}</span>
                            </div>
                            <div class="quality-tags">
                                <span class="tag blue"><i class="ri-music-2-fill"></i> ${fmt.acodec}</span>
                                ${fmt.filesize ? `<span class="tag purple">${(fmt.filesize / 1024 / 1024).toFixed(1)} MB</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
                audioEmpty.style.display = 'none';
                audioQuality.style.display = 'flex';
            }
        }
    }

    urlInput.addEventListener('input', () => {
        clearTimeout(window.urlTimeout);
        window.urlTimeout = setTimeout(() => {
            if (urlInput.value.includes('http')) loadVideoInfo(urlInput.value);
        }, 800);
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
        urlInput.value = '';
        videoTitle.value = '';
        videoAuthor.value = '';
    });

    // --- Audio Modal Logic ---
    let pendingDownloadContext = null;

    document.getElementById('close-audio-modal').addEventListener('click', () => audioSelectModal.style.display = 'none');

    document.getElementById('confirm-audio-btn').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.audio-track-cb:checked');
        const selectedAudioIds = Array.from(checkboxes).map(cb => cb.value);

        let formatToDownload = pendingDownloadContext.videoFormat;
        if (selectedAudioIds.length > 0) {
            // Force MKV when merging multiple audio tracks
            optContainer.value = 'mkv';
            const audioStr = selectedAudioIds.join('+');
            formatToDownload = `${formatToDownload}+${audioStr}`;
        } else {
            // fallback best
            formatToDownload = `${formatToDownload}+bestaudio/best`;
        }

        audioSelectModal.style.display = 'none';
        executeDownload(pendingDownloadContext.url, formatToDownload, pendingDownloadContext.id);
    });

    function showAudioModal(url, videoFormat, downloadId) {
        pendingDownloadContext = { url, videoFormat, id: downloadId };

        const list = document.getElementById('audio-tracks-list');
        list.innerHTML = availableAudioFormats.map((fmt, idx) => `
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--bg-main); border-radius:var(--border-radius-sm);">
                <input type="checkbox" class="audio-track-cb" value="${fmt.id}" id="audio-${fmt.id}" ${idx === 0 ? 'checked' : ''} style="width:18px;height:18px;">
                <label for="audio-${fmt.id}" style="flex:1; cursor:pointer;">
                    <strong>${fmt.format_note || 'Audio'}</strong> (${fmt.acodec}) 
                    <span style="font-size:12px; color:var(--text-secondary);">ID: ${fmt.id} ${fmt.filesize ? '- ' + (fmt.filesize / 1024 / 1024).toFixed(1) + 'MB' : ''}</span>
                </label>
            </div>
        `).join('');

        audioSelectModal.style.display = 'flex';
    }


    // --- Download Execution & Progress ---
    document.getElementById('download-btn').addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url || !window.electronAPI) return alert('Enter a valid URL or select a video.');
        if (!appConfig.defaultSaveDir) return alert('Please set a Default Save Directory in Settings first!');

        if (activeDownloads.size >= appConfig.maxDownloads) {
            return alert(`Max concurrent downloads reached (${appConfig.maxDownloads}). Wait for one to finish.`);
        }

        const isAudioTab = document.querySelector('.tab-content.active').id === 'tab-audio';
        const downloadId = 'dl_' + Date.now();

        // Add skeleton to UI
        addProgressItem(downloadId, videoTitle.value || url);
        activeDownloads.add(downloadId);

        let finalFormat = 'default';
        if (isAudioTab) {
            finalFormat = document.querySelector('#audio-quality .quality-card.active')?.getAttribute('data-format') || 'bestaudio/best';
            executeDownload(url, finalFormat, downloadId);
        } else {
            const vidFormat = selectedVideoFormat || 'bestvideo';
            const autoBestAudio = document.getElementById('opt-bestaudio').classList.contains('active');

            // If Auto Best is off and we have multiple audios, prompt user
            if (!autoBestAudio && availableAudioFormats.length > 1) {
                showAudioModal(url, vidFormat, downloadId);
            } else {
                finalFormat = `${vidFormat}+bestaudio/best`;
                executeDownload(url, finalFormat, downloadId);
            }
        }
    });

    function addProgressItem(id, title) {
        document.querySelector('.empty-progress')?.remove();
        const html = `
            <div class="progress-item" id="${id}">
                <div class="progress-header">
                    <div class="progress-title" title="${title}">${title}</div>
                    <div class="progress-controls">
                        <i class="ri-pause-circle-line" title="Pause" style="cursor:pointer; color:var(--text-secondary);"></i>
                        <i class="ri-close-circle-line" title="Cancel" style="cursor:pointer; color:#EF4444;" onclick="document.getElementById('${id}').remove()"></i>
                    </div>
                </div>
                <div class="progress-track"><div class="progress-fill" id="${id}-fill"></div></div>
                <div class="progress-stats">
                    <span id="${id}-status">Initializing...</span>
                    <span id="${id}-speed"></span>
                </div>
            </div>
        `;
        progressList.insertAdjacentHTML('afterbegin', html);
    }

    async function executeDownload(url, format, id) {
        const options = {
            mergeOutputFormat: optContainer.value,
            embedThumbnail: document.getElementById('opt-thumbnail')?.classList.contains('active'),
            embedSubs: document.getElementById('opt-subtitles')?.classList.contains('active')
        };

        window.electronAPI.downloadVideo({
            id: id,
            url: url,
            format: format,
            saveDir: appConfig.defaultSaveDir,
            options: options
        });
    }

    // --- IPC Listeners ---
    if (window.electronAPI) {
        window.electronAPI.onDownloadProgress((data) => {
            const fill = document.getElementById(`${data.id}-fill`);
            const status = document.getElementById(`${data.id}-status`);
            const speed = document.getElementById(`${data.id}-speed`);

            if (fill) fill.style.width = `${data.percent}%`;
            if (status) status.textContent = `${data.percent}% of ${data.size}`;
            if (speed) speed.textContent = `${data.speed} - ETA: ${data.eta}`;
        });

        window.electronAPI.onDownloadStatus((data) => {
            const status = document.getElementById(`${data.id}-status`);
            const fill = document.getElementById(`${data.id}-fill`);
            if (status) status.textContent = data.status;
            if (fill) fill.style.background = 'var(--text-secondary)'; // Turn grey during merge
        });

        window.electronAPI.onDownloadComplete((data) => {
            const status = document.getElementById(`${data.id}-status`);
            const fill = document.getElementById(`${data.id}-fill`);
            if (status) {
                status.textContent = 'Completed';
                status.style.color = '#10B981';
            }
            if (fill) fill.style.background = '#10B981';
            activeDownloads.delete(data.id);
        });

        window.electronAPI.onDownloadError((data) => {
            const status = document.getElementById(`${data.id}-status`);
            const fill = document.getElementById(`${data.id}-fill`);
            if (status) {
                status.textContent = 'Error: ' + data.error;
                status.style.color = '#EF4444';
            }
            if (fill) fill.style.background = '#EF4444';
            activeDownloads.delete(data.id);
        });
    }
});
