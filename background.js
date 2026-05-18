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
    writeMode: 'download', // 'download' | 'fsa'，service worker 中 fsa 模式会回退到 download
    domains: [],
    fsaDirName: '',
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
            const text = cookiesToNetscape(cookies, domain);
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

// 通过 chrome.downloads 把内容写入下载目录
// 注意：MV3 service worker 不能用 URL.createObjectURL(Blob)（Blob 不支持），
// 改用 data URL 写入。
async function downloadAsFile(text, filename) {
    // 用 base64 编码避免特殊字符问题
    const base64 = base64EncodeUtf8(text);
    const dataUrl = `data:text/plain;base64,${base64}`;

    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            conflictAction: 'overwrite',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (typeof downloadId === 'undefined') {
                reject(new Error('下载未启动'));
            } else {
                resolve(downloadId);
            }
        });
    });
}

// UTF-8 安全的 base64 编码
function base64EncodeUtf8(str) {
    // 在 service worker 中没有 window，但 btoa 可用
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// 把 chrome.cookies.Cookie[] 转成 Netscape cookies.txt 格式
// 参考：https://curl.se/docs/http-cookies.html
function cookiesToNetscape(cookies, sourceDomain) {
    const header = [
        '# Netscape HTTP Cookie File',
        '# Generated by Cookie复制器',
        `# Source domain: ${sourceDomain || ''}`,
        `# ${new Date().toISOString()}`,
        ''
    ].join('\n');

    const lines = cookies.map(c => {
        // hostOnly=true 的 cookie 不应有前置点
        const domain = c.hostOnly
            ? c.domain
            : (c.domain.startsWith('.') ? c.domain : '.' + c.domain);
        const includeSubdomains = (!c.hostOnly && domain.startsWith('.')) ? 'TRUE' : 'FALSE';
        const path = c.path || '/';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expiration = c.expirationDate ? Math.floor(c.expirationDate) : 0;
        return [domain, includeSubdomains, path, secure, expiration, c.name, c.value].join('\t');
    });

    return header + lines.join('\n') + '\n';
}

// service worker 启动时立即检查一次 alarm（防止 manifest 升级导致 alarm 丢失）
refreshSyncAlarm();
