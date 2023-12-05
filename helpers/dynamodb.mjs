import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Add an item to a DynamoDB table
export async function addItemToDynamoDB(tableName, item) {
    const params = {
        TableName: tableName,
        Item: item
    };

    try {
        await dynamoDB.put(params).promise();
    } catch (error) {
        console.error('Error adding item to DynamoDB:', error);
        throw error;
    }
}

// Edit specified attributes of an item in a DynamoDB table
export async function editItemInDynamoDB(tableName, key, updates) {
    const updateExpression = "set " + Object.keys(updates).map((key) => `${key} = :${key}`).join(', ');
    const expressionAttributeValues = Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [`:${key}`, value])
    );

    const params = {
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
    };

    try {
        await dynamoDB.update(params).promise();
    } catch (error) {
        console.error('Error editing item in DynamoDB:', error);
        throw error;
    }
}

// Get all items for a specific partition key value from a DynamoDB table
export async function getItemsByPartitionKeyFromDynamoDB(tableName, partitionKeyName, partitionKeyValue) {
    const params = {
        TableName: tableName,
        KeyConditionExpression: `${partitionKeyName} = :partitionkeyval`,
        ExpressionAttributeValues: {
            ':partitionkeyval': partitionKeyValue
        }
    };

    try {
        const data = await dynamoDB.query(params).promise();
        return data.Items;
    } catch (error) {
        console.error('Error getting items from DynamoDB:', error);
        throw error;
    }
}

// Check if any items for a specific partition key value exists in a DynamoDB table
// Used in this project to check if a user already has a wallet
export async function checkPartitionValueExistsInDynamoDB(tableName, partitionKeyName, partitionKeyValue) {
    const params = {
        TableName: tableName,
        KeyConditionExpression: `${partitionKeyName} = :partitionkeyval`,
        ExpressionAttributeValues: {
            ':partitionkeyval': partitionKeyValue
        },
        Limit: 1 // Only retrieve one item to check existence to limit reading capacity unit usage
    };

    try {
        const data = await dynamoDB.query(params).promise();
        return data.Items.length > 0;
    } catch (error) {
        console.error('Error checking items in DynamoDB:', error);
        throw error;
    }
}

// TODO: Function for updating the lastActiveAt attribute in the user table

// // Get an item from a DynamoDB table by its key
// // Not used in this project as of now
// export async function getSpecificItemFromDynamoDB(tableName, key) {
//     const params = {
//         TableName: tableName,
//         Key: key
//     };

//     try {
//         const data = await dynamoDB.get(params).promise();
//         return data.Item;
//     } catch (error) {
//         console.error('Error getting item from DynamoDB:', error);
//         throw error;
//     }
// }