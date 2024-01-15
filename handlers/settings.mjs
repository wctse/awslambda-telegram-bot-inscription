import { bot } from '../helpers/bot.mjs';
import { toProperCase } from '../helpers/commonUtils.mjs';
import { editItemInDynamoDB, getItemFromDynamoDB } from '../helpers/dynamoDB.mjs';

const userTable = process.env.USER_TABLE_NAME;

const gasSettings = ['auto', 'low', 'medium', 'high'];
const gasEmojis = ['⚪️', '🔴', '🟡', '🟢'];

export async function handleSettings(chatId) {
    const settingsMessage =
        `⚙️ *User Settings*\n` +
        `\n` +
        `Here you can change your settings for the bot.`;

    const userSettings = (await getItemFromDynamoDB(userTable, { userId: chatId })).userSettings;
    const currentGasSetting = userSettings.gas;
    const currentGasEmoji = gasEmojis[gasSettings.indexOf(currentGasSetting)];

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
    
    await bot.sendMessage(chatId, settingsMessage, { reply_markup: settingsKeyboard, parse_mode: 'Markdown' });
}

export async function handleSettingsGas(chatId, settingsMessageId, currentGasSetting) {
    const newGasSetting = gasSettings[(gasSettings.indexOf(currentGasSetting) + 1) % gasSettings.length];
    const newGasEmoji = gasEmojis[gasSettings.indexOf(newGasSetting)];

    const userSettings = (await getItemFromDynamoDB(userTable, { userId: chatId })).userSettings;
    
    userSettings.gas = newGasSetting;
    editItemInDynamoDB(userTable, { userId: chatId }, { userSettings: userSettings });
    
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