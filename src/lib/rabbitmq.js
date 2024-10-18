import amqplib from 'amqplib';

const CLOUDAMQP_URL = process.env.CLOUDAMQP_URL;
console.log(CLOUDAMQP_URL);

export async function publishToQueue(queue, message) {
    try {
        const connection = await amqplib.connect(CLOUDAMQP_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: true });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
        console.log(`Message sent to queue ${queue}:`, JSON.stringify(message, null, 2));
        await channel.close();
        await connection.close();
    } catch (error) {
        console.error('Error publishing to RabbitMQ queue:', error);
        throw error;
    }
}

export async function consumeQueue(queue, callback) {
    console.log(`Try to listen to queue: ${queue}`);
    try {
        const connection = await amqplib.connect(CLOUDAMQP_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: true });

        const message = await new Promise((resolve) => {
            channel.consume(queue, (msg) => {
                if (msg !== null) {
                    const messageContent = JSON.parse(msg.content.toString());
                    console.log(`Message received:`, JSON.stringify(messageContent, null, 2));
                    resolve({ msg, messageContent });
                } else {
                    resolve(null);
                }
            });
        });

        if (message) {
            await callback(message.messageContent);
            channel.ack(message.msg);
        }

        await channel.close();
        await connection.close();
        console.log('RabbitMQ connection closed.');
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
        throw error;
    }
}
