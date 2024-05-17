export function isNumeric(str) {
    return !isNaN(parseFloat(str)) && isFinite(str);
}

/**
 * Rounds strings or numbers to a specified number of decimal places
 * 
 * @param {str | number} value The value to round
 * @param {number} decimals The number of decimal places to round to. If null, returns the value as a float
 * @returns {number} The rounded value
 */
export function round(value, decimals) {
    if (!decimals) {
        return parseFloat(value);
    }

    if (typeof value === 'string') {
        value = parseFloat(value);
    }

    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

export function toProperCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Chunks an array into smaller arrays of a specified size
 * Example usage:
 * const chunkedArray = chunkArray([1, 2, 3, 4, 5, 6, 7, 8], 3, true, '-');
 * console.log(chunkedArray); // [[1, 2, 3], [4, 5, 6], [7, 8, '-']]
 * 
 * @param {Array} array - The array to be chunked
 * @param {number} chunkSize - The size of the chunks
 * @param {boolean} padLastChunk - Whether to pad the last chunk with nulls to match the chunkSize
 * @param {any} pad - The value to pad the last chunk with
 * @returns {Array} - An array of sub-array (chunks) of the specific chunkSize
 */
export function chunkArray(array, chunkSize, padLastChunk = false, pad = null) {
    const chunkedArr = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);

        if (padLastChunk) {
          while (chunk.length < chunkSize) {
              chunk.push(pad);
          }
        }

        chunkedArr.push(chunk);
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