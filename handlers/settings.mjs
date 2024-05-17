import { bot } from '../common/bot.mjs';
// import { toProperCase } from '../common/utils.mjs';
// import { editItemInDb, getItemFromDb } from '../common/db/dbOperations.mjs';
// import { getWalletAddress, getWalletAddressByUserId } from '../common/db/walletDb.mjs';
// import { editUserState, getCurrentChain } from '../common/db/userDb.mjs';

// const walletTable = process.env.WALLET_TABLE_NAME;

// const gasSettings = ['auto', 'low', 'medium', 'high'];
// const gasEmojis = ['⚪️', '🔴', '🟡', '🟢'];

export async function handleSettings(chatId) {
    await bot.sendMessage(chatId, "Coming soon!");
    // const chainName = await getCurrentChain(chatId);
    // const walletAddress = await getWalletAddress(chatId, chainName);

    // const walletItem = await getItemFromDb(walletTable, { userId: chatId, publicAddress: walletAddress});
    // const currentGasSetting = walletItem.walletSettings.gas;
    // const currentGasEmoji = gasEmojis[gasSettings.indexOf(currentGasSetting)];

    // const settingsMessage =
    //     `⚙️ *User Settings*\n` +
    //     `\n` +
    //     `Here you can change your settings for the bot.`;

    // const settingsKeyboard = {
    //     inline_keyboard: [
    //         [
    //             { text: `${currentGasEmoji} Gas: ${toProperCase(currentGasSetting)}`, callback_data: `settings_gas_${currentGasSetting}` },
    //         ],
    //         [
    //             { text: `🔙 Back`, callback_data: `main_menu` }
    //         ]
    //     ]
    // };
    
    // await editUserState(chatId, "SETTINGS");
    // await bot.sendMessage(chatId, settingsMessage, { reply_markup: settingsKeyboard, parse_mode: 'Markdown' });
}

export async function handleSettingsGas(chatId, settingsMessageId, currentGasSetting) {

//     const walletAddress = await getWalletAddress(chatId, await getCurrentChain(chatId));
//     const walletItem = await getItemFromDb(walletTable, { userId: chatId, publicAddress: walletAddress});
//     const walletSettings = walletItem.walletSettings;
    
//     const newGasSetting = gasSettings[(gasSettings.indexOf(currentGasSetting) + 1) % gasSettings.length];
//     const newGasEmoji = gasEmojis[gasSettings.indexOf(newGasSetting)];
//     walletSettings.gas = newGasSetting;
    
//     editItemInDb(walletTable, { userId: chatId, publicAddress: walletAddress }, { walletSettings: walletSettings });
    
//     const newSettingsKeyboard = {
//         inline_keyboard: [
//             [
//                 { text: `${newGasEmoji} Gas: ${toProperCase(newGasSetting)}`, callback_data: `settings_gas_${newGasSetting}` },
//             ],
//             [
//                 { text: `🔙 Back`, callback_data: `main_menu` }
//             ]
//         ]
//     };

//     await bot.editMessageReplyMarkup(newSettingsKeyboard, { chat_id: chatId, message_id: settingsMessageId });
}