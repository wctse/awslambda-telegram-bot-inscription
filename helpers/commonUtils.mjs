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