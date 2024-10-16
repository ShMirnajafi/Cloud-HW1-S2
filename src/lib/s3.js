import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.LIARA_OBJECT_STORAGE_URL,
    credentials: {
        accessKeyId: process.env.LIARA_ACCESS_KEY,
        secretAccessKey: process.env.LIARA_SECRET_KEY,
    },
    forcePathStyle: true,
});

export async function fetchFile(fileName) {
    const getObjectParams = {
        Bucket: process.env.LIARA_BUCKET_NAME,
        Key: fileName,
    };

    const response = await s3Client.send(new GetObjectCommand(getObjectParams));
    return response.Body;
}
