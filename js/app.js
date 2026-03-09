document.addEventListener('DOMContentLoaded', async () => {
    // --- Global State ---
    let appConfig = {
        theme: 'dark',
        defaultQuality: 'max',
        maxDownloads: 2,
        defaultSaveDir: '',
        language: 'en'
    };
    let ytDataCache = {};       // Cache format info by URL to skip redundant fetches
    let selectedVideoFormat = null;
    let selectedAudioFormat = null;
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

    // Initialize config
    if (window.electronAPI) {
        appConfig = await window.electronAPI.getConfig();
        document.getElementById('default-save-dir').value = appConfig.defaultSaveDir || '';
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

    // Panel Toggling
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    document.getElementById('toggle-left-btn')?.addEventListener('click', () => {
        leftPanel.classList.toggle('panel-collapsed');
    });
    document.getElementById('toggle-right-btn')?.addEventListener('click', () => {
        rightPanel.classList.toggle('panel-collapsed');
    });

    // Show Tips popup
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

    // Helper: format seconds to m:ss
    function formatTime(seconds) {
        if (!seconds) return '';
        const s = parseInt(seconds);
        if (isNaN(s)) return seconds + 's';
        const m = Math.floor(s / 60);
        const remS = s % 60;
        return `${m}:${remS.toString().padStart(2, '0')}`;
    }

    // --- Search Logic ---
    let currentSearchQuery = '';
    let currentSearchType = 'video';
    let currentSearchOffset = 0;

    searchResults.addEventListener('change', (e) => {
        if (e.target.classList.contains('search-checkbox')) {
            if (e.target.checked) selectedSearchUrls.add(e.target.value);
            else selectedSearchUrls.delete(e.target.value);
            updateDownloadSelectedBtn();
        }
    });

    async function performSearch(query, isLoadMore = false) {
        if (!query || !window.electronAPI) return;

        if (!isLoadMore) {
            currentSearchQuery = query;
            currentSearchType = document.getElementById('search-type')?.value || 'video';
            currentSearchOffset = 0;
            searchResults.innerHTML = '<div class="empty-state-small"><i class="ri-loader-4-line ri-spin"></i> Searching...</div>';
            selectedSearchUrls.clear();
            updateDownloadSelectedBtn();
        } else {
            const btn = document.getElementById('load-more-btn');
            if (btn) btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Loading...';
        }

        const response = await window.electronAPI.searchVideo(currentSearchQuery, currentSearchType, currentSearchOffset);
        if (response.success && response.data.length > 0) {
            let newHtml = response.data.map((item) => `
                <div class="search-item progress-item" style="border-color: transparent; display: flex; flex-direction: row; align-items: flex-start; gap: 12px; transition: all 0.2s ease;">
                    <div style="padding-top: 4px;">
                        <input type="checkbox" class="search-checkbox" value="${item.url}" style="width: 16px; height: 16px; cursor: pointer;">
                    </div>
                    ${item.thumbnail ? `
                    <div style="flex-shrink: 0;">
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

            if (currentSearchType === 'video' && response.data.length === 20) {
                newHtml += `
                <div id="load-more-container" style="text-align: center; padding: 12px 0;">
                    <button id="load-more-btn" class="primary-btn" style="margin: 0 auto; height: 32px; font-size: 13px; background: var(--bg-surface-hover); border: 1px solid var(--border-color);">Load More</button>
                </div>`;
            }

            if (isLoadMore) {
                const oldContainer = document.getElementById('load-more-container');
                if (oldContainer) oldContainer.remove();
                searchResults.insertAdjacentHTML('beforeend', newHtml);
            } else {
                searchResults.innerHTML = newHtml;
            }

            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', () => {
                    currentSearchOffset += 20;
                    performSearch(currentSearchQuery, true);
                });
            }
        } else {
            if (!isLoadMore) {
                searchResults.innerHTML = '<div class="empty-state-small">No results found.</div>';
            } else {
                const btn = document.getElementById('load-more-btn');
                if (btn) {
                    btn.innerHTML = 'No more results';
                    btn.disabled = true;
                }
            }
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

        const urlsToDownload = Array.from(selectedSearchUrls);

        for (const url of urlsToDownload) {
            await loadVideoInfo(url);
            await new Promise(r => setTimeout(r, 200));
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
    };

    window.selectVideo = async function (url) {
        urlInput.value = url;
        await loadVideoInfo(url);
    };

    function populateFormats(data) {
        videoTitle.value = data.title;
        videoAuthor.value = data.author;
        // Also sync the read-only title in the Audio-Only tab
        const audioTitleEl = document.getElementById('video-title-audio');
        if (audioTitleEl) audioTitleEl.value = data.title;

        let videoFormats = data.formats.filter(f => f.vcodec !== 'none' && f.resolution !== 'Audio');
        let audioFormats = data.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');

        // Sort: best first
        audioFormats = audioFormats.sort((a, b) => (b.abr || b.tbr || b.filesize || 0) - (a.abr || a.tbr || a.filesize || 0));
        availableAudioFormats = audioFormats;

        videoFormats = videoFormats.sort((a, b) => (b.height || b.tbr || b.filesize || 0) - (a.height || a.tbr || a.filesize || 0));

        // Render Video Formats
        if (videoFormats.length > 0) {
            let targetIdx = 0;
            if (appConfig.defaultQuality === 'medium') {
                const idx = videoFormats.findIndex(f => f.height <= 1080);
                targetIdx = idx >= 0 ? idx : 0;
            } else if (appConfig.defaultQuality === 'low') {
                const idx = videoFormats.findIndex(f => f.height <= 480);
                targetIdx = idx >= 0 ? idx : videoFormats.length - 1;
            }
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
        } else {
            videoEmpty.innerHTML = '<i class="ri-movie-line"></i><p>No video formats found</p>';
            videoEmpty.style.display = 'flex';
            videoQuality.style.display = 'none';
        }

        // Render Audio Formats
        if (audioFormats.length > 0) {
            selectedAudioFormat = audioFormats[0].id;
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
                            ${fmt.abr ? `<span class="tag dark">${fmt.abr}kbps</span>` : ''}
                            ${fmt.filesize ? `<span class="tag purple">${(fmt.filesize / 1024 / 1024).toFixed(1)} MB</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
            audioEmpty.style.display = 'none';
            audioQuality.style.display = 'flex';
        } else {
            audioEmpty.innerHTML = '<i class="ri-music-2-line"></i><p>No audio-only formats found</p>';
            audioEmpty.style.display = 'flex';
            audioQuality.style.display = 'none';
        }
    }

    async function loadVideoInfo(url) {
        if (!url || !window.electronAPI) return;

        // --- CACHE GUARD: skip network fetch if we already have this URL's data ---
        if (ytDataCache[url]) {
            populateFormats(ytDataCache[url]);
            return;
        }

        // Show loading state
        videoEmpty.style.display = 'flex';
        videoEmpty.innerHTML = '<i class="ri-loader-4-line ri-spin"></i><p>Fetching formats...</p>';
        videoQuality.style.display = 'none';
        audioEmpty.style.display = 'flex';
        audioEmpty.innerHTML = '<i class="ri-loader-4-line ri-spin"></i><p>Fetching formats...</p>';
        audioQuality.style.display = 'none';

        const response = await window.electronAPI.getVideoInfo(url);
        if (response.success) {
            ytDataCache[url] = response.data;  // Store in cache
            populateFormats(response.data);
        } else {
            videoEmpty.innerHTML = `<i class="ri-error-warning-line"></i><p style="color:#EF4444;">Error: ${response.error || 'Failed to fetch'}</p>`;
            videoEmpty.style.display = 'flex';
            audioEmpty.innerHTML = `<i class="ri-error-warning-line"></i><p style="color:#EF4444;">Error fetching audio</p>`;
            audioEmpty.style.display = 'flex';
        }
    }

    urlInput.addEventListener('input', () => {
        clearTimeout(window.urlTimeout);
        window.urlTimeout = setTimeout(() => {
            if (urlInput.value.includes('http')) loadVideoInfo(urlInput.value.trim());
        }, 800);
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
        urlInput.value = '';
        videoTitle.value = '';
        videoAuthor.value = '';
        // Reset format panels
        videoEmpty.innerHTML = '<i class="ri-movie-line"></i><p>Select a video to fetch formats</p>';
        videoEmpty.style.display = 'flex';
        videoQuality.style.display = 'none';
        audioEmpty.innerHTML = '<i class="ri-music-2-line"></i><p>Select a video to fetch audio formats</p>';
        audioEmpty.style.display = 'flex';
        audioQuality.style.display = 'none';
        selectedVideoFormat = null;
        selectedAudioFormat = null;
    });

    // --- Audio Modal Logic ---
    let pendingDownloadContext = null;

    document.getElementById('close-audio-modal').addEventListener('click', () => {
        audioSelectModal.style.display = 'none';
        // Remove the progress item since they cancelled
        if (pendingDownloadContext) {
            activeDownloads.delete(pendingDownloadContext.id);
            document.getElementById(pendingDownloadContext.id)?.remove();
            pendingDownloadContext = null;
        }
    });

    document.getElementById('confirm-audio-btn').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.audio-track-cb:checked');
        const selectedAudioIds = Array.from(checkboxes).map(cb => cb.value);

        let formatToDownload = pendingDownloadContext.videoFormat;
        if (selectedAudioIds.length > 0) {
            optContainer.value = 'mkv';
            const audioStr = selectedAudioIds.join('+');
            formatToDownload = `${formatToDownload}+${audioStr}`;
        } else {
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

        const activeTabId = document.querySelector('.tab-content.active')?.id;
        const isAudioTab = activeTabId === 'tab-audio';
        const downloadId = 'dl_' + Date.now();

        addProgressItem(downloadId, videoTitle.value || url);
        activeDownloads.add(downloadId);

        if (isAudioTab) {
            // Audio-only mode: use extractAudio flag with chosen container
            const audioFmtId = document.querySelector('#audio-quality .quality-card.active')?.getAttribute('data-format') || 'bestaudio/best';
            const audioContainer = document.getElementById('opt-audio-container')?.value || 'mp3';
            const embedAudioThumbnail = document.getElementById('opt-audio-thumbnail')?.classList.contains('active');
            executeDownload(url, audioFmtId, downloadId, {
                isAudioOnly: true,
                audioContainer,
                embedThumbnail: embedAudioThumbnail
            });
        } else {
            // Video mode
            const vidFormat = selectedVideoFormat || 'bestvideo';
            const autoBestAudio = document.getElementById('opt-bestaudio').classList.contains('active');

            if (!autoBestAudio && availableAudioFormats.length > 1) {
                showAudioModal(url, vidFormat, downloadId);
            } else {
                const finalFormat = `${vidFormat}+bestaudio/best`;
                executeDownload(url, finalFormat, downloadId);
            }
        }
    });

    function addProgressItem(id, title) {
        document.querySelector('.empty-progress')?.remove();
        // Escape quotes in title for use in HTML attribute
        const safeTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const html = `
            <div class="progress-item" id="${id}">
                <div class="progress-header">
                    <div class="progress-title" title="${safeTitle}">${title}</div>
                    <div class="progress-controls">
                        <i class="ri-close-circle-line" title="Remove" style="cursor:pointer; color:var(--text-muted); font-size:18px;" onclick="document.getElementById('${id}').remove()"></i>
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

    async function executeDownload(url, format, id, extraOptions = {}) {
        const options = {
            mergeOutputFormat: optContainer.value,
            embedThumbnail: document.getElementById('opt-thumbnail')?.classList.contains('active'),
            embedSubs: document.getElementById('opt-subtitles')?.classList.contains('active'),
            ...extraOptions
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
            if (status) status.textContent = `${data.percent.toFixed(1)}% of ${data.size}`;
            if (speed) speed.textContent = `${data.speed} · ETA ${data.eta}`;
        });

        window.electronAPI.onDownloadStatus((data) => {
            const status = document.getElementById(`${data.id}-status`);
            const fill = document.getElementById(`${data.id}-fill`);
            if (status) status.textContent = data.status;
            if (fill) {
                fill.style.width = '100%';
                fill.style.background = 'var(--text-secondary)';
            }
        });

        window.electronAPI.onDownloadComplete((data) => {
            const status = document.getElementById(`${data.id}-status`);
            const fill = document.getElementById(`${data.id}-fill`);
            const item = document.getElementById(data.id);

            if (status) {
                status.textContent = 'Completed';
                status.style.color = '#10B981';
            }
            if (fill) {
                fill.style.width = '100%';
                fill.style.background = '#10B981';
            }

            // Append Open File / Open Folder buttons if we know the file path
            if (item && data.filePath) {
                // Escape backslashes for JS string in inline onclick
                const escapedPath = data.filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                item.insertAdjacentHTML('beforeend', `
                    <div class="progress-actions">
                        <button class="action-link-btn" onclick="window.electronAPI.openFile('${escapedPath}')">
                            <i class="ri-play-circle-line"></i> Open File
                        </button>
                        <button class="action-link-btn" onclick="window.electronAPI.openFolder('${escapedPath}')">
                            <i class="ri-folder-open-line"></i> Open Folder
                        </button>
                    </div>
                `);
            } else if (item && !data.filePath) {
                // Fallback: open folder by save dir
                item.insertAdjacentHTML('beforeend', `
                    <div class="progress-actions">
                        <button class="action-link-btn" onclick="window.electronAPI.openFolder('${(appConfig.defaultSaveDir || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">
                            <i class="ri-folder-open-line"></i> Open Folder
                        </button>
                    </div>
                `);
            }

            activeDownloads.delete(data.id);
        });

        window.electronAPI.onDownloadError((data) => {
            const status = document.getElementById(`${data.id}-status`);
            const fill = document.getElementById(`${data.id}-fill`);
            if (status) {
                status.textContent = 'Error: ' + data.error;
                status.style.color = '#EF4444';
            }
            if (fill) {
                fill.style.width = '100%';
                fill.style.background = '#EF4444';
            }
            activeDownloads.delete(data.id);
        });
    }
});
