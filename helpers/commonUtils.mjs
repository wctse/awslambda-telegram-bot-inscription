export function isNumeric(str) {
    return !isNaN(parseFloat(str)) && isFinite(str);
}

export function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

export function toProperCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}