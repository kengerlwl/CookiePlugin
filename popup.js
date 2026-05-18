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

    // 判断 tab.url 是否是普通网页（http/https），用于决定能否取 Cookie/域名
    function isWebUrl(u) {
        if (!u) return false;
        return /^https?:\/\//i.test(u);
    }

    // 获取当前域名的所有Cookie
    async function getCookies() {
        try {
            const tab = await getCurrentTab();

            if (!tab || !isWebUrl(tab.url)) {
                // 非网页（chrome://、扩展页、空白页等）
                currentDomain = '';
                currentCookies = [];
                domainSpan.textContent = '非网页';
                countSpan.textContent = '0';
                return [];
            }

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

    // ============================================================
    // 定时同步功能
    // ============================================================
    const togglePanelBtn = document.getElementById('toggle-sync-panel');
    const syncPanel = document.getElementById('sync-panel');
    const syncEnabledChk = document.getElementById('sync-enabled');
    const syncIntervalSel = document.getElementById('sync-interval');
    const syncWriteModeSel = document.getElementById('sync-write-mode');
    const fsaDirRow = document.getElementById('fsa-dir-row');
    const fsaDirName = document.getElementById('fsa-dir-name');
    const fsaPickDirBtn = document.getElementById('fsa-pick-dir');
    const syncDomainInput = document.getElementById('sync-domain-input');
    const syncAddDomainBtn = document.getElementById('sync-add-domain');
    const syncAddCurrentBtn = document.getElementById('sync-add-current');
    const syncDomainList = document.getElementById('sync-domain-list');
    const syncLastTime = document.getElementById('sync-last-time');
    const syncLastStatus = document.getElementById('sync-last-status');
    const syncSaveBtn = document.getElementById('sync-save');
    const syncRunNowBtn = document.getElementById('sync-run-now');

    // popup 内持有的 FSA 目录句柄（仅 popup 打开期间有效）
    let fsaDirHandle = null;

    const DEFAULT_SYNC_CONFIG = {
        enabled: false,
        intervalMinutes: 5,
        writeMode: 'download',
        domains: [],
        fsaDirName: '',
        lastSyncTime: 0,
        lastSyncStatus: ''
    };

    function ensureStorageAvailable() {
        if (!chrome || !chrome.storage || !chrome.storage.local) {
            throw new Error('storage 权限不可用，请在 chrome://extensions 重新加载本扩展');
        }
    }

    async function loadSyncConfig() {
        ensureStorageAvailable();
        const { syncConfig } = await chrome.storage.local.get('syncConfig');
        return Object.assign({}, DEFAULT_SYNC_CONFIG, syncConfig || {});
    }

    async function saveSyncConfig(config) {
        ensureStorageAvailable();
        await chrome.storage.local.set({ syncConfig: config });
    }

    function renderDomainList(domains) {
        syncDomainList.innerHTML = '';
        domains.forEach((d, idx) => {
            const item = document.createElement('div');
            item.className = 'sync-domain-item';
            item.innerHTML = `
                <span class="domain-text" title="${d}">${d}</span>
                <button class="domain-remove" data-idx="${idx}" title="移除">×</button>
            `;
            item.querySelector('.domain-remove').addEventListener('click', async () => {
                const cfg = await loadSyncConfig();
                cfg.domains.splice(idx, 1);
                await saveSyncConfig(cfg);
                renderDomainList(cfg.domains);
                showStatus('已移除域名', 'info');
            });
            syncDomainList.appendChild(item);
        });
    }

    function formatTime(ts) {
        if (!ts) return '从未';
        return new Date(ts).toLocaleString();
    }

    function refreshFsaDirRow(mode, dirNameText) {
        if (mode === 'fsa') {
            fsaDirRow.classList.remove('hidden');
            fsaDirName.textContent = dirNameText || '未选择';
        } else {
            fsaDirRow.classList.add('hidden');
        }
    }

    async function refreshSyncUI() {
        const cfg = await loadSyncConfig();
        syncEnabledChk.checked = cfg.enabled;
        syncIntervalSel.value = String(cfg.intervalMinutes);
        syncWriteModeSel.value = cfg.writeMode;
        refreshFsaDirRow(cfg.writeMode, cfg.fsaDirName);
        renderDomainList(cfg.domains);
        syncLastTime.textContent = formatTime(cfg.lastSyncTime);
        syncLastStatus.textContent = cfg.lastSyncStatus || '空闲';
    }

    function normalizeDomain(input) {
        if (!input) return '';
        let d = input.trim().toLowerCase();
        if (d.startsWith('http://') || d.startsWith('https://')) {
            try { d = new URL(d).hostname; } catch (_) { /* ignore */ }
        }
        d = d.split('/')[0];
        d = d.split(':')[0];
        return d;
    }

    togglePanelBtn.addEventListener('click', () => {
        syncPanel.classList.toggle('hidden');
    });

    syncWriteModeSel.addEventListener('change', () => {
        refreshFsaDirRow(syncWriteModeSel.value, fsaDirName.textContent);
    });

    fsaPickDirBtn.addEventListener('click', async () => {
        if (typeof window.showDirectoryPicker !== 'function') {
            showStatus('当前浏览器不支持 File System Access API', 'error');
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            fsaDirHandle = handle;
            fsaDirName.textContent = handle.name;
            const cfg = await loadSyncConfig();
            cfg.fsaDirName = handle.name;
            await saveSyncConfig(cfg);
            showStatus(`已选择目录：${handle.name}`, 'success');
        } catch (err) {
            if (err && err.name !== 'AbortError') {
                console.error(err);
                showStatus('选择目录失败：' + err.message, 'error');
            }
        }
    });

    syncAddDomainBtn.addEventListener('click', async () => {
        const d = normalizeDomain(syncDomainInput.value);
        if (!d) {
            showStatus('请输入有效域名', 'error');
            return;
        }
        const cfg = await loadSyncConfig();
        if (cfg.domains.includes(d)) {
            showStatus('该域名已存在', 'info');
            return;
        }
        cfg.domains.push(d);
        await saveSyncConfig(cfg);
        syncDomainInput.value = '';
        renderDomainList(cfg.domains);
        showStatus(`已添加：${d}`, 'success');
    });

    syncDomainInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            syncAddDomainBtn.click();
        }
    });

    syncAddCurrentBtn.addEventListener('click', async () => {
        try {
            const tab = await getCurrentTab();
            if (!tab || !isWebUrl(tab.url)) {
                showStatus('当前不是普通网页（chrome:// 等不支持），请切到目标网站后再点', 'error');
                return;
            }
            const d = new URL(tab.url).hostname;
            if (!d) {
                showStatus('无法解析当前域名', 'error');
                return;
            }
            const cfg = await loadSyncConfig();
            if (cfg.domains.includes(d)) {
                showStatus('该域名已存在', 'info');
                return;
            }
            cfg.domains.push(d);
            await saveSyncConfig(cfg);
            renderDomainList(cfg.domains);
            showStatus(`已添加：${d}`, 'success');
        } catch (err) {
            console.error('添加当前域名失败:', err);
            showStatus('添加失败：' + err.message, 'error');
        }
    });

    syncSaveBtn.addEventListener('click', async () => {
        const cfg = await loadSyncConfig();
        cfg.enabled = syncEnabledChk.checked;
        cfg.intervalMinutes = parseInt(syncIntervalSel.value, 10) || 5;
        cfg.writeMode = syncWriteModeSel.value;
        await saveSyncConfig(cfg);

        chrome.runtime.sendMessage({ action: 'syncConfigUpdated' }, () => {
            showStatus('配置已保存', 'success');
        });
    });

    syncRunNowBtn.addEventListener('click', async () => {
        const cfg = await loadSyncConfig();
        if (!cfg.domains || cfg.domains.length === 0) {
            showStatus('请先添加要监控的域名', 'error');
            return;
        }

        if (cfg.writeMode === 'fsa' && fsaDirHandle) {
            try {
                const result = await syncCookiesViaFSA(cfg.domains, fsaDirHandle);
                cfg.lastSyncTime = Date.now();
                cfg.lastSyncStatus = `成功（FSA）：${result.length} 个域名`;
                await saveSyncConfig(cfg);
                await refreshSyncUI();
                showStatus(`已写入 ${result.length} 个文件到 ${fsaDirHandle.name}`, 'success');
            } catch (err) {
                console.error(err);
                cfg.lastSyncStatus = '失败：' + err.message;
                await saveSyncConfig(cfg);
                await refreshSyncUI();
                showStatus('写入失败：' + err.message, 'error');
            }
            return;
        }

        if (cfg.writeMode === 'fsa' && !fsaDirHandle) {
            showStatus('FSA 模式需先选择目录，将自动降级为下载', 'info');
        }

        chrome.runtime.sendMessage({ action: 'runSyncNow' }, (resp) => {
            if (resp && resp.success) {
                showStatus(`已触发同步 ${resp.count} 个域名`, 'success');
                setTimeout(refreshSyncUI, 800);
            } else {
                showStatus('同步失败：' + (resp && resp.error || '未知错误'), 'error');
            }
        });
    });

    async function syncCookiesViaFSA(domains, dirHandle) {
        const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            const req = await dirHandle.requestPermission({ mode: 'readwrite' });
            if (req !== 'granted') {
                throw new Error('未授予目录写入权限');
            }
        }

        const written = [];
        for (const domain of domains) {
            const cookies = await chrome.cookies.getAll({ domain });
            const text = cookiesToNetscape(cookies);
            const filename = `cookies-${sanitizeFilename(domain)}.txt`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(text);
            await writable.close();
            written.push(domain);
        }
        return written;
    }

    function sanitizeFilename(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    function cookiesToNetscape(cookies) {
        const header = [
            '# Netscape HTTP Cookie File',
            '# Generated by Cookie复制器',
            `# ${new Date().toISOString()}`,
            ''
        ].join('\n');

        const lines = cookies.map(c => {
            const domain = c.domain.startsWith('.') ? c.domain : (c.hostOnly ? c.domain : '.' + c.domain);
            const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
            const path = c.path || '/';
            const secure = c.secure ? 'TRUE' : 'FALSE';
            const expiration = c.expirationDate ? Math.floor(c.expirationDate) : 0;
            return [domain, includeSubdomains, path, secure, expiration, c.name, c.value].join('\t');
        });

        return header + lines.join('\n') + '\n';
    }

    // 监听 storage 变化，实时刷新 UI（例如 background 完成同步后写入 lastSyncTime）
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.syncConfig) {
            refreshSyncUI();
        }
    });

    await refreshSyncUI();

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