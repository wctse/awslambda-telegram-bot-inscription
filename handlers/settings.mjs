import { bot } from '../helpers/bot.mjs';
import { toProperCase } from '../helpers/commonUtils.mjs';
import { editItemInDynamoDB, editUserState, getItemFromDynamoDB, getWalletAddressByUserId } from '../helpers/dynamoDB.mjs';

const userTable = process.env.USER_TABLE_NAME;
const walletTable = process.env.WALLET_TABLE_NAME;

const gasSettings = ['auto', 'low', 'medium', 'high'];
const gasEmojis = ['⚪️', '🔴', '🟡', '🟢'];

export async function handleSettings(chatId) {
    const walletAddress = await getWalletAddressByUserId(chatId);
    const walletItem = await getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: walletAddress});
    const currentGasSetting = walletItem.walletSettings.gas;
    const currentGasEmoji = gasEmojis[gasSettings.indexOf(currentGasSetting)];

    const settingsMessage =
        `⚙️ *User Settings*\n` +
        `\n` +
        `Here you can change your settings for the bot.`;

    const settingsKeyboard = {
        inline_keyboard: [
            [
                { text: `${currentGasEmoji} Gas: ${toProperCase(currentGasSetting)}`, callback_data: `settings_gas_${currentGasSetting}` },
            ],
            [
                { text: `🔙 Back`, callback_data: `main_menu` }
            ]
        ]
    };
    
    await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() });
    await editUserState(chatId, "SETTINGS")
    await bot.sendMessage(chatId, settingsMessage, { reply_markup: settingsKeyboard, parse_mode: 'Markdown' });
}

export async function handleSettingsGas(chatId, settingsMessageId, currentGasSetting) {
    const newGasSetting = gasSettings[(gasSettings.indexOf(currentGasSetting) + 1) % gasSettings.length];
    const newGasEmoji = gasEmojis[gasSettings.indexOf(newGasSetting)];

    const walletAddress = await getWalletAddressByUserId(chatId);
    const walletItem = await getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: walletAddress});
    const walletSettings = walletItem.walletSettings;
    
    walletSettings.gas = newGasSetting;
    editItemInDynamoDB(walletTable, { userId: chatId, publicAddress: walletAddress }, { walletSettings: walletSettings });
    
    const newSettingsKeyboard = {
        inline_keyboard: [
            [
                { text: `${newGasEmoji} Gas: ${toProperCase(newGasSetting)}`, callback_data: `settings_gas_${newGasSetting}` },
            ],
            [
                { text: `🔙 Back`, callback_data: `main_menu` }
            ]
        ]
    };

    await bot.editMessageReplyMarkup(newSettingsKeyboard, { chat_id: chatId, message_id: settingsMessageId });
}