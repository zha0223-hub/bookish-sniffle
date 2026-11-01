const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🚀 PASTE YOUR COPIED SUPABASE STRINGS INSIDE THESE SINGLE QUOTES:
const SUPABASE_URL = 'https://yisoajinlzwygavbydjj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpc29hamlubHp3eWdhdmJ5ZGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0ODcyODIsImV4cCI6MjEwOTA2MzI4Mn0.lKlBRNVMzMBYlmj4n3S-zka5XzDh9LIDYyN56_J-bmQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const storage = multer.memoryStorage();
const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const upload = multer({ storage: storage, limits: { fileSize: MAX_SIZE } });

app.post('/api/upload', upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No video attached.' });
    
    const password = req.body.password || '';
    const filename = `banger-Date.now(){path.extname(req.file.originalname)}`;

    const { data: fileData, error: fileErr } = await supabase.storage
        .from('bangers')
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

    if (fileErr) return res.status(500).json({ error: 'Cloud storage upload failed.' });

    const metadata = Buffer.from(JSON.stringify({ password: password }));
    await supabase.storage.from('bangers').upload(`${filename}.json`, metadata, { contentType: 'application/json' });

    res.json({ message: 'Banger securely uploaded to the cloud!' });
});

app.get('/api/list', async (req, res) => {
    try {
        const { data: files, error } = await supabase.storage.from('bangers').list();
        if (error) return res.status(500).json({ error: 'Failed to read cloud storage.' });

        const videoFiles = files.filter(f => !f.name.endsWith('.json') && f.name !== '.emptyFolderPlaceholder');
        
        const bangers = videoFiles.map(file => {
            const { data } = supabase.storage.from('bangers').getPublicUrl(file.name);
            return {
                id: file.name,
                title: file.name.replace(path.extname(file.name), ''),
                url: data.publicUrl
            };
        });

        res.json(bangers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete', async (req, res) => {
    const { id, password } = req.body;

    const { data, error } = await supabase.storage.from('bangers').download(`${id}.json`);
    if (error) return res.status(404).json({ error: 'Metadata verification failed.' });

    const text = await data.text();
    const meta = JSON.parse(text);

    if (meta.password !== password) {
        return res.status(403).json({ error: 'Incorrect password!' });
    }

    await supabase.storage.from('bangers').remove([id, `${id}.json`]);
    res.json({ message: 'Banger destroyed from cloud!' });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large! Maximum limit is 100MB.' });
    }
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 Cloud Bangers backend running on port ${PORT}`);
});
