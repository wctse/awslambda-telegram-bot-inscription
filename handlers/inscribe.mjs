import { bot, cancelMainMenuKeyboard } from '../helpers/bot.mjs';
import { addItemToDynamoDB, getItemFromDynamoDB, getWalletAddressByUserId, getItemsByPartitionKeyFromDynamoDB, editUserState, editItemInDynamoDB  } from '../helpers/dynamoDB.mjs';
import { getCurrentGasPrice, getEthBalance } from '../helpers/ethers.mjs';

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;

// Step 1: Ask the user to choose the token standard to use, or have the user directly input the whole inscription data
export async function handleInscribeStep1(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);

    // TODO: Uncomment this when inscribe function is implemented
    // if (ethBalance == 0) {
    //     const mainMenuKeyboard = {
    //         inline_keyboard: [[
    //             { text: "️↩️ Main menu", callback_data: "main_menu" }
    //         ]]
    //     };
        
    //     await bot.sendMessage(chatId, "You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.", { reply_markup: mainMenuKeyboard });
    //     return;
    // }

    const step1Keyboard = {
        inline_keyboard: [[
            { text: "erc-20 (Ethscriptions)", callback_data: "inscribe_step1_erc20" }
        ],
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]
    };

    // If the user input the inscription data directly, the bot will jump to the review step
    const step1Message = "Please choose the token standard to use, or input the whole inscription data directly.";

    await addItemToDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress });
    await editUserState(chatId, 'INSCRIBE_STEP1');
    await bot.sendMessage(chatId, step1Message, { reply_markup: step1Keyboard });
}

// Step 2: Receive the token standard and ask the user to input the token ticker
export async function handleInscribeStep2(chatId, tokenStandard) {
    // Write the user input token standard to DynamoDB
    const publicAddress = await getWalletAddressByUserId(chatId);
    await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeTokenStandard: tokenStandard});
    
    // Prompt the user for a token ticker. Add more for future support of other token standards.
    const exampleTokens =
        tokenStandard === "erc-20" ? "eths, gwei" :
        "";

    const step2Message = 
        "✅ You have chosen " + tokenStandard + " as the token standard. \n" +
        "\n" +
        "👇 Please input the token ticker (e.g. " + exampleTokens + ")\n" +
        "\n" +
        "📖 [You can search for existing tokens for both standards on ierc20.com.](https://www.ierc20.com/)";

    await editUserState(chatId, 'INSCRIBE_STEP2');
    await bot.sendMessage(chatId, step2Message, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

// Step 3: Ask the user for the amount to mint
export async function handleInscribeStep3(chatId, tokenTicker) {
    // Write the user input token ticker to DynamoDB
    const publicAddress = await getWalletAddressByUserId(chatId);
    await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeTokenTicker: tokenTicker});

    const step3Message =
        "✅ You have chosen " + tokenTicker + ".\n" +
        "\n" +
        "👇 Please input the amount to mint. Do not exceed the minting limit.\n" +
        "\n" +
        "📖 [You can search for minting limits for both standards on ierc20.com.](https://www.ierc20.com/)";

    await editUserState(chatId, 'INSCRIBE_STEP3');
    await bot.sendMessage(chatId, step3Message, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

// Step 4: Review and confirm the inscription data
export async function handleInscribeStep4(chatId, amountToMint = null, inscriptionData = null) {
    const walletData = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId);
    const publicAddress = walletData[0].publicAddress;
    const chainName = walletData[0].chainName;

    let protocol, ticker;
    if (amountToMint) {
        // Case where the inscription data is generated from the user input in all previous steps
        const processData = await getItemFromDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress });
        protocol = processData.inscribeTokenStandard;
        ticker = processData.inscribeTokenTicker;

    } else if (inscriptionData) {
        // Case where the inscription data is directly provided
        try {
            const jsonPart = inscriptionData.substring(inscriptionData.indexOf(',') + 1);
            const jsonData = JSON.parse(jsonPart);
            protocol = jsonData.p; 
            ticker = jsonData.tick;
            amountToMint = jsonData.amt;

        } catch (error) {
            console.error('Error parsing inscription data in handleInscribeStep4:', error);
        }
    } else {
        console.error("No amountToMint or inscriptionData provided in handleInscribeStep4.");
    }

    const currentGasPrice = await getCurrentGasPrice(); // in gwei
    const estimatedGasCost = (0.000000001 * currentGasPrice * 21000).toPrecision(4);

    const step4Message = 
        "⌛ Please review the inscription information below. \n" +
        "\n" +
        "Wallet: `" + publicAddress + "`\n" +
        "Chain: " + chainName + "\n" +
        "Protocol: " + protocol + "\n" +
        "Ticker: " + ticker + "\n" +
        "Amount: " + amountToMint + "\n" +
        "\n" +
        "Current Gas Price " + currentGasPrice + "\n" +
        "Estimated Gas Cost: " + estimatedGasCost + " ETH\n" +
        "\n" +
        "☝️ Please confirm the information:";

    const step4Keyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "inscribe_step4_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await editUserState(chatId, 'INSCRIBE_STEP4');
    await bot.sendMessage(chatId, step4Message, { reply_markup: step4Keyboard, parse_mode: 'Markdown' });
}

// Step 5: Send the transaction to the blockchain
export async function handleInscribeStep5(chatId) {
    await bot.sendMessage(chatId, "This is step 5 of the inscribe process.");
}