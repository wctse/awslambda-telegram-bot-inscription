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

export async function deleteAttributesExceptKeys(tableName, key) {
    const item = await getItemFromDynamoDB(tableName, key);

    if (!item) {
        console.warn(`Function deleteAttributesExceptKeys: Item with key ${JSON.stringify(key)} does not exist in table ${tableName}`);
        return;
    }

    const attributesToRemove = Object.keys(item).filter(attr => !Object.keys(key).includes(attr));

    if (attributesToRemove.length === 0) {
        return;
    }

    const updateExpression = "REMOVE " + attributesToRemove.join(', ');

    const params = {
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression
    };

    await dynamoDB.update(params).promise();
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

/**
 * Get all items for a specific partition key value from a DynamoDB table
 *  
 * @param {string} tableName The name of the DynamoDB table
 * @param {string} partitionKeyName The name of the partition key
 * @param {string} partitionKeyValue The value of the partition key
 * @param {string} sortKeyName The name of the sort key, null if not using a sort key
 * @param {string} sortKeyValue The value of the sort key, null if not using a sort key
 * @param {string} indexName The name of the secondary index to use, null if not using a secondary index
 * @returns {Array} An array of items from the table
*/ 
export async function getItemsFromDynamoDb(tableName, partitionKeyName, partitionKeyValue, sortKeyName = null, sortKeyValue = null, indexName = null) {
    if (!partitionKeyName || !partitionKeyValue) {
        throw new Error('Function getItemsFromDynamoDb requires at least partition key parameters to be specified');
    }

    const params = {
        TableName: tableName,
        KeyConditionExpression: `${partitionKeyName} = :partitionkeyval`,
        ExpressionAttributeValues: {
            ':partitionkeyval': partitionKeyValue
        }
    };

    if (sortKeyName && sortKeyValue) {
        params.KeyConditionExpression += ` AND ${sortKeyName} = :sortkeyval`;
        params.ExpressionAttributeValues[':sortkeyval'] = sortKeyValue;
    }

    if (indexName) {
        params.IndexName = indexName;
    }

    try {
        const data = await dynamoDB.query(params).promise();
        return data.Items;
    } catch (error) {
        console.error('Error getting items from DynamoDB:', error);
        throw error;
    }
}

/**
 * Check if an item exists in a DynamoDB table.
 * 
 * @param {string} tableName The name of the DynamoDB table
 * @param {string} partitionKeyName The name of the partition key
 * @param {string} partitionKeyValue The value of the partition key
 * @param {string} sortKeyName The name of the sort key, null if not using a sort key
 * @param {string} sortKeyValue The value of the sort key, null if not using a sort key
 * @param {string} indexName The name of the secondary index to use, null if not using a secondary index
 * @returns {boolean} Whether any item associated to the given keys and index exists in the table
 */
export async function checkItemsExistInDynamoDb(tableName, partitionKeyName, partitionKeyValue, sortKeyName = null, sortKeyValue = null, indexName = null) {
    return getItemsFromDynamoDb(tableName, partitionKeyName, partitionKeyValue, sortKeyName, sortKeyValue, indexName).then(items => items.length > 0);
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
    const userItems = await getItemsFromDynamoDb(userTable, `userId`, userId);

    if (userItems.length === 0) {
        return null;
    }

    return userItems[0].userState;
}

// Get the wallet address for a specific user ID
export async function getWalletAddressByUserId(chatId) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const walletItems = await getItemsFromDynamoDb(walletTable, `userId`, chatId);

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