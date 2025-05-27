// server/db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'database.sqlite'); // Correct path to database file

let db; // Global variable to hold the database connection

export async function initializeDatabase() {
    try {
        db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        // Enable foreign key constraints (good practice)
        await db.run('PRAGMA foreign_keys = ON;');

        console.log('Database connected successfully:', DB_PATH);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS gallery_items (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                src TEXT NOT NULL,
                alt TEXT,
                poster TEXT,
                isFavorite INTEGER DEFAULT 0, -- 0 for false, 1 for true
                dateGroup TEXT NOT NULL,
                categories TEXT -- Stored as comma-separated string
            );
        `);
        console.log('Table "gallery_items" checked/created.');

        // Function to check if a table is empty
        async function isTableEmpty(tableName) {
            const count = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`);
            return count.count === 0;
        }

        // --- Seeding initial data only if the table is empty ---
        if (await isTableEmpty('gallery_items')) {
            const initialMockGalleryItems = [
                // May 2025
                { id: 'img-001', type: 'image', src: '/source/Pics/identity_veeshna_01.jpg', alt: 'identity_veeshna_01.jpg', categories: ['library', 'nature', 'landscape'], isFavorite: 0, dateGroup: 'May 1, 2025' },
                { id: 'vid-001', type: 'video', src: 'https://www.w3schools.com/html/mov_bbb.mp4', poster: 'https://source.unsplash.com/random/800x600?forest,animals', alt: 'Big Buck Bunny short clip', categories: ['library', 'videos', 'animals'], isFavorite: 0, dateGroup: 'May 1, 2025' },
                { id: 'img-002', type: 'image', src: '/source/Pics/identity_veeshna_03.jpg', alt: 'identity_veeshna_03.jpg', categories: ['library', 'people', 'portraits'], isFavorite: 1, dateGroup: 'May 1, 2025' },
                { id: 'img-003', type: 'image', src: '/source/Pics/identity_veeshna_02.jpg', alt: 'identity_veeshna_02.jpg', categories: ['library', 'city'], isFavorite: 0, dateGroup: 'May 1, 2025' },
                { id: 'img-004', type: 'image', src: '/source/Pics/identity_renuka_02.jpg', alt: 'identity_renuka_02.jpg', categories: ['library', 'food'], isFavorite: 0, dateGroup: 'May 1, 2025' },
                // April 2025
                { id: 'img-005', type: 'image', src: '/source/Pics/identity_renuka_01.jpg', alt: 'identity_renuka_01.jpg', categories: ['library', 'nature', 'landscape', 'trips'], isFavorite: 0, dateGroup: 'April 15, 2025' },
                { id: 'img-006', type: 'image', src: 'https://source.unsplash.com/random/600x800?architecture,building', alt: 'Modern glass skyscraper exterior', categories: ['library', 'architecture', 'city'], isFavorite: 0, dateGroup: 'April 15, 2025' },
                { id: 'vid-002', type: 'video', src: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', poster: 'https://source.unsplash.com/random/800x600?dream,fantasy', alt: 'Animated sequence from Elephants Dream', categories: ['library', 'videos', 'animation'], isFavorite: 1, dateGroup: 'April 15, 2025' },
                { id: 'img-007', type: 'image', src: 'https://source.unsplash.com/random/800x800?animals,cat', alt: 'Cute fluffy cat relaxing', categories: ['library', 'animals', 'favorites'], isFavorite: 0, dateGroup: 'April 15, 2025' },
                { id: 'img-008', type: 'image', src: 'https://source.unsplash.com/random/1200x800?flower,garden', alt: 'Vibrant blooming flower in a garden', categories: ['library', 'nature', 'garden'], isFavorite: 0, dateGroup: 'April 15, 2025' },
                // March 2025
                { id: 'img-009', type: 'image', src: 'https://source.unsplash.com/random/800x600?beach,ocean', alt: 'Tropical beach with clear blue ocean', categories: ['library', 'nature', 'trips'], isFavorite: 0, dateGroup: 'March 5, 2025' },
                { id: 'img-010', type: 'image', src: 'https://source.unsplash.com/random/600x800?coffee,drink', alt: 'Steaming cup of coffee on a table', categories: ['library', 'everyday'], isFavorite: 0, dateGroup: 'March 5, 2025' },
                { id: 'vid-003', type: 'video', src: 'https://www.w3schools.com/html/movie.mp4', poster: 'https://source.unsplash.com/random/800x600?movie,cinema', alt: 'Generic movie trailer', categories: ['library', 'videos'], isFavorite: 0, dateGroup: 'March 5, 2025' },
                { id: 'img-011', type: 'image', src: 'https://source.unsplash.com/random/800x800?wildlife,bird', alt: 'Colorful bird perched on a branch', categories: ['library', 'animals'], isFavorite: 0, dateGroup: 'March 5, 2025' },
                // January 2025
                { id: 'img-012', type: 'image', src: '/source/Pics/identity_veeshna_04.jpg', alt: 'Cozy cabin in a snowy landscape', categories: ['library', 'nature', 'trips'], isFavorite: 0, dateGroup: 'January 20, 2025' },
                { id: 'img-013', type: 'image', src: 'https://source.unsplash.com/random/600x800?fireworks,celebration', alt: 'Fireworks exploding in night sky', categories: ['library', 'celebration', 'events'], isFavorite: 1, dateGroup: 'January 20, 2025' },
            ];

            const insertStmt = await db.prepare(
                `INSERT INTO gallery_items (id, type, src, alt, poster, isFavorite, dateGroup, categories)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            );

            for (const item of initialMockGalleryItems) {
                await insertStmt.run(
                    item.id,
                    item.type,
                    item.src,
                    item.alt,
                    item.poster || null,
                    item.isFavorite,
                    item.dateGroup,
                    JSON.stringify(item.categories) // Store categories as a JSON string
                );
            }
            await insertStmt.finalize();
            console.log('Initial mock data seeded into the database.');
        }

    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1); // Exit if database connection fails
    }
}

export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}