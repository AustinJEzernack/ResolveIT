import apiClient from './api';
function unwrapListPayload(payload) {
    if (Array.isArray(payload))
        return payload;
    if (Array.isArray(payload?.data))
        return payload.data;
    if (Array.isArray(payload?.results))
        return payload.results;
    if (Array.isArray(payload?.data?.results))
        return payload.data.results;
    return [];
}
export async function fetchWorkbenches() {
    const res = await apiClient.get('/workbenches/');
    return unwrapListPayload(res.data);
}
export async function fetchTickets(workbenchId) {
    const res = await apiClient.get(`/tickets/?workbench=${workbenchId}&limit=20`);
    return unwrapListPayload(res.data);
}
export async function fetchChannels() {
    const res = await apiClient.get('/messaging/channels/');
    return res.data.data?.channels ?? [];
}
export async function fetchMessages(channelId) {
    const res = await apiClient.get(`/messaging/channels/${channelId}/messages/?limit=50`);
    const msgs = res.data.data?.messages ?? [];
    return msgs.reverse(); // API returns newest-first; display oldest-first
}
export async function postMessage(channelId, content) {
    const res = await apiClient.post(`/messaging/channels/${channelId}/messages/`, { content });
    return res.data.data?.message;
}
export async function createChannel(name, memberIds) {
    const res = await apiClient.post('/messaging/channels/', {
        name,
        type: 'PUBLIC',
        member_ids: memberIds,
    });
    return res.data.data?.channel;
}
export function connectWebSocket(token, onMessage) {
    const wsUrl = `ws://localhost:8000/ws/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (raw) => {
        try {
            onMessage(JSON.parse(raw.data));
        }
        catch {
            // ignore malformed frames
        }
    };
    return ws;
}
export function joinChannel(ws, channelId) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'channel.join', data: { channel_id: channelId } }));
    }
}
export function leaveChannel(ws, channelId) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'channel.leave', data: { channel_id: channelId } }));
    }
}
