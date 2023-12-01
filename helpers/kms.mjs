// Encryption and decryption functions using AWS KMS
import AWS from 'aws-sdk';

const kms = new AWS.KMS();
const kmsKeyId = process.env.kmsKeyId;

export async function encrypt(plaintext) {
    if (typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a string');
    }
    
    const params = {
        KeyId: kmsKeyId,
        Plaintext: Buffer.from(plaintext)
    };
    
    try {
        const data = await kms.encrypt(params).promise();
        return data.CiphertextBlob;
    } catch (error) {
        console.error('Error encrypting data:', error);
        throw error;
    }
}


export async function decrypt(ciphertextBlob) {

    if (!Buffer.isBuffer(ciphertextBlob)) {
        throw new Error('Ciphertext must be a buffer');
    }

    const params = {
        CiphertextBlob: ciphertextBlob
    };
    
    try {
        const data = await kms.decrypt(params).promise();
        return data.Plaintext.toString();
    } catch (error) {
        console.error('Error decrypting data:', error);
        throw error;
    }
}