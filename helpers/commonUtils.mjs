export function isNumeric(str) {
    return !isNaN(parseFloat(str)) && isFinite(str);
}

export function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}