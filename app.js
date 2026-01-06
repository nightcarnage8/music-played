// Music Player Application
class MusicPlayer {
    constructor() {
        // Record start time so loading screen can be shown at least a minimum time
        this._startTime = Date.now();
        this.state = {
            songs: [],
            currentSong: null,
            currentIndex: -1,
            isPlaying: false,
            isOnline: navigator.onLine,
            favorites: []
        };

        this.audio = document.getElementById('audioPlayer');
        this.progressSlider = document.getElementById('progressSlider');
        this.progressBarFill = document.getElementById('progressBarFill');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.totalTimeDisplay = document.getElementById('totalTime');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playPauseIcon = document.getElementById('playPauseIcon');
        this.nowPlayingBar = document.getElementById('nowPlayingBar');
        this.nowPlayingCover = document.getElementById('nowPlayingCover');
        this.nowPlayingTitle = document.getElementById('nowPlayingTitle');
        this.nowPlayingArtist = document.getElementById('nowPlayingArtist');

        this.db = null;
        this.init();
    }

    async init() {
        const loadingScreen = document.getElementById('loadingScreen');
        try {
            await this.initIndexedDB();
            await this.loadSongsFromStorage();
            this.loadFavoritesFromStorage();
            this.setupEventListeners();
            this.setupNavigation();
            this.setupSearch();
            this.updateUI();
            this.checkOnlineStatus();
            // Setup progress UI (knob and markers)
            this.setupProgressUI();
        } catch (err) {
            console.error('Init error:', err);
        } finally {
            // Ensure loading screen shows for at least 2 seconds total
            const minMs = 2000;
            const elapsed = Date.now() - (this._startTime || Date.now());
            const remaining = Math.max(0, minMs - elapsed);
            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.classList.add('hidden');
                    // remove from flow after fade
                    setTimeout(() => {
                        try { loadingScreen.style.display = 'none'; } catch (e) {}
                    }, 350);
                }
            }, remaining);
        }
    }

    setupProgressUI() {
        const progressContainer = document.querySelector('.progress-container');
        const progressBarBg = document.querySelector('.progress-bar-bg');
        if (!progressContainer || !progressBarBg) return;
        // (no markers) Keep progress bar clean

        // Create knob if not present
        if (!progressContainer.querySelector('.progress-knob')) {
            const knob = document.createElement('div');
            knob.className = 'progress-knob';
            knob.style.position = 'absolute';
            knob.style.top = '50%';
            knob.style.left = '0%';
            knob.style.transform = 'translate(-50%, -50%)';
            knob.style.cursor = 'pointer';
            progressContainer.appendChild(knob);
        }

        this.progressBarBg = progressBarBg;
        this.progressContainer = progressContainer;
        this.progressKnob = progressContainer.querySelector('.progress-knob');

        // Dragging support
        let dragging = false;

        const calculateAndSeek = (clientX) => {
            const rect = this.progressBarBg.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const percentage = (x / rect.width) * 100;
            this.seekTo(percentage);
        };

        this.progressKnob.addEventListener('mousedown', (e) => {
            dragging = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            calculateAndSeek(e.clientX);
        });

        document.addEventListener('mouseup', () => {
            dragging = false;
        });

        // Touch support
        this.progressKnob.addEventListener('touchstart', (e) => {
            dragging = true;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const touch = e.touches[0];
            calculateAndSeek(touch.clientX);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            dragging = false;
        });

        // Click on progress container also seeks
        this.progressContainer.addEventListener('click', (e) => {
            const rect = this.progressBarBg.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const percentage = (x / rect.width) * 100;
            this.seekTo(percentage);
        });
    }

    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MusicPlayerDB', 1);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('songs')) {
                    db.createObjectStore('songs', { keyPath: 'id' });
                }
            };
        });
    }

    async saveFileToIndexedDB(songId, file) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const transaction = this.db.transaction(['songs'], 'readwrite');
                const store = transaction.objectStore('songs');
                const request = store.put({
                    id: songId,
                    file: e.target.result,
                    fileName: file.name,
                    fileType: file.type
                });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    async loadFileFromIndexedDB(songId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['songs'], 'readonly');
            const store = transaction.objectStore('songs');
            const request = store.get(songId);

            request.onsuccess = () => {
                if (request.result) {
                    const blob = new Blob([request.result.file], { type: request.result.fileType });
                    const url = URL.createObjectURL(blob);
                    resolve({ url, fileName: request.result.fileName, fileType: request.result.fileType });
                } else {
                    reject(new Error('File not found'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFileFromIndexedDB(songId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(); // If DB not initialized, just resolve
                return;
            }

            const transaction = this.db.transaction(['songs'], 'readwrite');
            const store = transaction.objectStore('songs');
            const request = store.delete(songId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    setupEventListeners() {
        // Audio events
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateTotalTime();
        });

        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.audio.addEventListener('ended', () => {
            this.nextSong();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            alert('Error memutar lagu. Pastikan file audio valid.');
        });

        // Play/Pause button
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Previous button
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => { this.prevSong(); });
        }

        // Next button
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => { this.nextSong(); });
        }

        // Progress slider / progress bar click (some HTML uses a div progress bar)
        if (this.progressSlider) {
            this.progressSlider.addEventListener('input', (e) => {
                const target = e.target;
                const value = parseFloat(target.value);
                this.seekTo(value);
            });
        } else if (this.progressBarFill) {
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.addEventListener('click', (e) => {
                    const rect = progressContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percentage = (x / rect.width) * 100;
                    this.seekTo(percentage);
                });
            }
        }

        // Upload button
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => { this.openUploadModal(); });
        }

        // Delete button
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => { this.openDeleteModal(); });
        }

        // Mode toggle
        const modeToggle = document.getElementById('modeToggle');
        if (modeToggle) {
            modeToggle.addEventListener('click', () => { this.toggleMode(); });
        }

        // Upload modal
        this.setupUploadModal();

        // Delete modal
        this.setupDeleteModal();
        // Edit modal
        this.setupEditModal();

        // Online/Offline detection
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.updateModeIcon();
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.updateModeIcon();
        });
    }

    setupUploadModal() {
        const uploadModal = document.getElementById('uploadModal');
        const closeModal = document.getElementById('closeModal');
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const selectFilesBtn = document.getElementById('selectFilesBtn');

        // Open file input
        if (selectFilesBtn) {
            selectFilesBtn.addEventListener('click', () => { fileInput && fileInput.click(); });
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => { fileInput && fileInput.click(); });
        }

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = 'rgba(29, 185, 84, 0.1)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.background = 'transparent';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.background = 'transparent';

            const files = e.dataTransfer && e.dataTransfer.files;
            if (files) {
                this.prepareUploadFiles(Array.from(files));
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const target = e.target;
            if (target.files) {
                this.prepareUploadFiles(Array.from(target.files));
            }
        });

        // Close modal
        if (closeModal) {
            closeModal.addEventListener('click', () => { uploadModal && uploadModal.classList.remove('show'); });
        }

        if (uploadModal) {
            uploadModal.addEventListener('click', (e) => {
                if (e.target === uploadModal) {
                    uploadModal.classList.remove('show');
                }
            });
        }

        // Prepare / start upload actions
        const fileMetadataList = document.getElementById('fileMetadataList');
        const uploadActions = document.getElementById('uploadActions');
        const startUploadBtn = document.getElementById('startUploadBtn');
        const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');

        if (cancelSelectionBtn) {
            cancelSelectionBtn.addEventListener('click', () => {
            // Reset file input and hide metadata UI
            fileInput.value = '';
            if (fileMetadataList) fileMetadataList.innerHTML = '';
            if (fileMetadataList) fileMetadataList.style.display = 'none';
            if (uploadActions) uploadActions.style.display = 'none';
            });
        }

        if (startUploadBtn) {
            startUploadBtn.addEventListener('click', () => {
            // Gather metadata and start upload
            if (!fileMetadataList) return;
            const items = [];
            const rows = fileMetadataList.querySelectorAll('.file-metadata-item');
            rows.forEach((row, idx) => {
                const fileIndex = parseInt(row.getAttribute('data-index'), 10);
                const file = this._pendingFiles && this._pendingFiles[fileIndex];
                if (!file) return;
                const titleInput = row.querySelector('.metadata-title');
                const artistInput = row.querySelector('.metadata-artist');
                items.push({ file: file, title: titleInput ? titleInput.value.trim() : null, artist: artistInput ? artistInput.value.trim() : null });
            });
            // start processing
            this.handleFileUpload(items);
            // clear pending UI
            fileInput.value = '';
            fileMetadataList.innerHTML = '';
            fileMetadataList.style.display = 'none';
            uploadActions.style.display = 'none';
            this._pendingFiles = null;
            });
        }
    }

    async handleFileUpload(files) {
        // Support items as {file, title, artist} or plain File
        const items = files.map(item => {
            if (item && item.file) return item;
            return { file: item, title: null, artist: null };
        });

        const audioItems = items.filter(i => i.file && i.file.type && i.file.type.startsWith('audio/'));
        if (audioItems.length === 0) {
            alert('Tidak ada file audio yang valid!');
            return;
        }

        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        uploadProgress.style.display = 'block';
        progressText.textContent = 'Memproses file...';

        for (let i = 0; i < audioItems.length; i++) {
            const item = audioItems[i];
            const file = item.file;
            const meta = { title: item.title, artist: item.artist };
            const progress = ((i + 1) / audioItems.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Mengunggah ${i + 1} dari ${audioItems.length}...`;

            try {
                const song = await this.processAudioFile(file, meta);
                this.addSong(song);
            } catch (error) {
                console.error('Error processing file:', error);
                alert(`Error memproses ${file.name}`);
            }
        }

        progressText.textContent = 'Selesai!';
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            document.getElementById('uploadModal').classList.remove('show');
            // clear pending metadata UI
            const metaList = document.getElementById('fileMetadataList');
            const uploadActions = document.getElementById('uploadActions');
            if (metaList) metaList.innerHTML = '';
            if (metaList) metaList.style.display = 'none';
            if (uploadActions) uploadActions.style.display = 'none';
            this.updateUI();
        }, 1000);
    }

    prepareUploadFiles(files) {
        // show metadata inputs in modal for user to edit before uploading
        const audioFiles = files.filter(f => f.type && f.type.startsWith && f.type.startsWith('audio/'));
        if (audioFiles.length === 0) {
            alert('Tidak ada file audio yang valid!');
            return;
        }

        this._pendingFiles = audioFiles;
        const fileMetadataList = document.getElementById('fileMetadataList');
        const uploadActions = document.getElementById('uploadActions');
        if (!fileMetadataList || !uploadActions) return;

        fileMetadataList.innerHTML = '';
        audioFiles.forEach((file, idx) => {
            const fileName = file.name;
            const defaultTitle = fileName.replace(/\.[^/.]+$/, '');
            const wrapper = document.createElement('div');
            wrapper.className = 'file-metadata-item';
            wrapper.setAttribute('data-index', idx.toString());
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '0.5rem';
            wrapper.style.marginBottom = '0.75rem';

            const nameEl = document.createElement('div');
            nameEl.textContent = fileName;
            nameEl.style.fontWeight = '600';
            nameEl.style.fontSize = '0.95rem';

            const titleInput = document.createElement('input');
            titleInput.className = 'metadata-title';
            titleInput.placeholder = 'Judul lagu';
            titleInput.value = defaultTitle;
            titleInput.style.padding = '0.5rem';
            titleInput.style.borderRadius = '6px';
            titleInput.style.border = '1px solid var(--border-color)';
            titleInput.style.background = 'var(--surface-color)';
            titleInput.style.color = 'var(--text-primary)';

            const artistInput = document.createElement('input');
            artistInput.className = 'metadata-artist';
            artistInput.placeholder = 'Nama artis';
            artistInput.value = '';
            artistInput.style.padding = '0.5rem';
            artistInput.style.borderRadius = '6px';
            artistInput.style.border = '1px solid var(--border-color)';
            artistInput.style.background = 'var(--surface-color)';
            artistInput.style.color = 'var(--text-primary)';

            wrapper.appendChild(nameEl);
            wrapper.appendChild(titleInput);
            wrapper.appendChild(artistInput);
            fileMetadataList.appendChild(wrapper);
        });

        fileMetadataList.style.display = 'block';
        uploadActions.style.display = 'flex';
    }

    async processAudioFile(file, meta = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                const url = URL.createObjectURL(file);
                const audio = new Audio(url);

                audio.addEventListener('loadedmetadata', async () => {
                    const duration = audio.duration;
                    const songId = this.generateId();

                    // Save file to IndexedDB
                    try {
                        await this.saveFileToIndexedDB(songId, file);
                    } catch (error) {
                        console.error('Error saving file to IndexedDB:', error);
                        // Continue anyway, will use blob URL
                    }

                    // Extract metadata and cover art
                    this.extractMetadata(file, url).then(({ title, artist, album, cover }) => {
                        const defaultTitle = title || file.name.replace(/\.[^/.]+$/, '');
                        const defaultArtist = artist || 'Unknown Artist';

                        const finalTitle = (meta && meta.title) ? meta.title : defaultTitle;
                        const finalArtist = (meta && meta.artist) ? meta.artist : defaultArtist;

                        const song = {
                            id: songId,
                            title: finalTitle,
                            artist: finalArtist,
                            album: album,
                            cover: cover,
                            file: file,
                            url: url,
                            duration: duration,
                            favorite: false
                        };

                        resolve(song);
                    }).catch(reject);
                });

                audio.addEventListener('error', () => {
                    reject(new Error('Failed to load audio file'));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async extractMetadata(file, url) {
        return new Promise((resolve) => {
            // Try to use MusicMetadata library if available, otherwise use basic extraction
            // For now, we'll use a simple approach with file name parsing
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            const parts = fileName.split(' - ');

            let title = fileName;
            let artist = 'Unknown Artist';

            if (parts.length >= 2) {
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }

            // Try to extract cover art from audio file
            this.extractCoverArt(file, url).then(cover => {
                resolve({ title, artist, cover });
            }).catch(() => {
                resolve({ title, artist });
            });
        });
    }

    async extractCoverArt(file, url) {
        return new Promise((resolve) => {
            // Create a canvas to generate a gradient cover if no cover art found
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');

            // Generate a gradient based on the file name hash
            const hash = this.hashCode(file.name);
            const hue = hash % 360;
            const gradient = ctx.createLinearGradient(0, 0, 300, 300);
            gradient.addColorStop(0, `hsl(${hue}, 70%, 50%)`);
            gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 30%)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 300, 300);

            // Add music icon
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♪', 150, 150);

            const coverUrl = canvas.toDataURL();
            resolve(coverUrl);
        });
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addSong(song) {
        this.state.songs.push(song);
        this.saveSongsToStorage();
    }

    async playSong(index) {
        if (index < 0 || index >= this.state.songs.length) return;

        this.state.currentIndex = index;
        this.state.currentSong = this.state.songs[index];

        // Always try to load from IndexedDB if URL is missing or invalid
        // Blob URLs become invalid after page refresh
        if (!this.state.currentSong.url) {
            try {
                const fileData = await this.loadFileFromIndexedDB(this.state.currentSong.id);
                this.state.currentSong.url = fileData.url;
                // Update the song in the array
                this.state.songs[index].url = fileData.url;
            } catch (error) {
                console.error('Error loading file from IndexedDB:', error);
                alert('Error memuat lagu. File mungkin telah dihapus.');
                return;
            }
        }

        // Test if the URL is still valid by trying to load it
        try {
            this.audio.src = this.state.currentSong.url;
            this.audio.load();
        } catch (error) {
            // If URL is invalid, try loading from IndexedDB
            try {
                const fileData = await this.loadFileFromIndexedDB(this.state.currentSong.id);
                this.state.currentSong.url = fileData.url;
                this.state.songs[index].url = fileData.url;
                this.audio.src = fileData.url;
                this.audio.load();
            } catch (dbError) {
                console.error('Error loading file from IndexedDB:', dbError);
                alert('Error memuat lagu. File mungkin telah dihapus.');
                return;
            }
        }

        this.updateNowPlaying();
        this.updateUI();
        this.play();
    }

    play() {
        this.audio.play().then(() => {
            this.state.isPlaying = true;
            this.updatePlayPauseButton();
        }).catch(error => {
            console.error('Play error:', error);
        });
    }

    pause() {
        this.audio.pause();
        this.state.isPlaying = false;
        this.updatePlayPauseButton();
    }

    togglePlayPause() {
        if (this.state.currentSong) {
            if (this.state.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }
    }

    nextSong() {
        if (this.state.songs.length === 0) return;

        let nextIndex = this.state.currentIndex + 1;
        if (nextIndex >= this.state.songs.length) {
            nextIndex = 0; // Loop back to first song
        }
        this.playSong(nextIndex);
    }

    prevSong() {
        if (this.state.songs.length === 0) return;

        let prevIndex = this.state.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = this.state.songs.length - 1; // Loop to last song
        }
        this.playSong(prevIndex);
    }

    seekTo(percentage) {
        if (this.audio.duration) {
            const time = (percentage / 100) * this.audio.duration;
            this.audio.currentTime = time;
            this.updateProgress();
        }
    }

    updateProgress() {
        if (this.audio.duration) {
            const percentage = (this.audio.currentTime / this.audio.duration) * 100;
            if (this.progressSlider) {
                this.progressSlider.value = percentage.toString();
            } else if (this.progressBarFill) {
                this.progressBarFill.style.width = `${percentage}%`;
            }
            if (this.progressKnob) {
                this.progressKnob.style.left = `${percentage}%`;
            }
            this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateTotalTime() {
        if (this.audio.duration) {
            this.totalTimeDisplay.textContent = this.formatTime(this.audio.duration);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updatePlayPauseButton() {
        if (this.state.isPlaying) {
            this.playPauseIcon.className = 'fas fa-pause';
        } else {
            this.playPauseIcon.className = 'fas fa-play';
        }
    }

    updateNowPlaying() {
        if (this.state.currentSong) {
            this.nowPlayingBar.style.display = 'flex';
            this.nowPlayingCover.src = this.state.currentSong.cover || '';
            this.nowPlayingTitle.textContent = this.state.currentSong.title;
            this.nowPlayingTitle.title = this.state.currentSong.title; // Tooltip for full text
            this.nowPlayingArtist.textContent = this.state.currentSong.artist;
            this.nowPlayingArtist.title = this.state.currentSong.artist; // Tooltip for full text
        } else {
            this.nowPlayingBar.style.display = 'none';
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const pageId = item.getAttribute('data-page');
                if (pageId) {
                    this.switchPage(pageId);
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        });
    }

    switchPage(pageId) {
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    }

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            this.performSearch(query, searchResults);
        });
    }

    performSearch(query, container) {
        if (!query) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Mulai mengetik untuk mencari lagu...</p>
                </div>
            `;
            return;
        }

        const results = this.state.songs.filter(song => 
            song.title.toLowerCase().includes(query) ||
            song.artist.toLowerCase().includes(query) ||
            (song.album && song.album.toLowerCase().includes(query))
        );

        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Tidak ada hasil ditemukan</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.renderSongsList(results);
        this.attachSongListeners(container);
    }

    updateUI() {
        this.updateSongsGrid();
        this.updateFavoritesList();
        this.updateLibraryPage();
        this.updateNowPlaying();
    }

    updateSongsGrid() {
        const grid = document.getElementById('songsGrid');
        if (!grid) return;

        if (this.state.songs.length === 0) {
            grid.classList.add('empty');
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <p>Belum ada lagu. Upload lagu untuk memulai!</p>
                </div>
            `;
            return;
        }

        grid.classList.remove('empty');
        grid.innerHTML = this.renderSongsGrid(this.state.songs);
        this.attachSongListeners(grid);
    }

    renderSongsGrid(songs) {
        return songs.map(song => `
            <div class="song-card" data-song-id="${song.id}">
                <div class="song-cover-container">
                    <img src="${song.cover || ''}" alt="${song.title}" class="song-cover" onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">
                    <button class="song-play-btn" data-song-id="${song.id}">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.title)}</div>
                    <div class="song-artist">${this.escapeHtml(song.artist)}</div>
                    <div class="song-actions">
                        <button class="btn-small favorite ${song.favorite ? 'active' : ''}" 
                                data-song-id="${song.id}" 
                                title="${song.favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="btn-small edit-btn" data-song-id="${song.id}" title="Edit judul/artis">
                            <i class="fas fa-pen"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderSongsList(songs) {
        return `
            <div class="songs-list">
                ${songs.map(song => `
                    <div class="song-list-item ${this.state.currentSong && this.state.currentSong.id === song.id ? 'active' : ''}" 
                         data-song-id="${song.id}">
                        <img src="${song.cover || ''}" alt="${song.title}" class="song-list-cover" 
                             onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">
                        <div class="song-list-info">
                            <div class="song-list-title">${this.escapeHtml(song.title)}</div>
                            <div class="song-list-artist">${this.escapeHtml(song.artist)}</div>
                        </div>
                        <div class="song-list-actions">
                            <button class="btn-small favorite ${song.favorite ? 'active' : ''}" 
                                    data-song-id="${song.id}">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="btn-small edit-btn" data-song-id="${song.id}" title="Edit judul/artis">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn-small" data-song-id="${song.id}" data-action="play">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    attachSongListeners(container) {
        // Play buttons
        container.querySelectorAll('[data-song-id]').forEach(element => {
            const songId = element.getAttribute('data-song-id');
            const action = element.getAttribute('data-action');

            if (action === 'play' || element.classList.contains('song-play-btn') || element.classList.contains('song-card') || element.classList.contains('song-list-item')) {
                element.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-small')) {
                        return; // Don't trigger if clicking action buttons
                    }
                    const song = this.state.songs.find(s => s.id === songId);
                    if (song) {
                        const index = this.state.songs.indexOf(song);
                        this.playSong(index);
                    }
                });
            }
        });

        // Favorite buttons
        container.querySelectorAll('.favorite').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const songId = btn.getAttribute('data-song-id');
                if (songId) {
                    this.toggleFavorite(songId);
                }
            });
        });

        // Edit buttons
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const songId = btn.getAttribute('data-song-id');
                if (songId) {
                    this.openEditModal(songId);
                }
            });
        });
    }

    toggleFavorite(songId) {
        const song = this.state.songs.find(s => s.id === songId);
        if (song) {
            song.favorite = !song.favorite;
            if (song.favorite) {
                if (!this.state.favorites.includes(songId)) {
                    this.state.favorites.push(songId);
                }
                this.showToast('success', 'Lagu ditambahkan ke favorit', 'fas fa-heart');
            } else {
                this.state.favorites = this.state.favorites.filter(id => id !== songId);
                this.showToast('info', 'Lagu dihapus dari favorit', 'fas fa-heart');
            }
            this.saveFavoritesToStorage();
            this.saveSongsToStorage();
            this.updateUI();
        }
    }

    showToast(type, message, icon) {
        const toast = document.getElementById('toastNotification');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');

        if (!toast || !toastIcon || !toastMessage) return;

        // Remove existing classes
        toast.classList.remove('show', 'success', 'info');
        
        // Set content
        toastIcon.className = `toast-icon ${icon}`;
        toastMessage.textContent = message;
        
        // Add type class
        toast.classList.add(type);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    updateFavoritesList() {
        const favoritesList = document.getElementById('favoritesList');
        const favoriteSongs = this.state.songs.filter(song => song.favorite);

        if (favoriteSongs.length === 0) {
            favoritesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart"></i>
                    <p>Belum ada lagu favorit. Tambahkan lagu ke favorit!</p>
                </div>
            `;
            return;
        }

        favoritesList.innerHTML = this.renderSongsList(favoriteSongs);
        this.attachSongListeners(favoritesList);
    }

    updateLibraryPage() {
        const totalSongs = document.getElementById('totalSongs');
        const totalFavorites = document.getElementById('totalFavorites');
        const librarySongsList = document.getElementById('librarySongsList');

        totalSongs.textContent = this.state.songs.length.toString();
        totalFavorites.textContent = this.state.favorites.length.toString();

        if (this.state.songs.length === 0) {
            librarySongsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Pustaka kosong. Upload lagu untuk mengisi!</p>
                </div>
            `;
            return;
        }

        librarySongsList.innerHTML = this.renderSongsList(this.state.songs);
        this.attachSongListeners(librarySongsList);
    }

    openUploadModal() {
        document.getElementById('uploadModal').classList.add('show');
    }

    setupDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        const deleteAllOption = document.getElementById('deleteAllOption');
        const deleteSelectedOption = document.getElementById('deleteSelectedOption');
        const deleteAllContent = document.getElementById('deleteAllContent');
        const deleteSelectedContent = document.getElementById('deleteSelectedContent');
        const cancelDeleteAllBtn = document.getElementById('cancelDeleteAllBtn');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const confirmDeleteAllBtn = document.getElementById('confirmDeleteAllBtn');
        const confirmDeleteSelectedBtn = document.getElementById('confirmDeleteSelectedBtn');

        // Close modal
        closeDeleteModal.addEventListener('click', () => {
            this.closeDeleteModal();
        });

        cancelDeleteAllBtn.addEventListener('click', () => {
            this.closeDeleteModal();
        });

        cancelDeleteBtn.addEventListener('click', () => {
            this.closeDeleteModal();
        });

        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                this.closeDeleteModal();
            }
        });

        // Delete all option
        deleteAllOption.addEventListener('click', () => {
            deleteAllContent.style.display = 'block';
            deleteSelectedContent.style.display = 'none';
            deleteAllOption.classList.add('active');
            deleteSelectedOption.classList.remove('active');
        });

        // Delete selected option
        deleteSelectedOption.addEventListener('click', () => {
            deleteAllContent.style.display = 'none';
            deleteSelectedContent.style.display = 'block';
            deleteAllOption.classList.remove('active');
            deleteSelectedOption.classList.add('active');
            this.renderSongsCheckboxList();
        });

        // Confirm delete all
        confirmDeleteAllBtn.addEventListener('click', () => {
            this.deleteAllSongs();
        });

        // Confirm delete selected
        confirmDeleteSelectedBtn.addEventListener('click', () => {
            this.deleteSelectedSongs();
        });
    }

    setupEditModal() {
        const editModal = document.getElementById('editModal');
        const closeEditModal = document.getElementById('closeEditModal');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');

        if (closeEditModal) {
            closeEditModal.addEventListener('click', () => { editModal && editModal.classList.remove('show'); });
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => { editModal && editModal.classList.remove('show'); });
        }

        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => { this.saveEdit(); });
        }

        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) editModal.classList.remove('show');
            });
        }
    }

    openEditModal(songId) {
        const song = this.state.songs.find(s => s.id === songId);
        if (!song) return;
        const editModal = document.getElementById('editModal');
        const titleInput = document.getElementById('editTitleInput');
        const artistInput = document.getElementById('editArtistInput');
        if (!editModal || !titleInput || !artistInput) return;

        titleInput.value = song.title || '';
        artistInput.value = song.artist || '';
        this._editingSongId = songId;
        editModal.classList.add('show');
    }

    saveEdit() {
        const titleInput = document.getElementById('editTitleInput');
        const artistInput = document.getElementById('editArtistInput');
        const editModal = document.getElementById('editModal');
        if (!titleInput || !artistInput) return;

        const newTitle = titleInput.value.trim() || 'Unknown Title';
        const newArtist = artistInput.value.trim() || 'Unknown Artist';

        const songId = this._editingSongId;
        if (!songId) return;

        const song = this.state.songs.find(s => s.id === songId);
        if (!song) return;

        song.title = newTitle;
        song.artist = newArtist;

        this.saveSongsToStorage();
        this.updateUI();

        if (editModal) editModal.classList.remove('show');
        this._editingSongId = null;
        this.showToast('success', 'Perubahan tersimpan', 'fas fa-check');
    }

    openDeleteModal() {
        if (this.state.songs.length === 0) {
            alert('Tidak ada lagu untuk dihapus!');
            return;
        }

        const deleteModal = document.getElementById('deleteModal');
        const deleteAllContent = document.getElementById('deleteAllContent');
        const deleteSelectedContent = document.getElementById('deleteSelectedContent');
        const deleteAllOption = document.getElementById('deleteAllOption');
        const deleteSelectedOption = document.getElementById('deleteSelectedOption');

        // Reset modal state
        deleteAllContent.style.display = 'none';
        deleteSelectedContent.style.display = 'none';
        deleteAllOption.classList.remove('active');
        deleteSelectedOption.classList.remove('active');

        deleteModal.classList.add('show');
    }

    closeDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        deleteModal.classList.remove('show');
        
        // Reset checkboxes
        const checkboxes = document.querySelectorAll('.song-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        document.getElementById('confirmDeleteSelectedBtn').disabled = true;
    }

    renderSongsCheckboxList() {
        const container = document.getElementById('songsCheckboxList');
        
        if (this.state.songs.length === 0) {
            container.innerHTML = '<p class="empty-message">Tidak ada lagu</p>';
            return;
        }

        container.innerHTML = this.state.songs.map(song => `
            <div class="song-checkbox-item">
                <input type="checkbox" class="song-checkbox" data-song-id="${song.id}" id="song-${song.id}">
                <label for="song-${song.id}" class="song-checkbox-label">
                    <img src="${song.cover || ''}" alt="${song.title}" class="song-checkbox-cover" 
                         onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">
                    <div class="song-checkbox-info">
                        <div class="song-checkbox-title">${this.escapeHtml(song.title)}</div>
                        <div class="song-checkbox-artist">${this.escapeHtml(song.artist)}</div>
                    </div>
                </label>
            </div>
        `).join('');

        // Add event listeners to checkboxes
        const checkboxes = container.querySelectorAll('.song-checkbox');
        const confirmBtn = document.getElementById('confirmDeleteSelectedBtn');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const checkedCount = container.querySelectorAll('.song-checkbox:checked').length;
                confirmBtn.disabled = checkedCount === 0;
            });
        });
    }

    async deleteAllSongs() {
        if (this.state.songs.length === 0) return;

        // Stop audio if playing
        if (this.state.isPlaying) {
            this.pause();
        }

        // Revoke all object URLs and delete from IndexedDB
        for (const song of this.state.songs) {
            if (song.url && song.url.startsWith('blob:')) {
                URL.revokeObjectURL(song.url);
            }
            await this.deleteFileFromIndexedDB(song.id).catch(err => {
                console.error('Error deleting file from IndexedDB:', err);
            });
        }

        // Clear all songs
        this.state.songs = [];
        this.state.favorites = [];
        this.state.currentSong = null;
        this.state.currentIndex = -1;
        
        // Clear audio
        this.audio.src = '';
        this.audio.load();

        // Save to storage
        this.saveSongsToStorage();
        this.saveFavoritesToStorage();

        // Update UI
        this.updateUI();
        this.closeDeleteModal();
    }

    deleteSelectedSongs() {
        const container = document.getElementById('songsCheckboxList');
        const checkedBoxes = container.querySelectorAll('.song-checkbox:checked');
        
        if (checkedBoxes.length === 0) return;

        const songIdsToDelete = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-song-id'));

        // Check if current song is being deleted
        const isCurrentSongDeleted = this.state.currentSong && songIdsToDelete.includes(this.state.currentSong.id);

        // Stop audio if current song is being deleted
        if (isCurrentSongDeleted && this.state.isPlaying) {
            this.pause();
        }

        // Remove songs
        this.state.songs = this.state.songs.filter(song => {
            if (songIdsToDelete.includes(song.id)) {
                // Revoke object URL to free memory
                if (song.url && song.url.startsWith('blob:')) {
                    URL.revokeObjectURL(song.url);
                }
                // Delete from IndexedDB
                this.deleteFileFromIndexedDB(song.id).catch(err => {
                    console.error('Error deleting file from IndexedDB:', err);
                });
                return false;
            }
            return true;
        });

        // Remove from favorites
        this.state.favorites = this.state.favorites.filter(id => !songIdsToDelete.includes(id));

        // Update current song if it was deleted
        if (isCurrentSongDeleted) {
            this.state.currentSong = null;
            this.state.currentIndex = -1;
            this.audio.src = '';
            this.audio.load();
        } else if (this.state.currentSong) {
            // Update current index
            const newIndex = this.state.songs.findIndex(s => s.id === this.state.currentSong.id);
            this.state.currentIndex = newIndex;
        }

        // Save to storage
        this.saveSongsToStorage();
        this.saveFavoritesToStorage();

        // Update UI
        this.updateUI();
        this.closeDeleteModal();
    }

    toggleMode() {
        // Mode toggle functionality (can be extended)
        alert(`Mode: ${this.state.isOnline ? 'Online' : 'Offline'}\n\nAplikasi ini bekerja di mode offline. Semua lagu disimpan secara lokal.`);
    }

    checkOnlineStatus() {
        this.state.isOnline = navigator.onLine;
        this.updateModeIcon();
    }

    updateModeIcon() {
        const modeIcon = document.getElementById('modeIcon');
        if (!modeIcon) return;
        if (this.state.isOnline) {
            modeIcon.className = 'fas fa-wifi';
            modeIcon.title = 'Mode Online';
        } else {
            modeIcon.className = 'fas fa-wifi-slash';
            modeIcon.title = 'Mode Offline';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Storage methods
    saveSongsToStorage() {
        try {
            const songsData = this.state.songs.map(song => ({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                cover: song.cover,
                duration: song.duration,
                favorite: song.favorite,
                fileName: song.file ? song.file.name : (song.fileName || 'unknown'),
                fileSize: song.file ? song.file.size : (song.fileSize || 0),
                fileType: song.file ? song.file.type : (song.fileType || 'audio/mpeg')
            }));
            localStorage.setItem('musicPlayer_songs', JSON.stringify(songsData));
        } catch (error) {
            console.error('Error saving songs:', error);
        }
    }

    async loadSongsFromStorage() {
        try {
            const stored = localStorage.getItem('musicPlayer_songs');
            if (stored) {
                const songsData = JSON.parse(stored);
                // Load files from IndexedDB and create blob URLs
                this.state.songs = await Promise.all(songsData.map(async (data) => {
                    let url = null;
                    let file = null;

                    try {
                        const fileData = await this.loadFileFromIndexedDB(data.id);
                        url = fileData.url;
                        file = new File([], fileData.fileName, { type: fileData.fileType });
                    } catch (error) {
                        console.warn(`File not found in IndexedDB for song ${data.id}:`, error);
                        // Create a dummy file object
                        file = new File([], data.fileName || 'unknown', { type: data.fileType || 'audio/mpeg' });
                    }

                    return {
                        ...data,
                        url: url,
                        file: file
                    };
                }));
            }
        } catch (error) {
            console.error('Error loading songs:', error);
        }
    }

    saveFavoritesToStorage() {
        try {
            localStorage.setItem('musicPlayer_favorites', JSON.stringify(this.state.favorites));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    loadFavoritesFromStorage() {
        try {
            const stored = localStorage.getItem('musicPlayer_favorites');
            if (stored) {
                this.state.favorites = JSON.parse(stored);
                // Update song favorite status
                this.state.songs.forEach(song => {
                    song.favorite = this.state.favorites.includes(song.id);
                });
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }

    // Public getter for isOnline
    get isOnline() {
        return this.state.isOnline;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});

