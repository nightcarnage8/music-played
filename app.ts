// Types
interface Song {
    id: string;
    title: string;
    artist: string;
    album?: string;
    cover?: string;
    file: File;
    url: string;
    duration: number;
    favorite: boolean;
}

interface AppState {
    songs: Song[];
    currentSong: Song | null;
    currentIndex: number;
    isPlaying: boolean;
    isOnline: boolean;
    favorites: string[];
}

// State Management
class musicPlayer {
    private state: AppState;
    private audio: HTMLAudioElement;
    private progressBarFill!: HTMLElement;
    private currentTimeDisplay!: HTMLElement;
    private totalTimeDisplay!: HTMLElement;
    private playPauseBtn!: HTMLElement;
    private playPauseIcon!: HTMLElement;
    private nowPlayingBar!: HTMLElement;
    private nowPlayingCover!: HTMLImageElement;
    private nowPlayingTitle!: HTMLElement;
    private nowPlayingArtist!: HTMLElement;

    constructor() {
        this.state = {
            songs: [],
            currentSong: null,
            currentIndex: -1,
            isPlaying: false,
            isOnline: navigator.onLine,
            favorites: []
        };

        this.audio = document.getElementById('audioPlayer') as HTMLAudioElement;
        this.progressBarFill = document.getElementById('progressBarFill')!;
        this.currentTimeDisplay = document.getElementById('currentTime')!;
        this.totalTimeDisplay = document.getElementById('totalTime')!;
        this.playPauseBtn = document.getElementById('playPauseBtn')!;
        this.playPauseIcon = document.getElementById('playPauseIcon')!;
        this.nowPlayingBar = document.getElementById('nowPlayingBar')!;
        this.nowPlayingCover = document.getElementById('nowPlayingCover') as HTMLImageElement;
        this.nowPlayingTitle = document.getElementById('nowPlayingTitle')!;
        this.nowPlayingArtist = document.getElementById('nowPlayingArtist')!;

        this.init();
    }

    private init(): void {
        this.loadSongsFromStorage();
        this.loadFavoritesFromStorage();
        this.setupEventListeners();
        this.setupNavigation();
        this.setupSearch();
        this.updateUI();
        this.checkOnlineStatus();
        this.hideLoadingScreen();
    }

    private setupEventListeners(): void {
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
        document.getElementById('prevBtn')!.addEventListener('click', () => {
            this.prevSong();
        });

        // Next button
        document.getElementById('nextBtn')!.addEventListener('click', () => {
            this.nextSong();
        });

        // Progress bar click for seeking
        const progressBar = document.getElementById('progressBar')!;
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = (clickX / rect.width) * 100;
            this.seekTo(percentage);
        });

        // Upload button
        document.getElementById('uploadBtn')!.addEventListener('click', () => {
            this.openUploadModal();
        });

        // Mode toggle
        document.getElementById('modeToggle')!.addEventListener('click', () => {
            this.toggleMode();
        });

        // Delete button
        document.getElementById('deleteBtn')!.addEventListener('click', () => {
            this.openDeleteModal();
        });

        // Upload modal
        this.setupUploadModal();

        // Delete modal
        this.setupDeleteModal();

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

    private setupUploadModal(): void {
        const uploadModal = document.getElementById('uploadModal')!;
        const closeModal = document.getElementById('closeModal')!;
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        const uploadArea = document.getElementById('uploadArea')!;
        const selectFilesBtn = document.getElementById('selectFilesBtn')!;

        // Open file input
        selectFilesBtn.addEventListener('click', () => {
            fileInput.click();
        });

        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

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

            const files = e.dataTransfer?.files;
            if (files) {
                this.handleFileUpload(Array.from(files));
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files) {
                this.handleFileUpload(Array.from(target.files));
            }
        });

        // Close modal
        closeModal.addEventListener('click', () => {
            uploadModal.classList.remove('show');
        });

        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) {
                uploadModal.classList.remove('show');
            }
        });
    }

    private async handleFileUpload(files: File[]): Promise<void> {
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        
        if (audioFiles.length === 0) {
            alert('Tidak ada file audio yang valid!');
            return;
        }

        const uploadProgress = document.getElementById('uploadProgress')!;
        const progressFill = document.getElementById('progressFill')!;
        const progressText = document.getElementById('progressText')!;
        
        uploadProgress.style.display = 'block';
        progressText.textContent = 'Memproses file...';

        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];
            const progress = ((i + 1) / audioFiles.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Mengunggah ${i + 1} dari ${audioFiles.length}...`;

            try {
                const song = await this.processAudioFile(file);
                this.addSong(song);
            } catch (error) {
                console.error('Error processing file:', error);
                alert(`Error memproses ${file.name}`);
            }
        }

        progressText.textContent = 'Selesai!';
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            document.getElementById('uploadModal')!.classList.remove('show');
            this.updateUI();
        }, 1000);
    }

    private async processAudioFile(file: File): Promise<Song> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const audio = new Audio(url);

            audio.addEventListener('loadedmetadata', () => {
                const duration = audio.duration;

                // Extract metadata and cover art
                this.extractMetadata(file, url).then(({ title, artist, album, cover }) => {
                    const song: Song = {
                        id: this.generateId(),
                        title: title || file.name.replace(/\.[^/.]+$/, ''),
                        artist: artist || 'Unknown Artist',
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
        });
    }

    private async extractMetadata(file: File, url: string): Promise<{ title: string; artist: string; album?: string; cover?: string }> {
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

    private async extractCoverArt(file: File, url: string): Promise<string | undefined> {
        return new Promise((resolve) => {
            // Create a canvas to generate a gradient cover if no cover art found
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d')!;

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

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private addSong(song: Song): void {
        this.state.songs.push(song);
        this.saveSongsToStorage();
    }

    private playSong(index: number): void {
        if (index < 0 || index >= this.state.songs.length) return;

        this.state.currentIndex = index;
        this.state.currentSong = this.state.songs[index];
        this.audio.src = this.state.currentSong.url;
        this.audio.load();

        this.updateNowPlaying();
        this.updateUI();
        this.play();
    }

    private play(): void {
        this.audio.play().then(() => {
            this.state.isPlaying = true;
            this.updatePlayPauseButton();
        }).catch(error => {
            console.error('Play error:', error);
        });
    }

    private pause(): void {
        this.audio.pause();
        this.state.isPlaying = false;
        this.updatePlayPauseButton();
    }

    private togglePlayPause(): void {
        if (this.state.currentSong) {
            if (this.state.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }
    }

    private nextSong(): void {
        if (this.state.songs.length === 0) return;

        let nextIndex = this.state.currentIndex + 1;
        if (nextIndex >= this.state.songs.length) {
            nextIndex = 0; // Loop back to first song
        }
        this.playSong(nextIndex);
    }

    private prevSong(): void {
        if (this.state.songs.length === 0) return;

        let prevIndex = this.state.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = this.state.songs.length - 1; // Loop to last song
        }
        this.playSong(prevIndex);
    }

    private seekTo(percentage: number): void {
        if (this.audio.duration) {
            this.audio.currentTime = (percentage / 100) * this.audio.duration;
        }
    }

    private updateProgress(): void {
        if (this.audio.duration) {
            const percentage = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressBarFill.style.width = `${percentage}%`;
            this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    private updateTotalTime(): void {
        if (this.audio.duration) {
            this.totalTimeDisplay.textContent = this.formatTime(this.audio.duration);
        }
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    private updatePlayPauseButton(): void {
        if (this.state.isPlaying) {
            this.playPauseIcon.className = 'fas fa-pause';
        } else {
            this.playPauseIcon.className = 'fas fa-play';
        }
    }

    private updateNowPlaying(): void {
        if (this.state.currentSong) {
            this.nowPlayingBar.style.display = 'flex';
            this.nowPlayingCover.src = this.state.currentSong.cover || '';
            this.nowPlayingTitle.textContent = this.state.currentSong.title;
            this.nowPlayingArtist.textContent = this.state.currentSong.artist;
        } else {
            this.nowPlayingBar.style.display = 'none';
        }
    }

    private setupNavigation(): void {
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

    private switchPage(pageId: string): void {
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    }

    private setupSearch(): void {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        const searchResults = document.getElementById('searchResults')!;

        searchInput.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
            this.performSearch(query, searchResults);
        });
    }

    private performSearch(query: string, container: HTMLElement): void {
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

    private updateUI(): void {
        this.updateSongsGrid();
        this.updateFavoritesList();
        this.updateLibraryPage();
        this.updateNowPlaying();
    }

    private updateSongsGrid(): void {
        const grid = document.getElementById('songsGrid')!;
        
        if (this.state.songs.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <p>Belum ada lagu. Upload lagu untuk memulai!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.renderSongsGrid(this.state.songs);
        this.attachSongListeners(grid);
    }

    private renderSongsGrid(songs: Song[]): string {
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
                    </div>
                </div>
            </div>
        `).join('');
    }

    private renderSongsList(songs: Song[]): string {
        return `
            <div class="songs-list">
                ${songs.map(song => `
                    <div class="song-list-item ${this.state.currentSong?.id === song.id ? 'active' : ''}" 
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
                            <button class="btn-small" data-song-id="${song.id}" data-action="play">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private attachSongListeners(container: HTMLElement): void {
        // Play buttons
        container.querySelectorAll('[data-song-id]').forEach(element => {
            const songId = element.getAttribute('data-song-id');
            const action = element.getAttribute('data-action');

            if (action === 'play' || element.classList.contains('song-play-btn') || element.classList.contains('song-card') || element.classList.contains('song-list-item')) {
                element.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).closest('.btn-small')) {
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
    }

    private toggleFavorite(songId: string): void {
        const song = this.state.songs.find(s => s.id === songId);
        if (song) {
            song.favorite = !song.favorite;
            if (song.favorite) {
                if (!this.state.favorites.includes(songId)) {
                    this.state.favorites.push(songId);
                }
            } else {
                this.state.favorites = this.state.favorites.filter(id => id !== songId);
            }
            this.saveFavoritesToStorage();
            this.saveSongsToStorage();
            this.updateUI();
        }
    }

    private updateFavoritesList(): void {
        const favoritesList = document.getElementById('favoritesList')!;
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

    private updateLibraryPage(): void {
        const totalSongs = document.getElementById('totalSongs')!;
        const totalFavorites = document.getElementById('totalFavorites')!;
        const librarySongsList = document.getElementById('librarySongsList')!;

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

    private openUploadModal(): void {
        document.getElementById('uploadModal')!.classList.add('show');
    }

    private openDeleteModal(): void {
        document.getElementById('deleteModal')!.classList.add('show');
    }

    private setupDeleteModal(): void {
        const deleteModal = document.getElementById('deleteModal')!;
        const closeDeleteModal = document.getElementById('closeDeleteModal')!;
        const deleteAllOption = document.getElementById('deleteAllOption')!;
        const deleteSelectedOption = document.getElementById('deleteSelectedOption')!;
        const deleteAllContent = document.getElementById('deleteAllContent')!;
        const deleteSelectedContent = document.getElementById('deleteSelectedContent')!;
        const cancelDeleteAllBtn = document.getElementById('cancelDeleteAllBtn')!;
        const confirmDeleteAllBtn = document.getElementById('confirmDeleteAllBtn')!;
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn')!;
        const confirmDeleteSelectedBtn = document.getElementById('confirmDeleteSelectedBtn')!;
        const songsCheckboxList = document.getElementById('songsCheckboxList')!;

        // Close modal
        closeDeleteModal.addEventListener('click', () => {
            deleteModal.classList.remove('show');
        });

        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                deleteModal.classList.remove('show');
            }
        });

        // Delete all option
        deleteAllOption.addEventListener('click', () => {
            deleteAllContent.style.display = 'block';
            deleteSelectedContent.style.display = 'none';
        });

        // Delete selected option
        deleteSelectedOption.addEventListener('click', () => {
            deleteSelectedContent.style.display = 'block';
            deleteAllContent.style.display = 'none';
            this.populateSongsCheckboxList(songsCheckboxList);
        });

        // Cancel buttons
        cancelDeleteAllBtn.addEventListener('click', () => {
            deleteAllContent.style.display = 'none';
        });

        cancelDeleteBtn.addEventListener('click', () => {
            deleteSelectedContent.style.display = 'none';
        });

        // Confirm delete all
        confirmDeleteAllBtn.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin menghapus semua lagu? Tindakan ini tidak dapat dibatalkan.')) {
                this.deleteAllSongs();
                deleteModal.classList.remove('show');
            }
        });

        // Confirm delete selected
        confirmDeleteSelectedBtn.addEventListener('click', () => {
            const selectedIds = this.getSelectedSongIds(songsCheckboxList);
            if (selectedIds.length === 0) {
                alert('Pilih setidaknya satu lagu untuk dihapus.');
                return;
            }
            if (confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} lagu yang dipilih?`)) {
                this.deleteSelectedSongs(selectedIds);
                deleteModal.classList.remove('show');
            }
        });
    }

    private populateSongsCheckboxList(container: HTMLElement): void {
        container.innerHTML = this.state.songs.map(song => `
            <div class="checkbox-item">
                <input type="checkbox" id="song-${song.id}" value="${song.id}">
                <label for="song-${song.id}">
                    <img src="${song.cover || ''}" alt="${song.title}" class="checkbox-cover" onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">
                    <div class="checkbox-info">
                        <div class="checkbox-title">${this.escapeHtml(song.title)}</div>
                        <div class="checkbox-artist">${this.escapeHtml(song.artist)}</div>
                    </div>
                </label>
            </div>
        `).join('');

        // Update confirm button state
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        const confirmBtn = document.getElementById('confirmDeleteSelectedBtn') as HTMLButtonElement;

        const updateConfirmBtn = () => {
            const checkedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
            confirmBtn.disabled = checkedCount === 0;
            confirmBtn.textContent = checkedCount > 0 ? `Hapus yang Dipilih (${checkedCount})` : 'Hapus yang Dipilih';
        };

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateConfirmBtn);
        });

        updateConfirmBtn();
    }

    private getSelectedSongIds(container: HTMLElement): string[] {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => (cb as HTMLInputElement).value);
    }

    private deleteAllSongs(): void {
        // Stop current playback
        this.pause();
        this.state.currentSong = null;
        this.state.currentIndex = -1;

        // Clear all songs
        this.state.songs = [];
        this.state.favorites = [];

        // Clear storage
        localStorage.removeItem('musicPlayer_songs');
        localStorage.removeItem('musicPlayer_favorites');

        // Update UI
        this.updateUI();

        // Show notification
        this.showToast('Semua lagu telah dihapus.', 'success');
    }

    private deleteSelectedSongs(songIds: string[]): void {
        // Check if current song is being deleted
        const currentSongDeleted = this.state.currentSong && songIds.includes(this.state.currentSong.id);

        if (currentSongDeleted) {
            this.pause();
            this.state.currentSong = null;
            this.state.currentIndex = -1;
        }

        // Remove songs
        this.state.songs = this.state.songs.filter(song => !songIds.includes(song.id));

        // Remove from favorites
        this.state.favorites = this.state.favorites.filter(id => !songIds.includes(id));

        // Update current index if necessary
        if (this.state.currentIndex >= this.state.songs.length) {
            this.state.currentIndex = this.state.songs.length - 1;
        }

        // Save to storage
        this.saveSongsToStorage();
        this.saveFavoritesToStorage();

        // Update UI
        this.updateUI();

        // Show notification
        this.showToast(`${songIds.length} lagu telah dihapus.`, 'success');
    }

    private showToast(message: string, type: 'success' | 'error' = 'success'): void {
        const toast = document.getElementById('toastNotification')!;
        const toastIcon = document.getElementById('toastIcon')!;
        const toastMessage = document.getElementById('toastMessage')!;

        toastIcon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        toastMessage.textContent = message;

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    private toggleMode(): void {
        // Mode toggle functionality (can be extended)
        alert(`Mode: ${this.state.isOnline ? 'Online' : 'Offline'}\n\nAplikasi ini bekerja di mode offline. Semua lagu disimpan secara lokal.`);
    }

    private checkOnlineStatus(): void {
        this.state.isOnline = navigator.onLine;
        this.updateModeIcon();
    }

    private updateModeIcon(): void {
        const modeIcon = document.getElementById('modeIcon')!;
        if (this.state.isOnline) {
            modeIcon.className = 'fas fa-wifi';
            modeIcon.title = 'Mode Online';
        } else {
            modeIcon.className = 'fas fa-wifi-slash';
            modeIcon.title = 'Mode Offline';
        }
    }

    private hideLoadingScreen(): void {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Storage methods
    private saveSongsToStorage(): void {
        try {
            const songsData = this.state.songs.map(song => ({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                cover: song.cover,
                url: song.url,
                duration: song.duration,
                favorite: song.favorite,
                fileName: song.file.name,
                fileSize: song.file.size,
                fileType: song.file.type
            }));
            localStorage.setItem('musicPlayer_songs', JSON.stringify(songsData));
        } catch (error) {
            console.error('Error saving songs:', error);
        }
    }

    private loadSongsFromStorage(): void {
        try {
            const stored = localStorage.getItem('musicPlayer_songs');
            if (stored) {
                const songsData = JSON.parse(stored);
                // Note: File objects can't be stored, so we'll need to handle this differently
                // For now, we'll just store metadata and recreate URLs if needed
                this.state.songs = songsData.map((data: any) => ({
                    ...data,
                    file: new File([], data.fileName || 'unknown', { type: data.fileType || 'audio/mpeg' })
                }));
            }
        } catch (error) {
            console.error('Error loading songs:', error);
        }
    }

    private saveFavoritesToStorage(): void {
        try {
            localStorage.setItem('musicPlayer_favorites', JSON.stringify(this.state.favorites));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    private loadFavoritesFromStorage(): void {
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
    get isOnline(): boolean {
        return this.state.isOnline;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});

