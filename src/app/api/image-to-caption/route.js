import fetch from 'node-fetch';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { sql } from '@/lib/db';
import { streamToBuffer } from '@/lib/utils';
import { s3Client } from '@/lib/s3';
import { consumeQueue } from '@/lib/rabbitmq';

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function processQueue() {
    try {
        console.log('Listening for image processing tasks...');
        await consumeQueue('image_processing', async (messageContent) => {
            const { requestId, imageUrl } = messageContent;
            try {
                console.log(`Received task for request ID: ${requestId}`);

                // Fetch the image from Liara Object Storage using S3 client
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
            } catch (error) {
                console.error(`Error processing request ID ${requestId}:`, error);
                await sql`
                    UPDATE requests
                    SET status = 'failed'
                    WHERE id = ${requestId}
                `;
            }
        });
    } catch (error) {
        console.error('Error in processing queue:', error);
    }
}

setInterval(processQueue, 10000);

processQueue();
