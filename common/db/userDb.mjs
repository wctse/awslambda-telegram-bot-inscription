import { editItemInDb, getItemsFromDb } from './dbOperations.mjs';

const userTable = process.env.USER_TABLE_NAME;

export async function getUserItem(userId) {
    const userItems = await getItemsFromDb(userTable, `userId`, userId);

    if (userItems.length === 0) {
        return null;
    }

    return userItems[0];
}

export async function getUserState(userId) {
    const userItems = await getItemsFromDb(userTable, `userId`, userId);

    if (userItems.length === 0) {
        return null;
    }

    return userItems[0].userState;
}

export async function getCurrentChain(userId) {
    const userItems = await getItemsFromDb(userTable, `userId`, userId);

    if (userItems.length === 0) {
        return null;
    }

    return userItems[0].currentChain;
}

export async function editUserState(userId, userState) {
    const key = {
        userId: userId
    };

    const updates = {
        userState: userState
    };

    await editItemInDb(userTable, key, updates);
}
