const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
export function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}
export function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
}
export function hasJwtAccessToken() {
    const token = getAccessToken();
    return token.split('.').length === 3;
}
export function clearAuthTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}
