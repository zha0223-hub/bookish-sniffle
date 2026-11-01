const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve the frontend files directly from the main directory
app.use(express.static(__dirname));

const uploadDir = path.join(__dirname, 'bangers_storage');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'bangers_storage/');
    },
    filename: (req, file, cb) => {
        cb(null, `banger-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const MAX_SIZE = 100 * 1024 * 1024; 
const upload = multer({ 
    storage: storage,
    limits: { fileSize: MAX_SIZE }
});

app.use('/stream', express.static(uploadDir));

const getMetaPath = (videoFilename) => {
    return path.join(uploadDir, videoFilename + '.json');
};

app.post('/api/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video attached.' });
    }
    const password = req.body.password || '';
    const metadata = { password: password };
    
    fs.writeFile(getMetaPath(req.file.filename), JSON.stringify(metadata), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save video password.' });
        res.json({ message: 'Banger uploaded successfully!' });
    });
});

app.get('/api/list', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read directory' });
        
        const videoFiles = files.filter(file => !file.startsWith('.') && !file.endsWith('.json'));
        
        const bangers = videoFiles.map(file => {
            return {
                id: file,
                title: file.replace(path.extname(file), ''),
                url: `/stream/${file}`
            };
        });
        res.json(bangers);
    });
});

app.post('/api/rename', (req, res) => {
    const { id, newTitle, password } = req.body;
    if (!id || !newTitle) return res.status(400).json({ error: 'Missing information.' });
    
    const metaPath = getMetaPath(id);
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Metadata not found.' });
    
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.password !== password) return res.status(403).json({ error: 'Incorrect password!' });
    
    const ext = path.extname(id);
    const cleanTitle = newTitle.replace(/[^a-z0-9 _-]/gi, '_').toLowerCase();
    const newFilename = `${cleanTitle}-${Date.now()}${ext}`;
    
    fs.rename(path.join(uploadDir, id), path.join(uploadDir, newFilename), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to rename file.' });
        fs.unlinkSync(metaPath);
        fs.writeFileSync(getMetaPath(newFilename), JSON.stringify({ password: password }));
        res.json({ message: 'Banger renamed!' });
    });
});

app.post('/api/delete', (req, res) => {
    const { id, password } = req.body;
    const metaPath = getMetaPath(id);
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Metadata not found.' });
    
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.password !== password) return res.status(403).json({ error: 'Incorrect password!' });
    
    try {
        fs.unlinkSync(path.join(uploadDir, id));
        fs.unlinkSync(metaPath);
        res.json({ message: 'Banger destroyed!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete.' });
    }
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large! Maximum limit is 100MB.' });
    }
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 Bangers backend running on port ${PORT}`);
});
