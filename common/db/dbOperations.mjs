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
export async function editItemInDb(tableName, key, updates, checkExists = false) {
    if (checkExists) {
        const item = await getItemFromDb(tableName, key);
        if (!item) {
            console.warn(`Function editItemInDb: Item with key ${JSON.stringify(key)} does not exist in table ${tableName}`);
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
export async function deleteItemFromDb(tableName, key) {
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
    const item = await getItemFromDb(tableName, key);

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
export async function getItemFromDb(tableName, key) {
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
export async function getItemsFromDb(tableName, partitionKeyName, partitionKeyValue, sortKeyName = null, sortKeyValue = null, indexName = null) {
    if (!partitionKeyName || !partitionKeyValue) {
        throw new Error('Function getItemsFromDb requires at least partition key parameters to be specified');
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
export async function checkItemsExistInDb(tableName, partitionKeyName, partitionKeyValue, sortKeyName = null, sortKeyValue = null, indexName = null) {
    return getItemsFromDb(tableName, partitionKeyName, partitionKeyValue, sortKeyName, sortKeyValue, indexName).then(items => items.length > 0);
}