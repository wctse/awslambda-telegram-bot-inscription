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
export async function updateNonce(data) {
    // Find the start and end of JSON 
    const jsonStartIndex = data.indexOf('{');
    const jsonEndIndex = data.lastIndexOf('}');
  
    // Validate JSON format
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error("Invalid input: JSON object not found.");
    }
  
    // Extract JSON part
    const prefix = data.substring(0, jsonStartIndex);
    const jsonPart = data.substring(jsonStartIndex, jsonEndIndex + 1);
  
    // Check if nonce field exists
    let hasNonce = false;
  
    // Proceed with nonce update
    const newNonce = Date.now() * 1000000;
  
    let jsonObj = JSON.parse(jsonPart, (key, value) => {
      if (key === 'nonce') {
        hasNonce = true;
        return newNonce.toString();
      }
      return value;
    });
  
    if (!hasNonce) {
      throw new Error("Nonce field not found in JSON"); 
    }
  
    const newData = prefix + JSON.stringify(jsonObj);
    return newData;
}