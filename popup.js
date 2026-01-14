// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async function() {
    const copyButton = document.getElementById('copy-cookies');
    const copyFormattedButton = document.getElementById('copy-formatted');
    const viewButton = document.getElementById('view-cookies');
    const clearButton = document.getElementById('clear-cookies');
    const setCookieButton = document.getElementById('set-cookie');
    const setCookieForm = document.getElementById('set-cookie-form');
    const saveCookieButton = document.getElementById('save-cookie');
    const cancelCookieButton = document.getElementById('cancel-cookie');
    const statusDiv = document.getElementById('status');
    const domainSpan = document.getElementById('current-domain');
    const countSpan = document.getElementById('count');
    const cookieDetails = document.getElementById('cookie-details');
    const cookieText = document.getElementById('cookie-text');
    const cookieKeys = document.getElementById('cookie-keys');
    const cookieKeysList = document.getElementById('cookie-keys-list');

    let currentCookies = [];
    let currentDomain = '';

    // 获取当前标签页信息
    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // 获取当前域名的所有Cookie
    async function getCookies() {
        try {
            const tab = await getCurrentTab();
            const url = new URL(tab.url);
            currentDomain = url.hostname;

            // 更新域名显示
            domainSpan.textContent = currentDomain;

            // 获取当前域名的所有Cookie
            const cookies = await chrome.cookies.getAll({ domain: currentDomain });

            // 也获取子域名的Cookie
            const allCookies = await chrome.cookies.getAll({ url: tab.url });

            // 合并并去重
            const cookieMap = new Map();
            [...cookies, ...allCookies].forEach(cookie => {
                cookieMap.set(cookie.name, cookie);
            });

            currentCookies = Array.from(cookieMap.values());
            countSpan.textContent = currentCookies.length;

            return currentCookies;
        } catch (error) {
            console.error('获取Cookie失败:', error);
            showStatus('获取Cookie失败: ' + error.message, 'error');
            return [];
        }
    }

    // 显示状态信息
    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.classList.remove('hidden');

        // 3秒后自动隐藏
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }

    // 复制文本到剪贴板
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('复制失败:', error);
            // 降级方案
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (fallbackError) {
                console.error('降级复制也失败:', fallbackError);
                return false;
            }
        }
    }

    // 格式化Cookie为字符串
    function formatCookiesAsString(cookies) {
        return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    }

    // 格式化Cookie为详细信息
    function formatCookiesDetailed(cookies) {
        return cookies.map(cookie => {
            const details = [
                `名称: ${cookie.name}`,
                `值: ${cookie.value}`,
                `域名: ${cookie.domain}`,
                `路径: ${cookie.path}`,
                `过期时间: ${cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : '会话Cookie'}`,
                `安全: ${cookie.secure ? '是' : '否'}`,
                `HttpOnly: ${cookie.httpOnly ? '是' : '否'}`,
                `SameSite: ${cookie.sameSite || '未设置'}`
            ];
            return details.join('\n');
        }).join('\n\n' + '='.repeat(50) + '\n\n');
    }

    // 显示Cookie key列表
    function displayCookieKeys(cookies) {
        cookieKeysList.innerHTML = '';

        cookies.forEach(cookie => {
            const keyItem = document.createElement('div');
            keyItem.className = 'cookie-key-item';
            keyItem.innerHTML = `
                <span class="cookie-key-name">${cookie.name}</span>
                <span class="cookie-key-hint">点击复制</span>
            `;

            // 添加点击事件来复制key:value
            keyItem.addEventListener('click', async function() {
                const keyValue = `${cookie.name}=${cookie.value}`;
                const success = await copyToClipboard(keyValue);

                if (success) {
                    showStatus(`已复制: ${cookie.name}`, 'success');
                    // 临时改变提示文字
                    const hint = keyItem.querySelector('.cookie-key-hint');
                    const originalText = hint.textContent;
                    hint.textContent = '已复制!';
                    hint.style.opacity = '1';
                    setTimeout(() => {
                        hint.textContent = originalText;
                        hint.style.opacity = '';
                    }, 1000);
                } else {
                    showStatus('复制失败', 'error');
                }
            });

            cookieKeysList.appendChild(keyItem);
        });
    }

    // 复制所有Cookie（简单格式）
    copyButton.addEventListener('click', async function() {
        const cookies = await getCookies();
        if (cookies.length === 0) {
            showStatus('当前页面没有Cookie', 'info');
            return;
        }

        const cookieString = formatCookiesAsString(cookies);
        const success = await copyToClipboard(cookieString);

        if (success) {
            showStatus(`已复制 ${cookies.length} 个Cookie到剪贴板`, 'success');
        } else {
            showStatus('复制失败，请手动复制', 'error');
            // 显示Cookie内容供手动复制
            cookieText.value = cookieString;
            cookieDetails.classList.remove('hidden');
        }
    });

    // 复制格式化的Cookie
    copyFormattedButton.addEventListener('click', async function() {
        const cookies = await getCookies();
        if (cookies.length === 0) {
            showStatus('当前页面没有Cookie', 'info');
            return;
        }

        const formattedCookies = formatCookiesDetailed(cookies);
        const success = await copyToClipboard(formattedCookies);

        if (success) {
            showStatus(`已复制 ${cookies.length} 个Cookie的详细信息`, 'success');
        } else {
            showStatus('复制失败，请手动复制', 'error');
            cookieText.value = formattedCookies;
            cookieDetails.classList.remove('hidden');
        }
    });

    // 查看Cookie详情
    viewButton.addEventListener('click', async function() {
        const cookies = await getCookies();
        if (cookies.length === 0) {
            showStatus('当前页面没有Cookie', 'info');
            return;
        }

        if (cookieKeys.classList.contains('hidden')) {
            // 显示cookie key列表
            displayCookieKeys(cookies);
            cookieKeys.classList.remove('hidden');
            viewButton.textContent = '隐藏列表';
        } else {
            // 隐藏cookie key列表
            cookieKeys.classList.add('hidden');
            viewButton.textContent = '查看列表';
        }
    });

    // 清空所有Cookie
    clearButton.addEventListener('click', async function() {
        const cookies = await getCookies();
        if (cookies.length === 0) {
            showStatus('当前页面没有Cookie', 'info');
            return;
        }

        // 确认是否清空
        const confirmClear = confirm(`确定要清空 ${currentDomain} 域名下的 ${cookies.length} 个Cookie吗？\n\n此操作不可恢复！`);
        if (!confirmClear) {
            return;
        }

        try {
            const tab = await getCurrentTab();
            let deletedCount = 0;

            // 删除所有Cookie
            for (const cookie of cookies) {
                // 构建Cookie的URL
                const protocol = cookie.secure ? 'https://' : 'http://';
                const cookieUrl = protocol + (cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain) + cookie.path;

                await chrome.cookies.remove({
                    url: cookieUrl,
                    name: cookie.name
                });
                deletedCount++;
            }

            showStatus(`已成功清空 ${deletedCount} 个Cookie`, 'success');

            // 更新Cookie数量显示
            countSpan.textContent = '0';
            currentCookies = [];

            // 如果Cookie详情正在显示，清空它
            if (!cookieKeys.classList.contains('hidden')) {
                cookieKeysList.innerHTML = '';
                cookieKeys.classList.add('hidden');
                viewButton.textContent = '查看列表';
            }

        } catch (error) {
            console.error('清空Cookie失败:', error);
            showStatus('清空Cookie失败: ' + error.message, 'error');
        }
    });

    // 设置Cookie按钮 - 显示/隐藏表单
    setCookieButton.addEventListener('click', function() {
        if (setCookieForm.classList.contains('hidden')) {
            setCookieForm.classList.remove('hidden');
            setCookieButton.textContent = '隐藏表单';
        } else {
            setCookieForm.classList.add('hidden');
            setCookieButton.textContent = '添加Cookie';
            clearCookieForm();
        }
    });

    // 取消按钮
    cancelCookieButton.addEventListener('click', function() {
        setCookieForm.classList.add('hidden');
        setCookieButton.textContent = '➕ 设置Cookie';
        clearCookieForm();
    });

    // 保存Cookie按钮
    saveCookieButton.addEventListener('click', async function() {
        const name = document.getElementById('cookie-name').value.trim();
        const value = document.getElementById('cookie-value').value.trim();
        const path = document.getElementById('cookie-path').value.trim() || '/';
        const expiryDays = parseInt(document.getElementById('cookie-expiry').value) || 30;
        const secure = document.getElementById('cookie-secure').checked;
        const httpOnly = document.getElementById('cookie-httponly').checked;
        const sameSite = document.getElementById('cookie-samesite').value;

        // 验证必填字段
        if (!name) {
            showStatus('Cookie名称不能为空', 'error');
            return;
        }
        if (!value) {
            showStatus('Cookie值不能为空', 'error');
            return;
        }

        try {
            const tab = await getCurrentTab();
            const url = new URL(tab.url);

            // 计算过期时间
            const expirationDate = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);

            // 如果选择了SameSite=None，必须设置Secure
            const finalSecure = sameSite === 'no_restriction' ? true : secure;

            const cookieDetails = {
                url: tab.url,
                name: name,
                value: value,
                path: path,
                secure: finalSecure,
                httpOnly: httpOnly,
                sameSite: sameSite,
                expirationDate: expirationDate
            };

            await chrome.cookies.set(cookieDetails);

            showStatus(`Cookie "${name}" 设置成功`, 'success');

            // 清空表单并隐藏
            clearCookieForm();
            setCookieForm.classList.add('hidden');
            setCookieButton.textContent = '添加Cookie';

            // 刷新Cookie列表
            await getCookies();

            // 如果Cookie详情正在显示，刷新它
            if (!cookieKeys.classList.contains('hidden')) {
                displayCookieKeys(currentCookies);
            }

        } catch (error) {
            console.error('设置Cookie失败:', error);
            showStatus('设置Cookie失败: ' + error.message, 'error');
        }
    });

    // 清空表单
    function clearCookieForm() {
        document.getElementById('cookie-name').value = '';
        document.getElementById('cookie-value').value = '';
        document.getElementById('cookie-path').value = '/';
        document.getElementById('cookie-expiry').value = '30';
        document.getElementById('cookie-secure').checked = false;
        document.getElementById('cookie-httponly').checked = false;
        document.getElementById('cookie-samesite').value = 'lax';
    }

    // 页面加载时自动获取Cookie信息
    await getCookies();
});

// 监听标签页变化，更新Cookie信息
chrome.tabs.onActivated.addListener(async function(activeInfo) {
    // 如果popup还在显示，重新获取Cookie
    if (document.visibilityState === 'visible') {
        const domainSpan = document.getElementById('current-domain');
        const countSpan = document.getElementById('count');

        if (domainSpan && countSpan) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const url = new URL(tab.url);
                const domain = url.hostname;

                domainSpan.textContent = domain;

                const cookies = await chrome.cookies.getAll({ domain: domain });
                countSpan.textContent = cookies.length;
            } catch (error) {
                console.error('更新Cookie信息失败:', error);
            }
        }
    }
});