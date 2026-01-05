# Music Player App - Spotify Clone

Aplikasi music player yang mirip dengan Spotify dengan fitur offline dan online, dibuat menggunakan HTML, CSS, JavaScript, dan TypeScript.

## Fitur Utama

### 🎵 Pemutar Musik
- Play/Pause lagu
- Next/Previous lagu
- Progress bar dengan seek functionality
- Timer durasi yang bisa diatur maju mundur
- Auto-play lagu berikutnya saat lagu selesai

### 📱 Navigasi
- Navbar di bagian bawah dengan menu:
  - **Beranda**: Menampilkan semua lagu dalam bentuk grid
  - **Cari**: Pencarian lagu berdasarkan judul, artis, atau album
  - **Favorit**: Daftar lagu yang ditandai sebagai favorit
  - **Pustaka**: Statistik dan daftar lengkap semua lagu

### 📤 Upload Lagu
- Upload lagu dari file perangkat (HP, komputer, dll)
- Drag & drop file audio
- Support multiple file upload
- Format yang didukung: MP3, WAV, OGG, M4A
- Progress bar saat upload

### 🎨 Cover Art Otomatis
- Generate cover gambar otomatis untuk setiap lagu
- Gradient unik berdasarkan nama file
- Icon musik pada cover

### ⭐ Favorit
- Tandai lagu sebagai favorit
- Halaman khusus untuk lagu favorit
- Tombol favorit di setiap lagu

### 💾 Mode Offline
- Semua lagu disimpan secara lokal
- Bekerja tanpa koneksi internet
- LocalStorage untuk menyimpan data
- Deteksi status online/offline

### 🎛️ Kontrol Musik
- Now Playing Bar yang tetap terlihat saat memutar musik
- Informasi lagu yang sedang diputar
- Kontrol play/pause, next, previous
- Progress slider dengan waktu current dan total

## Cara Menggunakan

1. **Buka aplikasi**
   - Buka file `index.html` di browser

2. **Upload lagu**
   - Klik tombol upload (ikon cloud) di header
   - Pilih file audio atau drag & drop file ke area upload
   - Tunggu proses upload selesai

3. **Memutar lagu**
   - Klik pada card lagu atau tombol play
   - Gunakan kontrol di Now Playing Bar untuk mengatur pemutaran

4. **Navigasi**
   - Gunakan navbar di bawah untuk berpindah halaman
   - Gunakan fitur search untuk mencari lagu

5. **Favorit**
   - Klik tombol hati pada lagu untuk menambah/menghapus dari favorit

## Struktur File

```
Music App/
├── index.html          # Struktur HTML utama
├── styles.css          # Styling aplikasi
├── app.ts              # TypeScript source code
├── app.js              # JavaScript compiled
├── tsconfig.json       # Konfigurasi TypeScript
├── package.json        # Dependencies
└── README.md           # Dokumentasi
```

## Teknologi yang Digunakan

- **HTML5**: Struktur aplikasi
- **CSS3**: Styling modern dengan CSS Variables dan Flexbox/Grid
- **JavaScript (ES6+)**: Logika aplikasi
- **TypeScript**: Type-safe development
- **LocalStorage API**: Penyimpanan data lokal
- **HTML5 Audio API**: Pemutaran audio
- **Canvas API**: Generate cover art
- **Font Awesome**: Icons

## Fitur Teknis

- **Responsive Design**: Bekerja di desktop dan mobile
- **Modern UI/UX**: Desain yang menarik dan mudah digunakan
- **Performance**: Optimized untuk performa yang baik
- **Accessibility**: Keyboard navigation support
- **Error Handling**: Penanganan error yang baik

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Catatan

- File audio disimpan di browser menggunakan LocalStorage (metadata) dan Object URLs
- Untuk penggunaan jangka panjang, pertimbangkan menggunakan IndexedDB untuk file yang lebih besar
- Cover art di-generate secara otomatis jika tidak ada metadata cover art di file audio

## Pengembangan

Untuk development dengan TypeScript:

```bash
# Install TypeScript (jika belum)
npm install -g typescript

# Compile TypeScript
tsc app.ts

# Watch mode
tsc app.ts --watch
```

## Lisensi

MIT License - Bebas digunakan untuk keperluan apapun.

