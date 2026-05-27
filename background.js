// Chrome扩展后台脚本 (Service Worker)

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('Cookie复制器插件已安装');

    if (details.reason === 'install') {
        // 首次安装
        console.log('首次安装Cookie复制器');

        // 可以在这里设置默认配置或显示欢迎页面
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        }).catch(() => {
            // 如果没有welcome.html文件，忽略错误
            console.log('欢迎页面不存在，跳过');
        });
    } else if (details.reason === 'update') {
        // 插件更新
        console.log('Cookie复制器已更新到版本:', chrome.runtime.getManifest().version);
    }

    // 启动/重置定时同步 alarm
    refreshSyncAlarm();
});

// service worker 唤醒时（浏览器启动等）也要确保 alarm 存在
chrome.runtime.onStartup.addListener(() => {
    refreshSyncAlarm();
});

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // 发给 offscreen 的消息由 offscreen.js 处理，service worker 忽略
    if (request && request.target === 'offscreen') return false;

    console.log('收到消息:', request);

    switch (request.action) {
        case 'getCookies':
            handleGetCookies(request, sendResponse);
            return true; // 保持消息通道开放以进行异步响应

        case 'copyToClipboard':
            handleCopyToClipboard(request, sendResponse);
            return true;

        case 'getTabInfo':
            handleGetTabInfo(sendResponse);
            return true;

        case 'syncConfigUpdated':
            refreshSyncAlarm().then(() => {
                sendResponse({ success: true });
            }).catch(err => {
                sendResponse({ success: false, error: err.message });
            });
            return true;

        case 'runSyncNow':
            runCookieSync({ trigger: 'manual' }).then(result => {
                sendResponse({ success: true, count: result.count });
            }).catch(err => {
                sendResponse({ success: false, error: err.message });
            });
            return true;

        default:
            console.log('未知的消息类型:', request.action);
            sendResponse({ success: false, error: '未知的消息类型' });
    }
});

// 处理获取Cookie的请求
async function handleGetCookies(request, sendResponse) {
    try {
        const { domain, url } = request;
        let cookies = [];

        if (domain) {
            // 根据域名获取Cookie
            cookies = await chrome.cookies.getAll({ domain: domain });
        } else if (url) {
            // 根据URL获取Cookie
            cookies = await chrome.cookies.getAll({ url: url });
        } else {
            // 获取当前活动标签页的Cookie
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                cookies = await chrome.cookies.getAll({ url: tab.url });
            }
        }

        sendResponse({
            success: true,
            cookies: cookies,
            count: cookies.length
        });
    } catch (error) {
        console.error('获取Cookie失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 处理复制到剪贴板的请求
async function handleCopyToClipboard(request, sendResponse) {
    try {
        const { text } = request;

        // 在service worker中，我们不能直接访问剪贴板
        // 需要通过content script或popup来处理
        sendResponse({
            success: false,
            error: '请在popup中进行复制操作'
        });
    } catch (error) {
        console.error('复制失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 处理获取标签页信息的请求
async function handleGetTabInfo(sendResponse) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab) {
            const url = new URL(tab.url);
            sendResponse({
                success: true,
                tab: {
                    id: tab.id,
                    url: tab.url,
                    title: tab.title,
                    domain: url.hostname,
                    protocol: url.protocol
                }
            });
        } else {
            sendResponse({
                success: false,
                error: '无法获取当前标签页信息'
            });
        }
    } catch (error) {
        console.error('获取标签页信息失败:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // 当标签页完成加载时
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('标签页加载完成:', tab.url);

        // 可以在这里执行一些后台任务
        // 比如预加载Cookie信息等
    }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(function(activeInfo) {
    console.log('标签页已激活:', activeInfo.tabId);

    // 可以在这里更新插件状态
});

// 处理插件图标点击事件（如果需要）
chrome.action.onClicked.addListener(function(tab) {
    // 这个事件只有在manifest中没有定义default_popup时才会触发
    console.log('插件图标被点击');
});

// 错误处理
chrome.runtime.onSuspend.addListener(function() {
    console.log('后台脚本即将被挂起');
});

// 监听来自其他扩展的外部消息（可选）
chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse) {
    console.log('收到外部消息:', request, '来自:', sender);

    // 可以在这里处理来自其他扩展的消息
    sendResponse({ success: false, error: '不支持外部消息' });
});

// 工具函数：格式化Cookie
function formatCookieString(cookies) {
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// 工具函数：验证域名
function isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
}

// 工具函数：验证URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

console.log('Cookie复制器后台脚本已加载');

// ============================================================
// 定时同步功能
// ============================================================
const SYNC_ALARM_NAME = 'cookieSyncAlarm';
const DEFAULT_SYNC_CONFIG = {
    enabled: false,
    intervalMinutes: 5,
    domains: [],
    lastSyncTime: 0,
    lastSyncStatus: ''
};

async function loadSyncConfig() {
    const { syncConfig } = await chrome.storage.local.get('syncConfig');
    return Object.assign({}, DEFAULT_SYNC_CONFIG, syncConfig || {});
}

async function saveSyncConfig(patch) {
    const cur = await loadSyncConfig();
    const next = Object.assign({}, cur, patch);
    await chrome.storage.local.set({ syncConfig: next });
    return next;
}

// 根据当前配置创建/更新/删除 alarm
async function refreshSyncAlarm() {
    const cfg = await loadSyncConfig();
    await chrome.alarms.clear(SYNC_ALARM_NAME);

    if (!cfg.enabled || !cfg.domains || cfg.domains.length === 0) {
        console.log('[Sync] alarm 已停止：未启用或无域名');
        return;
    }

    // chrome.alarms 的最小周期为 1 分钟
    const minutes = Math.max(1, parseInt(cfg.intervalMinutes, 10) || 5);
    chrome.alarms.create(SYNC_ALARM_NAME, {
        delayInMinutes: minutes,
        periodInMinutes: minutes
    });
    console.log(`[Sync] alarm 已设置，每 ${minutes} 分钟同步一次`);
}

// alarm 触发
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;
    try {
        const result = await runCookieSync({ trigger: 'alarm' });
        console.log(`[Sync] 定时同步完成：${result.count} 个域名`);
    } catch (err) {
        console.error('[Sync] 定时同步失败：', err);
    }
});

// 实际执行同步：遍历域名 → 取 cookies → 转 Netscape → 下载
async function runCookieSync({ trigger } = {}) {
    const cfg = await loadSyncConfig();

    if (!cfg.domains || cfg.domains.length === 0) {
        await saveSyncConfig({
            lastSyncStatus: '跳过：未配置域名',
            lastSyncTime: Date.now()
        });
        return { count: 0 };
    }

    const errors = [];
    let success = 0;

    for (const domain of cfg.domains) {
        try {
            const cookies = await chrome.cookies.getAll({ domain });
            const text = cookiesToHeader(cookies);
            // 写到 ~/Downloads/cookies/cookies-<domain>.txt，覆盖式更新
            const filename = `cookies/cookies-${sanitizeFilename(domain)}.txt`;
            await downloadAsFile(text, filename);
            success++;
        } catch (err) {
            console.error(`[Sync] 域名 ${domain} 同步失败：`, err);
            errors.push(`${domain}: ${err.message}`);
        }
    }

    const status = errors.length === 0
        ? `成功（${trigger || 'manual'}）：${success} 个域名`
        : `部分失败：成功 ${success}，失败 ${errors.length}（${errors[0]}）`;

    await saveSyncConfig({
        lastSyncTime: Date.now(),
        lastSyncStatus: status
    });

    return { count: success, errors };
}

// MV3 service worker 不支持 URL.createObjectURL(Blob)（chromium bug 1224027），
// 因此通过一个 offscreen document 来代为制造 blob: URL，再由 service worker
// 调用 chrome.downloads.download 完成下载——这是官方推荐的做法。

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
    if (!(await hasOffscreenDocument())) {
        if (!creatingOffscreen) {
            creatingOffscreen = chrome.offscreen.createDocument({
                url: OFFSCREEN_DOCUMENT_PATH,
                reasons: ['BLOBS'],
                justification: '生成 blob: URL 用于把 cookie 写入下载文件'
            }).finally(() => {
                creatingOffscreen = null;
            });
        }
        await creatingOffscreen;
    }
    // 即使 createDocument 已 resolve，offscreen 内部脚本也可能尚未完成 listener 注册；
    // 用 ping 轮询直到拿到响应，避免后续 sendMessage 落空导致下载用到不完整的 blob URL。
    await waitOffscreenReady();
}

async function waitOffscreenReady(maxAttempts = 30, intervalMs = 50) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const resp = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ target: 'offscreen', action: 'ping' }, (r) => {
                    // 没有 listener 时 lastError 会被设置；忽略并继续重试
                    void chrome.runtime.lastError;
                    resolve(r);
                });
            });
            if (resp && resp.success) return;
        } catch (_) { /* ignore */ }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    // 兜底：仍然继续（不抛错），让后续逻辑自己暴露问题
    console.warn('[Sync] offscreen ping 超时，仍继续后续流程');
}

async function hasOffscreenDocument() {
    if (!chrome.runtime.getContexts) return false;
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts && contexts.length > 0;
}

function sendOffscreen(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ target: 'offscreen', ...payload }, (resp) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (!resp) {
                reject(new Error('offscreen 无响应'));
            } else if (!resp.success) {
                reject(new Error(resp.error || 'offscreen 处理失败'));
            } else {
                resolve(resp);
            }
        });
    });
}

// 跨上下文 blob URL 在 service worker 调 chrome.downloads.download 时，
// Chrome 会忽略 filename 字段、退回 UUID 命名。可靠的解法是用 onDeterminingFilename
// 钩子，在文件即将落盘的最后一刻强制改写文件名。
//
// 由于 onDeterminingFilename 触发时机早于 download() 的 callback 返回 downloadId，
// 这里用一个 FIFO 队列：每次 download() 之前先把目标 filename 推入队列，
// 监听器触发时按入队顺序消费——配合 syncDownloads 串行调度，保证一一对应。
const filenameQueue = [];
let determiningListenerRegistered = false;
// 串行锁：保证 download() 调用与 onDeterminingFilename 一一对应，避免并发错乱
let downloadChain = Promise.resolve();

function registerDeterminingFilenameOnce() {
    if (determiningListenerRegistered) return;
    determiningListenerRegistered = true;
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        if (filenameQueue.length > 0) {
            const desired = filenameQueue.shift();
            suggest({ filename: desired, conflictAction: 'overwrite' });
        } else {
            // 不是本插件发起的下载（用户其它行为），放行
            suggest();
        }
    });
}

// 由 offscreen 负责生成 blob URL（offscreen 没有 chrome.downloads 权限），
// service worker 自己调用 chrome.downloads.download 完成下载，最后让 offscreen 撤销 URL。
function downloadAsFile(text, filename) {
    // 串行排队，避免多个下载并发时 onDeterminingFilename 与 filenameQueue 错位
    const job = downloadChain.then(() => doDownload(text, filename));
    downloadChain = job.catch(() => { /* swallow，不要让链断 */ });
    return job;
}

async function doDownload(text, filename) {
    registerDeterminingFilenameOnce();
    await ensureOffscreenDocument();

    const { url: blobUrl } = await sendOffscreen({
        action: 'createBlobUrl',
        text,
        mimeType: 'text/plain;charset=utf-8'
    });

    // 必须在调 download() 之前 push，确保 onDeterminingFilename 能拿到
    filenameQueue.push(filename);

    let downloadId;
    try {
        downloadId = await new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: blobUrl,
                filename: filename, // 备份字段，listener 优先
                conflictAction: 'overwrite',
                saveAs: false
            }, (id) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (typeof id === 'undefined') {
                    reject(new Error('下载未启动'));
                } else {
                    resolve(id);
                }
            });
        });

        await waitDownloadComplete(downloadId);
        return downloadId;
    } catch (err) {
        // 调用失败时，要把队列里的占位清掉，否则会错位污染下一个下载
        const idx = filenameQueue.indexOf(filename);
        if (idx >= 0) filenameQueue.splice(idx, 1);
        throw err;
    } finally {
        sendOffscreen({ action: 'revokeBlobUrl', url: blobUrl }).catch(() => { /* ignore */ });
    }
}

// 等待下载到达终态（complete/interrupted）
function waitDownloadComplete(downloadId) {
    return new Promise((resolve) => {
        const onChanged = (delta) => {
            if (delta.id !== downloadId) return;
            if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
                chrome.downloads.onChanged.removeListener(onChanged);
                resolve();
            }
        };
        chrome.downloads.onChanged.addListener(onChanged);
        // 兜底：5 秒后释放
        setTimeout(() => {
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve();
        }, 5000);
    });
}

function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// 把 chrome.cookies.Cookie[] 拼成 HTTP Cookie 请求头格式：
// name1=value1; name2=value2; ...
// 直接复制即可粘到 curl -H "Cookie: ..." 或 Postman 的 Cookie 字段。
function cookiesToHeader(cookies) {
    return cookies
        .map(c => `${c.name}=${c.value || ''}`)
        .join('; ');
}

// service worker 启动时立即检查一次 alarm（防止 manifest 升级导致 alarm 丢失）
refreshSyncAlarm();
