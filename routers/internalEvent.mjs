import { handleMultiMintComplete } from "../handlers/multiMint.mjs";

/**
 * Route internal events from other lambdas to the appropriate handler
 * 
 * @param {string} source
 * @param {string} message
 * @param {object} customData 
 */
export async function routeInternalEvent(source, message, customData) {
    console.info('Internal event received: ', source, message, customData);
    
    if (source === 'multiMintLambda' && message === 'multiMintComplete') {
        const { userId, publicAddress, inscriptionData, updatedTimesMinted } = customData;
        await handleMultiMintComplete(userId, publicAddress, inscriptionData, updatedTimesMinted);
    }
}