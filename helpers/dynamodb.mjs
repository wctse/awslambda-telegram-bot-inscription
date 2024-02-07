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
export async function editItemInDynamoDB(tableName, key, updates, checkExists = false) {
    if (checkExists) {
        const item = await getItemFromDynamoDB(tableName, key);
        if (!item) {
            console.warn(`Function editItemInDynamoDB: Item with key ${JSON.stringify(key)} does not exist in table ${tableName}`);
            return;
        }
    }

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

// Delete an item from a DynamoDB table
export async function deleteItemFromDynamoDB(tableName, key) {
    const params = {
        TableName: tableName,
        Key: key
    };

    try {
        await dynamoDB.delete(params).promise();
    } catch (error) {
        console.error('Error deleting item from DynamoDB:', error);
        throw error;
    }
}

// Get an item from a DynamoDB table by its key
export async function getItemFromDynamoDB(tableName, key) {
    const params = {
        TableName: tableName,
        Key: key
    };

    try {
        const data = await dynamoDB.get(params).promise();
        return data.Item;
    } catch (error) {
        console.error(`Error getting item from DynamoDB ${tableName} with key ${key}:`, error);
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

// Update the user state in the user table
export async function editUserState(userId, userState) {
    const userTable = process.env.USER_TABLE_NAME;

    const key = {
        userId: userId
    };

    const updates = {
        userState: userState
    };

    await editItemInDynamoDB(userTable, key, updates);
}

// Get the user state from the user table
export async function getUserState(userId) {
    const userTable = process.env.USER_TABLE_NAME;
    const userItems = await getItemsByPartitionKeyFromDynamoDB(userTable, `userId`, userId);

    if (userItems.length === 0) {
        return null;
    }

    return userItems[0].userState;
}

// Get the wallet address for a specific user ID
export async function getWalletAddressByUserId(chatId) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const walletItems = await getItemsByPartitionKeyFromDynamoDB(walletTable, `userId`, chatId);

    if (walletItems.length === 0) {
        return null;
    }

    return walletItems[0].publicAddress;
}

export async function updateWalletLastActiveAt(userId, publicAddress) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const key = {
        userId: userId,
        publicAddress: publicAddress
    };

    const updates = {
        lastActiveAt: Date.now()
    };

    await editItemInDynamoDB(walletTable, key, updates);
}