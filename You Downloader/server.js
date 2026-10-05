const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Deteksi OS: pakai binary lokal di Windows, pakai command sistem di Linux (Render)
const isWindows = process.platform === 'win32';
const YTDLP_CMD = isWindows ? path.join(__dirname, 'bin', 'yt-dlp.exe') : 'yt-dlp';
const FFMPEG_ARGS = isWindows ? ['--ffmpeg-location', path.join(__dirname, 'bin')] : [];

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

// Endpoint untuk ambil info video
app.post('/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL tidak boleh kosong' });

  const command = `"${YTDLP_CMD}" -j "${url}"`;

  exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', stderr);
      return res.status(500).json({ error: 'Gagal mengambil info video' });
    }
    try {
      const data = JSON.parse(stdout);
      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        uploader: data.uploader,
      });
    } catch (parseError) {
      res.status(500).json({ error: 'Gagal memproses data video' });
    }
  });
});

// Endpoint download dengan progress real-time (Server-Sent Events)
app.get('/download-progress', (req, res) => {
  const { url, format, videoQuality, audioQuality } = req.query;
  if (!url) { res.status(400).end(); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const isAudio = format === 'mp3';
  const uniqueId = Date.now();
  const outputTemplate = path.join(DOWNLOAD_DIR, `%(title)s_${uniqueId}.%(ext)s`);

  let formatArgs = [];

  if (isAudio) {
    const quality = audioQuality || '0';
    formatArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', quality];
  } else {
    const heightFilter = (videoQuality && videoQuality !== 'best') ? `[height<=${videoQuality}]` : '';
    // Prioritas: video mp4 + audio m4a (paling kompatibel), fallback ke kombinasi terbaik apa pun
    const selector = `bestvideo${heightFilter}[ext=mp4]+bestaudio[ext=m4a]/bestvideo${heightFilter}+bestaudio/best`;
    formatArgs = ['-f', selector, '--merge-output-format', 'mp4'];
  }

  const args = [
    ...formatArgs,
    ...FFMPEG_ARGS,
    '--newline',
    '-o', outputTemplate,
    '--print', 'after_move:filepath',
    url
  ];

  const ytdlp = spawn(YTDLP_CMD, args);
  let finalFilePath = '';

  ytdlp.stdout.on('data', (chunk) => {
    chunk.toString().split('\n').forEach((line) => {
      line = line.trim();
      if (!line) return;

      const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        sendEvent('progress', { percent: parseFloat(progressMatch[1]), stage: 'downloading' });
        return;
      }
      if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
        sendEvent('progress', { percent: 100, stage: 'processing' });
        return;
      }
      if (line.includes(uniqueId.toString()) && (line.endsWith('.mp4') || line.endsWith('.mp3'))) {
        finalFilePath = line;
      }
    });
  });

  ytdlp.stderr.on('data', (chunk) => console.error('yt-dlp stderr:', chunk.toString()));

  ytdlp.on('close', (code) => {
    if (code !== 0 || !finalFilePath || !fs.existsSync(finalFilePath)) {
      sendEvent('ytdlp-error', { message: 'Gagal memproses video. Coba lagi.' });
      res.end();
      return;
    }
    sendEvent('done', { filename: path.basename(finalFilePath) });
    res.end();
  });

  req.on('close', () => ytdlp.kill());
});

// Endpoint untuk mengambil file yang sudah selesai diproses
app.get('/get-file', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Nama file tidak ada' });

  const safeName = path.basename(name);
  const filePath = path.join(DOWNLOAD_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File tidak ditemukan' });
  }
  res.download(filePath);
});

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});