import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Initialize the S3 client for Liara Object Storage
export const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.LIARA_OBJECT_STORAGE_URL,
    credentials: {
        accessKeyId: process.env.LIARA_ACCESS_KEY,
        secretAccessKey: process.env.LIARA_SECRET_KEY,
    },
    forcePathStyle: true,  // Important for Liara's S3-compatible API
});

export async function uploadFile(fileName, fileBuffer) {
    const uploadParams = {
        Bucket: process.env.LIARA_BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    return `${process.env.LIARA_OBJECT_STORAGE_URL}/${process.env.LIARA_BUCKET_NAME}/${fileName}`;
}

export async function fetchFile(fileName) {
    const getObjectParams = {
        Bucket: process.env.LIARA_BUCKET_NAME,
        Key: fileName,
    };

    const response = await s3Client.send(new GetObjectCommand(getObjectParams));
    return response.Body;
}
