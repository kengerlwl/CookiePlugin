// Offscreen document：service worker 中没有 URL.createObjectURL(Blob) 能力，
// 必须通过这个隐藏的 DOM 页面来制作 blob: URL，再交给 service worker 调用 chrome.downloads。

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return;

    switch (msg.action) {
        case 'createBlobUrl': {
            try {
                const blob = new Blob([msg.text], { type: msg.mimeType || 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                sendResponse({ success: true, url });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
            return false; // 同步回包
        }
        case 'revokeBlobUrl': {
            try {
                URL.revokeObjectURL(msg.url);
                sendResponse({ success: true });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
            return false;
        }
        default:
            return false;
    }
});
