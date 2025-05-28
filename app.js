// server/app.js
import express from 'express';
import { initializeDatabase, getDb } from './db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR_RELATIVE = process.env.UPLOAD_DIR || './uploads';

// __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct absolute path for UPLOAD_DIR
const UPLOAD_DIR_ABSOLUTE = path.resolve(__dirname, UPLOAD_DIR_RELATIVE);

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR_ABSOLUTE)) {
    fs.mkdirSync(UPLOAD_DIR_ABSOLUTE, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR_ABSOLUTE); // Use absolute path for destination
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Middleware ---
// UPDATED: Configure CORS to specifically allow your Vercel frontend's domain
app.use(cors({
    origin: 'https://my-web-azure-eight.vercel.app', // Your Vercel frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from the 'public' directory (if backend was also serving frontend)
// Note: This is not strictly necessary if your frontend is on Vercel, but harmless.
app.use(express.static(path.join(__dirname, '../public')));

// Also serve uploaded files from the 'uploads' directory
app.use('/uploads', express.static(UPLOAD_DIR_ABSOLUTE));

// NEWLY ADDED: Serve static files from the 'source' directory for initial gallery images
// Assumes 'source' is at the same level as 'public' relative to 'server'
app.use('/source', express.static(path.join(__dirname, '../source')));


// --- API Endpoints ---

// GET all gallery items
app.get('/api/gallery', async (req, res) => {
    try {
        const db = getDb(); // Get the initialized database instance
        let query = `SELECT * FROM gallery_items`;
        let params = [];

        const items = await db.all(query, params);

        // Process items: parse categories JSON and group by dateGroup
        const processedItems = items.map(item => ({
            ...item,
            isFavorite: Boolean(item.isFavorite), // Convert 0/1 back to boolean
            categories: JSON.parse(item.categories || '[]') // Parse categories string to array
        }));

        // Group the data similar to your frontend's categorizedGalleryData structure
        const groupedData = {};
        processedItems.forEach(item => {
            if (!groupedData[item.dateGroup]) {
                groupedData[item.dateGroup] = {
                    id: item.dateGroup, // Using dateGroup as id for simplicity
                    date: item.dateGroup,
                    items: []
                };
            }
            groupedData[item.dateGroup].items.push(item);
        });

        // Convert groupedData object to a sorted array
        const sortedGroupedData = Object.values(groupedData).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(sortedGroupedData);
    } catch (error) {
        console.error('Error fetching gallery items:', error);
        res.status(500).json({ error: 'Failed to fetch gallery items' });
    }
});

// POST a new gallery item (for uploads)
app.post('/api/gallery', upload.single('mediaFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const db = getDb();
        // Extract alt, categories, dateGroup from form data
        const { alt, categories, dateGroup } = req.body;
        const type = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        const src = `/uploads/${req.file.filename}`; // Path relative to server root for public access
        const id = `uploaded-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; // Unique ID

        // Ensure categories are parsed correctly. Frontend sends as JSON string.
        let parsedCategories;
        try {
            parsedCategories = categories ? JSON.parse(categories) : [];
        } catch (e) {
            console.warn('Categories not valid JSON, defaulting to empty array:', categories);
            parsedCategories = [];
        }

        const stmt = await db.prepare(
            `INSERT INTO gallery_items (id, type, src, alt, poster, isFavorite, dateGroup, categories)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        await stmt.run(id, type, src, alt || req.file.originalname, null, 0, dateGroup, JSON.stringify(parsedCategories));
        await stmt.finalize();

        const newItem = {
            id, type, src, alt: alt || req.file.originalname, poster: null, isFavorite: false, dateGroup, categories: parsedCategories
        };

        res.status(201).json(newItem); // Return the newly created item
    } catch (error) {
        console.error('Error uploading item:', error);
        res.status(500).json({ error: 'Failed to upload item' });
    }
});

// PUT/PATCH toggle favorite status
app.put('/api/gallery/:id/favorite', async (req, res) => {
    try {
        const db = getDb();
        const itemId = req.params.id;

        const item = await db.get('SELECT isFavorite FROM gallery_items WHERE id = ?', itemId);

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const newFavoriteStatus = item.isFavorite === 0 ? 1 : 0;

        const stmt = await db.prepare('UPDATE gallery_items SET isFavorite = ? WHERE id = ?');
        await stmt.run(newFavoriteStatus, itemId);
        await stmt.finalize();

        res.json({ message: 'Favorite status updated', id: itemId, isFavorite: Boolean(newFavoriteStatus) });
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ error: 'Failed to toggle favorite status' });
    }
});

// DELETE a gallery item
app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const db = getDb();
        const itemId = req.params.id;

        const item = await db.get('SELECT src FROM gallery_items WHERE id = ?', itemId);

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const result = await db.run('DELETE FROM gallery_items WHERE id = ?', itemId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Item not found in database' });
        }

        if (item.src.startsWith('/uploads/')) {
            const filePath = path.join(UPLOAD_DIR_ABSOLUTE, path.basename(item.src));
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Failed to delete file ${filePath}:`, err);
                } else {
                    console.log(`Successfully deleted file: ${filePath}`);
                }
            });
        } else {
            console.log(`Item ${itemId} was not an uploaded file; skipping file deletion.`);
        }

        res.json({ message: 'Item deleted successfully', id: itemId });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});


// --- Start Server ---
async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Frontend served from http://localhost:${PORT}/gallery.html`);
    });
}

startServer();