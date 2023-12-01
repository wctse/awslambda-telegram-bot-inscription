import { ethers } from 'ethers';

import { bot } from './bot.mjs';
import { encrypt, decrypt } from '../helpers/kms.mjs';

export async function handleCreateWallet(chatId, messageId) {
    
    await bot.sendMessage(chatId, "⏳ Creating wallet...");
    
    // Generate a new Ethereum wallet
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    const encryptedPrivateKey = await encrypt(privateKey);

    // Private key message
    const privateKeyMessage = 
        `⚠️ IMPORTANT: Your private key is confidential. Do not share it with anyone! ⚠️\n` + 
        `If you delete this message, you will not be shown the private key again.\n` +
        `\n` + 
        `Private Key:\n\`${privateKey}\``;

    const publicAddressMessage = 
        `✅ Your new Ethereum wallet has been created.\n` + 
        `\n` + 
        `Address: \`${address}\``;

    const publicAddressKeyboard = {
            inline_keyboard: [[
                { text: "Main menu", callback_data: "main_menu" }
            ]]
        };

    // TODO: Is there a way to let the user copy the private key without showing it in the chat? Maybe send a file with the private key? Or send a message with a button that copies the private key to the clipboard?
    await bot.sendMessage(chatId, privateKeyMessage,{ parse_mode: "Markdown" });
    await bot.sendMessage(chatId, publicAddressMessage, { parse_mode: "Markdown", reply_markup: publicAddressKeyboard });
}