import { neon } from '@neondatabase/serverless';

// Initialize the database connection
const sql = neon(process.env.DATABASE_URL);

/**
 * Ensure the `requests` table exists with the necessary fields.
 */
export async function ensureTableExists() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS requests (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                image_url TEXT,
                new_image_url TEXT,
                image_caption TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        console.log('Requests table is ready');
    } catch (error) {
        console.error('Error creating requests table:', error);
        throw error;
    }
}

export { sql };
