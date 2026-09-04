// 自动填充内容脚本：检测登录表单的密码框 → 注入触发图标 → 浮层列表（此网站分组 + 全部）→ 点选填充。
// 安全约定：凭据解密在 background 完成；content script 只经 runtime 消息拿数据，
// 列表仅含标题/账号，密码在点中某条时按 id 单条取回、填充后即弃。
// 浮层与图标均挂 Shadow DOM，隔离页面样式并防页面脚本探测。

import { isSameSite } from '../lib/matcher';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    // 自家 H5 有自己的锁定/解锁流程，不需要填充图标
    if (location.host === 'm.colin-web4.cn') return;

    const TRIGGER_SIZE = 26;
    const triggers = new Map<HTMLInputElement, HTMLElement>();
    let panelHost: HTMLElement | null = null;
    let panelRoot: ShadowRoot | null = null;
    let panelInput: HTMLInputElement | null = null;
    let panelItems: any[] = [];
    let panelState = '';

    // ---------- 工具 ----------

    function isVisible(el: HTMLElement): boolean {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    }

    function sendMessage(msg: any): Promise<any> {
      return chrome.runtime.sendMessage(msg);
    }

    function setNativeValue(el: HTMLInputElement, value: string) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 找密码框对应的账号输入框：优先所在 form，退化到向上最近容器；取密码框之前最后一个可见文本框
    function findUsernameInput(pw: HTMLInputElement): HTMLInputElement | null {
      const root: ParentNode = pw.form || pw.closest('div,section,main,form') || document;
      const all = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
      const ok = all.filter((i) => {
        if (i === pw) return false;
        const t = (i.getAttribute('type') || 'text').toLowerCase();
        return ['text', 'email', 'tel', ''].includes(t) && isVisible(i) && !i.disabled && !i.readOnly;
      });
      return ok.length ? ok[ok.length - 1] : null;
    }

    // ---------- 触发图标 ----------

    function ensureTrigger(pw: HTMLInputElement) {
      if (triggers.has(pw)) return;
      const host = document.createElement('div');
      host.dataset.pv = 'trigger';
      const shadow = host.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = `
        :host { all: initial; }
        button {
          all: unset; display: block; width: ${TRIGGER_SIZE}px; height: ${TRIGGER_SIZE}px;
          border-radius: 7px; background: #4a6cf7; color: #fff; font-size: 14px;
          line-height: ${TRIGGER_SIZE}px; text-align: center; cursor: pointer;
          box-shadow: 0 2px 8px rgba(74,108,247,.45); user-select: none;
        }
        button:hover { background: #3b5bdb; }
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '🔑';
      btn.title = '密小本：填充密码';
      btn.addEventListener('mousedown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel(pw);
      });
      shadow.append(style, btn);
      document.documentElement.appendChild(host);
      positionTrigger(pw, host);
      triggers.set(pw, host);
    }

    function positionTrigger(pw: HTMLInputElement, host: HTMLElement) {
      const rect = pw.getBoundingClientRect();
      host.style.position = 'absolute';
      host.style.zIndex = '2147483646';
      host.style.top = rect.top + window.scrollY + (rect.height - TRIGGER_SIZE) / 2 + 'px';
      host.style.left = rect.left + window.scrollX + rect.width - TRIGGER_SIZE - 6 + 'px';
    }

    function removeStaleTriggers() {
      for (const [pw, host] of triggers) {
        if (!document.contains(pw)) {
          host.remove();
          triggers.delete(pw);
        }
      }
    }

    function refreshTriggers() {
      removeStaleTriggers();
      const pws = document.querySelectorAll('input[type="password"]');
      pws.forEach((el) => {
        const pw = el as HTMLInputElement;
        if (isVisible(pw) && !pw.disabled && !pw.readOnly) {
          ensureTrigger(pw);
          positionTrigger(pw, triggers.get(pw)!);
        }
      });
    }

    function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
      let timer: any;
      return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
      };
    }

    const rescan = debounce(() => refreshTriggers(), 250);

    // ---------- 浮层 ----------

    function togglePanel(pw: HTMLInputElement) {
      if (panelHost && panelInput === pw) {
        closePanel();
        return;
      }
      openPanel(pw);
    }

    function openPanel(pw: HTMLInputElement) {
      closePanel();
      panelInput = pw;
      panelHost = document.createElement('div');
      panelHost.dataset.pv = 'panel';
      panelRoot = panelHost.attachShadow({ mode: 'closed' });
      document.documentElement.appendChild(panelHost);

      const rect = pw.getBoundingClientRect();
      panelHost.style.position = 'fixed';
      panelHost.style.zIndex = '2147483647';
      panelHost.style.width = '336px';
      panelHost.style.top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 380)) + 'px';
      panelHost.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 344)) + 'px';

      panelRoot.innerHTML = `<style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
        .panel {
          background: #fff; border-radius: 12px; overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,.22); border: 1px solid #e8eaf1;
        }
        .hd { padding: 10px 14px; font-size: 13px; color: #666; background: #f5f6fa;
              border-bottom: 1px solid #eef0f5; word-break: break-all; }
        .q { width: 100%; border: none; outline: none; padding: 10px 14px; font-size: 14px;
             border-bottom: 1px solid #eef0f5; }
        .list { max-height: 280px; overflow-y: auto; }
        .grp { padding: 8px 14px 2px; font-size: 12px; color: #999; }
        .it { display: flex; align-items: center; gap: 10px; padding: 9px 14px; cursor: pointer; }
        .it:hover { background: #f0f3ff; }
        .av { width: 30px; height: 30px; border-radius: 8px; background: #4a6cf7; color: #fff;
              font-weight: 600; font-size: 15px; line-height: 30px; text-align: center; flex-shrink: 0; }
        .tx { flex: 1; min-width: 0; }
        .t { font-size: 14px; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .s { font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msg { padding: 26px 14px; text-align: center; color: #666; font-size: 14px; }
        .unlock-btn { display: block; margin: 12px auto 4px; background: #4a6cf7; color: #fff;
                      border: none; border-radius: 8px; padding: 9px 26px; font-size: 14px; cursor: pointer; }
        .ft { padding: 7px 14px; font-size: 11px; color: #bbb; background: #fafbfd;
              border-top: 1px solid #eef0f5; }
      </style>
      <div class="panel">
        <div class="hd">密小本 · ${escapeHtml(location.host)}</div>
        <input class="q" placeholder="搜索标题或账号" />
        <div class="list"><div class="msg">加载中…</div></div>
        <div class="ft">点选一条即自动填充账号与密码 · Esc 关闭</div>
      </div>`;
      panelRoot.querySelector('.q')!.addEventListener('input', (e) =>
        renderList((e.target as HTMLInputElement).value)
      );

      renderList('');
      void (async () => {
        try {
          const resp = await sendMessage({ type: 'PV_LIST', origin: location.origin });
          if (resp && resp.items) {
            panelState = 'ready';
            panelItems = resp.items;
            renderList(currentKeyword());
          } else if (resp && resp.locked) {
            renderLocked('密小本已锁定，解锁后即可填充');
          } else if (resp && resp.auth === false) {
            renderLocked('尚未登录，请先在扩展弹窗中登录');
          } else {
            renderLocked('加载失败：' + ((resp && resp.error) || '未知错误'));
          }
        } catch (e: any) {
          renderLocked('加载失败：' + ((e && e.message) || e));
        }
      })();
    }

    function renderLocked(msg: string) {
      const list = panelRoot?.querySelector('.list');
      if (!list) return;
      list.innerHTML = `<div class="msg">${escapeHtml(msg)}</div><button class="unlock-btn">去解锁</button>`;
      list.querySelector('.unlock-btn')?.addEventListener('click', () => {
        try {
          const p = (chrome.action as any).openPopup();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* 旧版本不支持 openPopup，走手动点击工具栏图标 */
        }
        closePanel();
      });
    }

    function currentKeyword(): string {
      return (panelRoot?.querySelector('.q') as HTMLInputElement)?.value.trim().toLowerCase() || '';
    }

    function renderList(keyword: string) {
      const list = panelRoot?.querySelector('.list');
      if (!list || panelState !== 'ready') return;
      const kw = keyword.toLowerCase();
      const hit = panelItems.filter(
        (i) => !kw || i.title.toLowerCase().includes(kw) || i.username.toLowerCase().includes(kw)
      );
      const sameSite = hit.filter((i) => i.url && isSameSite(i.url, location.origin));
      const others = hit.filter((i) => !(i.url && isSameSite(i.url, location.origin)));
      const row = (i: any) => `
        <div class="it" data-id="${escapeHtml(i.id)}">
          <div class="av">${escapeHtml((i.title || '?').charAt(0).toUpperCase())}</div>
          <div class="tx"><div class="t">${escapeHtml(i.title)}</div><div class="s">${escapeHtml(i.username)}</div></div>
        </div>`;
      let html = '';
      if (sameSite.length) {
        html += `<div class="grp">此网站（${sameSite.length}）</div>` + sameSite.map(row).join('');
      }
      if (others.length) {
        html += `<div class="grp">${sameSite.length ? '全部条目' : '全部条目（此网站无匹配）'}</div>` + others.map(row).join('');
      }
      list.innerHTML = html || '<div class="msg">没有匹配的密码</div>';
      list.querySelectorAll('.it').forEach((el) => {
        el.addEventListener('click', () => void pick(el.getAttribute('data-id') as string));
      });
    }

    async function pick(id: string) {
      const list = panelRoot?.querySelector('.list');
      if (list) list.innerHTML = '<div class="msg">填充中…</div>';
      try {
        const cred = await sendMessage({ type: 'PV_CRED', id });
        if (cred && cred.locked) {
          renderLocked('密小本已锁定，解锁后即可填充');
          return;
        }
        if (!cred || cred.error || !panelInput) {
          renderLocked('填充失败：' + ((cred && cred.error) || '未知错误'));
          return;
        }
        const usernameInput = findUsernameInput(panelInput);
        if (usernameInput) setNativeValue(usernameInput, cred.username);
        setNativeValue(panelInput, cred.password);
        panelInput.focus();
        closePanel();
      } catch (e: any) {
        renderLocked('填充失败：' + (e.message || e));
      }
    }

    function closePanel() {
      panelHost?.remove();
      panelHost = null;
      panelRoot = null;
      panelInput = null;
      panelState = '';
      panelItems = [];
    }

    function escapeHtml(s: string): string {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    }

    // ---------- 全局事件 ----------

    document.addEventListener(
      'mousedown',
      (e) => {
        if (!panelHost) return;
        const path = e.composedPath();
        if (path.includes(panelHost)) return;
        for (const host of triggers.values()) if (path.includes(host)) return;
        closePanel();
      },
      true
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });
    window.addEventListener('resize', rescan);

    const mo = new MutationObserver(rescan);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    refreshTriggers();
  },
});
