// Content Script - 在网页中运行的脚本

// 避免重复注入
if (!window.cookieCopierInjected) {
    window.cookieCopierInjected = true;

    console.log('Cookie复制器内容脚本已加载');

    // 创建一个浮动按钮（可选功能）
    let floatingButton = null;
    let isFloatingButtonVisible = false;

    // 创建浮动复制按钮
    function createFloatingButton() {
        if (floatingButton) return;

        floatingButton = document.createElement('div');
        floatingButton.id = 'cookie-copier-floating-btn';
        floatingButton.innerHTML = '🍪';
        floatingButton.title = '点击复制Cookie';

        // 设置样式
        Object.assign(floatingButton.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '999999',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            userSelect: 'none'
        });

        // 添加悬停效果
        floatingButton.addEventListener('mouseenter', function() {
            floatingButton.style.transform = 'scale(1.1)';
            floatingButton.style.backgroundColor = '#5a6fd8';
        });

        floatingButton.addEventListener('mouseleave', function() {
            floatingButton.style.transform = 'scale(1)';
            floatingButton.style.backgroundColor = '#667eea';
        });

        // 点击事件
        floatingButton.addEventListener('click', function() {
            copyCurrentPageCookies();
        });

        document.body.appendChild(floatingButton);
    }

    // 移除浮动按钮
    function removeFloatingButton() {
        if (floatingButton && floatingButton.parentNode) {
            floatingButton.parentNode.removeChild(floatingButton);
            floatingButton = null;
        }
    }

    // 复制当前页面的Cookie
    async function copyCurrentPageCookies() {
        try {
            // 获取当前页面的所有Cookie
            const cookies = document.cookie;

            if (!cookies) {
                showNotification('当前页面没有Cookie', 'info');
                return;
            }

            // 复制到剪贴板
            await navigator.clipboard.writeText(cookies);
            showNotification('Cookie已复制到剪贴板！', 'success');

        } catch (error) {
            console.error('复制Cookie失败:', error);

            // 降级方案：创建临时文本框
            try {
                const textArea = document.createElement('textarea');
                textArea.value = document.cookie;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) {
                    showNotification('Cookie已复制到剪贴板！', 'success');
                } else {
                    showNotification('复制失败，请手动复制', 'error');
                }
            } catch (fallbackError) {
                console.error('降级复制也失败:', fallbackError);
                showNotification('复制失败：' + fallbackError.message, 'error');
            }
        }
    }

    // 显示通知
    function showNotification(message, type = 'info') {
        // 移除现有通知
        const existingNotification = document.getElementById('cookie-copier-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'cookie-copier-notification';
        notification.textContent = message;

        // 设置样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '1000000',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            maxWidth: '300px',
            textAlign: 'center'
        });

        // 根据类型设置颜色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#d4edda';
                notification.style.color = '#155724';
                notification.style.border = '1px solid #c3e6cb';
                break;
            case 'error':
                notification.style.backgroundColor = '#f8d7da';
                notification.style.color = '#721c24';
                notification.style.border = '1px solid #f5c6cb';
                break;
            case 'info':
            default:
                notification.style.backgroundColor = '#d1ecf1';
                notification.style.color = '#0c5460';
                notification.style.border = '1px solid #bee5eb';
                break;
        }

        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => {
                    if (notification && notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    // 监听来自popup或background的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('Content script收到消息:', request);

        switch (request.action) {
            case 'getCookies':
                sendResponse({
                    success: true,
                    cookies: document.cookie,
                    domain: window.location.hostname
                });
                break;

            case 'showFloatingButton':
                if (!isFloatingButtonVisible) {
                    createFloatingButton();
                    isFloatingButtonVisible = true;
                }
                sendResponse({ success: true });
                break;

            case 'hideFloatingButton':
                if (isFloatingButtonVisible) {
                    removeFloatingButton();
                    isFloatingButtonVisible = false;
                }
                sendResponse({ success: true });
                break;

            case 'copyPageCookies':
                copyCurrentPageCookies();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: '未知的操作' });
        }
    });

    // 监听键盘快捷键（可选）
    document.addEventListener('keydown', function(event) {
        // Ctrl+Shift+C 复制Cookie
        if (event.ctrlKey && event.shiftKey && event.code === 'KeyC') {
            event.preventDefault();
            copyCurrentPageCookies();
        }

        // Ctrl+Shift+F 切换浮动按钮
        if (event.ctrlKey && event.shiftKey && event.code === 'KeyF') {
            event.preventDefault();
            if (isFloatingButtonVisible) {
                removeFloatingButton();
                isFloatingButtonVisible = false;
                showNotification('浮动按钮已隐藏', 'info');
            } else {
                createFloatingButton();
                isFloatingButtonVisible = true;
                showNotification('浮动按钮已显示', 'info');
            }
        }
    });

    // 页面加载完成后的初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Cookie复制器：页面加载完成');
        });
    } else {
        console.log('Cookie复制器：页面已经加载完成');
    }

    // 监听页面卸载
    window.addEventListener('beforeunload', function() {
        removeFloatingButton();
    });

    // 工具函数：解析Cookie字符串
    function parseCookies(cookieString) {
        const cookies = {};
        if (cookieString) {
            cookieString.split(';').forEach(function(cookie) {
                const parts = cookie.trim().split('=');
                if (parts.length === 2) {
                    cookies[parts[0]] = decodeURIComponent(parts[1]);
                }
            });
        }
        return cookies;
    }

    // 工具函数：格式化Cookie对象
    function formatCookiesObject(cookies) {
        return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ');
    }

    console.log('Cookie复制器内容脚本初始化完成');
}
