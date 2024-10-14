import { Client } from 'pg';
import amqp from 'amqplib';
import axios from 'axios';
import AWS from 'aws-sdk';

const { DATABASE_URL, CLOUDAMQP_URL, LIARA_OBJECT_STORAGE_URL, LIARA_ACCESS_KEY, LIARA_SECRET_KEY } = process.env;

const dbClient = new Client({
    connectionString: DATABASE_URL,
});

dbClient.connect();

export async function POST() {
    const connection = await amqp.connect(CLOUDAMQP_URL);
    const channel = await connection.createChannel();

    const queue = 'image_capture_queue';

    channel.consume(queue, async (msg) => {
        const imageId = msg.content.toString();

        // Step 1: Fetch image from object storage
        const imageUrl = `${LIARA_OBJECT_STORAGE_URL}/${imageId}`;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        // Step 2: Send image to captioning API
        const captionResponse = await axios.post('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', imageResponse.data, {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        });

        const caption = captionResponse.data.caption;

        // Step 3: Store caption in DB
        await dbClient.query(
            'INSERT INTO Caption (imageId, caption, status) VALUES ($1, $2, $3)',
            [imageId, caption, 'ready']
        );

        channel.ack(msg);
    });

    return new Response('Service is running', { status: 200 });
}
