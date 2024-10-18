import fetch from 'node-fetch';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { sql } from '@/lib/db';
import { streamToBuffer } from '@/lib/utils';
import { s3Client } from '@/lib/s3';
import amqplib from 'amqplib';

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const CLOUDAMQP_URL = process.env.CLOUDAMQP_URL;

async function processQueue() {
    let connection = null;
    try {
        console.log('Listening for image processing tasks...');

        connection = await amqplib.connect(CLOUDAMQP_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue('image_processing', { durable: true });

        await channel.consume('image_processing', async (msg) => {
            if (msg !== null) {
                const messageContent = JSON.parse(msg.content.toString());
                const { requestId, imageUrl } = messageContent;

                try {
                    console.log(`Received task for request ID: ${requestId}`);

                    const getObjectParams = {
                        Bucket: process.env.LIARA_BUCKET_NAME,
                        Key: imageUrl.split('/').pop(),
                    };

                    const image = await s3Client.send(new GetObjectCommand(getObjectParams));
                    const imageBuffer = await streamToBuffer(image.Body);

                    console.log(`Image fetched for request ID: ${requestId}`);

                    const base64Image = imageBuffer.toString('base64');

                    const response = await fetch(HUGGINGFACE_API_URL, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            inputs: base64Image,
                        }),
                    });

                    const captionData = await response.json();

                    console.log('Hugging Face API response:', JSON.stringify(captionData, null, 2));

                    const caption = captionData[0]?.generated_text;

                    if (!caption) {
                        throw new Error('Failed to generate caption');
                    }

                    console.log(`Generated caption for request ID: ${requestId}: ${caption}`);

                    await sql`
                        UPDATE requests
                        SET status        = 'ready',
                            image_caption = ${caption}
                        WHERE id = ${requestId}
                    `;

                    console.log(`Request ID: ${requestId} updated to ready with caption.`);

                    // Acknowledge the message once processing is complete
                    channel.ack(msg);
                } catch (error) {
                    console.error(`Error processing request ID ${requestId}:`, error);
                    await sql`
                        UPDATE requests
                        SET status = 'failed'
                        WHERE id = ${requestId}
                    `;

                    // Reject the message to indicate failure
                    channel.nack(msg);
                }
            }
        });
    } catch (error) {
        console.error('Error in processing queue:', error);
    } finally {
        if (connection) {
            setTimeout(() => connection.close(), 500);
        }
    }
}

setInterval(processQueue, 10000);

processQueue();
