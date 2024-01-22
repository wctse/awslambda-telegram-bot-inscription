export function isNumeric(str) {
    return !isNaN(parseFloat(str)) && isFinite(str);
}

export function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

export function toProperCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Chunks an array into smaller arrays of a specified size
 * @param {Array} array - The array to be chunked
 * @param {number} chunkSize - The size of the chunks
 * @returns {Array} - An array of sub-array (chunks) of the specific chunkSize
 */
export function chunkArray(array, chunkSize) {
    const chunkedArr = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunkedArr.push(array.slice(i, i + chunkSize));
    }
    return chunkedArr;
}

/**
 * Update the nonce in a data string. Supply the latest timestamp as nonce and prevent nonce reuse.
 * Retains the order of properties in the JSON object.
 * 
 * @param {str} data Inscription data string. Format: <prefix><json>
 * @returns {str} Updated inscription data string
 */
export function updateNonce(data) {
    // Find the start of the JSON part
    const jsonStartIndex = data.indexOf('{');
    const jsonEndIndex = data.lastIndexOf('}');

    // Check for the presence of a JSON object and ensure there's only one
    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonStartIndex !== data.lastIndexOf('{')) {
        throw new Error("Invalid input: JSON object not found or multiple JSON objects detected");
    }

    // Extract the prefix and the JSON part
    const prefix = data.substring(0, jsonStartIndex);
    const jsonPart = data.substring(jsonStartIndex, jsonEndIndex + 1);

    // Parse the JSON part
    let jsonObj = JSON.parse(jsonPart);

    // Check if nonce exists
    if (!jsonObj.hasOwnProperty('nonce')) {
        throw new Error("Nonce not found in the original data");
    }

    // Generate a new nonce (simulated nanosecond timestamp)
    let newNonce = Date.now() * 1000000;

    // Update nonce while maintaining the order of properties
    let updatedJsonObj = {};
    Object.keys(jsonObj).forEach(key => {
        updatedJsonObj[key] = key === 'nonce' ? newNonce.toString() : jsonObj[key];
    });

    let modifiedJsonString = JSON.stringify(updatedJsonObj);

    // Reattach the prefix
    return prefix + modifiedJsonString;
}