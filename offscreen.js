// Offscreen document：service worker 中没有 URL.createObjectURL(Blob) 能力，
// 因此用这个隐藏的 DOM 页面来生成 blob: URL。
// 注意：offscreen document 没有 chrome.downloads 权限，所以下载调用必须留在 service worker 里。

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return false;

    switch (msg.action) {
        case 'ping': {
            // 让 service worker 确认 offscreen 已经加载并能响应消息
            sendResponse({ success: true });
            return false;
        }
        case 'createBlobUrl': {
            try {
                const blob = new Blob([msg.text], { type: msg.mimeType || 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                sendResponse({ success: true, url });
            } catch (err) {
                sendResponse({ success: false, error: err && err.message || String(err) });
            }
            return false;
        }
        case 'revokeBlobUrl': {
            try {
                URL.revokeObjectURL(msg.url);
                sendResponse({ success: true });
            } catch (err) {
                sendResponse({ success: false, error: err && err.message || String(err) });
            }
            return false;
        }
        default:
            return false;
    }
});
