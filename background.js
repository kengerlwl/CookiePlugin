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
