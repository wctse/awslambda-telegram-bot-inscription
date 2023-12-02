import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();

export async function addItemToDynamoDB(tableName, item) {
    // Add an item to a DynamoDB table
    
    const params = {
        TableName: tableName,
        Item: item
    };

    try {
        await dynamodb.put(params).promise();
    } catch (error) {
        console.error('Error adding item to DynamoDB:', error);
        throw error;
    }
}

export async function getItemFromDynamoDB(tableName, key) {
    // Get an item from a DynamoDB table by its key

    const params = {
        TableName: tableName,
        Key: key
    };

    try {
        const data = await dynamodb.get(params).promise();
        return data.Item;
    } catch (error) {
        console.error('Error getting item from DynamoDB:', error);
        throw error;
    }
}

export async function checkPartitionValueExistsInDynamoDb(tableName, partitionKeyName, partitionKeyValue) {
    // Check if any items for a specific partition key value exists in a DynamoDB table
    // Used in this project to check if a user already has a wallet

    const params = {
        TableName: tableName,
        KeyConditionExpression: `${partitionKeyName} = :partitionkeyval`,
        ExpressionAttributeValues: {
            ':partitionkeyval': partitionKeyValue
        },
        Limit: 1 // Only retrieve one item to check existence to limit reading capacity unit usage
    };

    try {
        const data = await dynamodb.query(params).promise();
        return data.Items.length > 0;
    } catch (error) {
        console.error('Error checking items in DynamoDB:', error);
        throw error;
    }
}