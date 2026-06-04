(function () {
  // Prevent multiple injections if the script is loaded twice
  if (window.heraChatWidget) return;

  // Configuration (Update this to your production URL when deploying)
  const HERA_DOMAIN = 'localhost:5173';
  const IFRAME_URL = `http://${HERA_DOMAIN}/embed`;

  // 1. Inject the Widget CSS
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --hera-brand: #8b1a1a;
      --hera-brand-dark: #6e1515;
      --hera-topbar-h: 46px;
    }

    #hera-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--hera-brand);
      color: white;
      border: none;
      border-radius: 50px;
      padding: 14px 22px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(139, 26, 26, 0.35), 0 2px 8px rgba(0, 0, 0, 0.12);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      letter-spacing: 0.01em;
    }

    #hera-fab:hover {
      background: var(--hera-brand-dark);
      transform: scale(1.04);
      box-shadow: 0 6px 28px rgba(139, 26, 26, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    #hera-fab:active {
      transform: scale(0.97);
    }

    #hera-fab svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #hera-fab.hidden {
      pointer-events: none;
      opacity: 0;
      transform: scale(0.6) translateY(20px);
    }

    #hera-fab::before {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50px;
      border: 2px solid var(--hera-brand);
      opacity: 0;
      animation: heraFabPulse 2.5s ease-out infinite;
    }

    @keyframes heraFabPulse {
      0% { opacity: 0.6; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.25); }
    }

    #hera-chat-frame {
      position: fixed;
      z-index: 99998;
      overflow: hidden;
      border: none;
      border-radius: 16px;
      background: white;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.08);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      bottom: 90px;
      right: 24px;
      width: 400px;
      height: 600px;
      display: flex;
      flex-direction: column;
    }

    /* ── Topbar ── */
    #hera-topbar {
      flex-shrink: 0;
      height: var(--hera-topbar-h);
      background: var(--hera-brand);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px 0 12px;
      border-radius: 16px 16px 0 0;
      transition: border-radius 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #hera-chat-frame.maximized #hera-topbar {
      border-radius: 20px 20px 0 0;
    }

    /* Branding (left side) */
    #hera-topbar-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    #hera-topbar-brand-icon {
      width: 26px;
      height: 26px;
      background: rgba(255, 255, 255, 0.18);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    #hera-topbar-brand-icon svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: white;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #hera-topbar-brand-name {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: white;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Actions (right side) */
    #hera-topbar-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    .hera-topbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 30px;
      min-width: 30px;
      background: transparent;
      border: none;
      border-radius: 7px;
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
      padding: 0 6px;
      flex-shrink: 0;
      gap: 5px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .hera-topbar-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .hera-topbar-btn:active {
      transform: scale(0.9);
      background: rgba(255, 255, 255, 0.25);
    }

    .hera-topbar-btn svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      display: block;
      flex-shrink: 0;
    }

    /* Wider "New Chat" button */
    #hera-btn-reset {
      padding: 0 8px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    #hera-btn-reset:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    /* Reset button spin animation on click */
    #hera-btn-reset.spin svg {
      animation: heraSpinOnce 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes heraSpinOnce {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(-360deg); }
    }

    /* Separator between new-chat and close */
    .hera-topbar-sep {
      width: 1px;
      height: 16px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0 2px;
      flex-shrink: 0;
    }

    #hera-chat-frame iframe {
      flex: 1;
      width: 100%;
      border: none;
      display: block;
      background: transparent;
      min-height: 0;
    }

    #hera-chat-frame.closed {
      pointer-events: none;
      opacity: 0;
      transform: scale(0.9) translateY(24px);
    }

    #hera-chat-frame.open {
      opacity: 1;
      transform: scale(1) translateY(0);
    }

    #hera-chat-frame.maximized {
      bottom: 10vh;
      right: 10vw;
      width: 80vw;
      height: 80vh;
      border-radius: 20px;
      box-shadow: 0 32px 100px rgba(0, 0, 0, 0.25), 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    #hera-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99997;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      transition: opacity 0.3s ease;
      opacity: 0;
      pointer-events: none;
    }

    #hera-backdrop.visible {
      opacity: 1;
      pointer-events: auto;
    }

    @media (max-width: 480px) {
      #hera-chat-frame {
        bottom: 0;
        right: 0;
        width: 100vw;
        height: calc(100vh - 60px);
        border-radius: 16px 16px 0 0;
      }
      #hera-topbar {
        border-radius: 16px 16px 0 0;
      }
      #hera-chat-frame.maximized {
        bottom: 0;
        right: 0;
        width: 100vw;
        height: 100vh;
        border-radius: 0;
      }
      #hera-chat-frame.maximized #hera-topbar {
        border-radius: 0;
      }
      #hera-fab {
        bottom: 16px;
        right: 16px;
        padding: 12px 18px;
        font-size: 13px;
      }
    }
  `;
  document.head.appendChild(style);

  // 2. Inject the HTML structure
  const container = document.createElement('div');
  container.id = 'hera-widget-container';
  container.innerHTML = `
    <div id="hera-backdrop"></div>
    <div id="hera-chat-frame" class="closed">
      <div id="hera-topbar">
        <!-- Left: branding -->
        <div id="hera-topbar-brand">
          <div id="hera-topbar-brand-icon">
            <svg viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <span id="hera-topbar-brand-name">Hera</span>
        </div>
        <!-- Right: action buttons -->
        <div id="hera-topbar-actions">
          <!-- Maximize / Restore -->
          <button class="hera-topbar-btn" id="hera-btn-maximize" title="Maximize" aria-label="Maximize chat">
            <svg id="hera-icon-maximize" viewBox="0 0 24 24">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            <svg id="hera-icon-restore" viewBox="0 0 24 24" style="display:none">
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="10" y1="14" x2="3" y2="21"></line>
              <line x1="21" y1="3" x2="14" y2="10"></line>
            </svg>
          </button>
          <!-- New Chat -->
          <button class="hera-topbar-btn" id="hera-btn-reset" title="New chat" aria-label="Start a new chat">
            <svg viewBox="0 0 24 24">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 .49-4.95"></path>
            </svg>
            New Chat
          </button>
          <div class="hera-topbar-sep"></div>
          <!-- Close -->
          <button class="hera-topbar-btn" id="hera-btn-close" title="Close" aria-label="Close chat">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <iframe id="hera-iframe" src="${IFRAME_URL}" title="Hera Tax Assistant" allow="clipboard-write"></iframe>
    </div>
    <button id="hera-fab">
      <svg viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      Ask Hera
    </button>
  `;
  document.body.appendChild(container);

  // 3. Widget Controller Logic
  window.heraChatWidget = (() => {
    const frame   = document.getElementById('hera-chat-frame');
    const fab     = document.getElementById('hera-fab');
    const backdrop = document.getElementById('hera-backdrop');
    const iframe  = document.getElementById('hera-iframe');

    const btnMaximize   = document.getElementById('hera-btn-maximize');
    const btnReset      = document.getElementById('hera-btn-reset');
    const btnClose      = document.getElementById('hera-btn-close');
    const iconMaximize  = document.getElementById('hera-icon-maximize');
    const iconRestore   = document.getElementById('hera-icon-restore');

    let state = 'closed'; // 'closed' | 'open' | 'maximized'

    // Attach click listeners
    fab.addEventListener('click', toggle);
    backdrop.addEventListener('click', restore);

    btnMaximize.addEventListener('click', () => {
      state === 'maximized' ? restore() : maximize();
    });

    btnReset.addEventListener('click', () => {
      // Spin animation on the icon inside the button
      btnReset.classList.remove('spin');
      void btnReset.offsetWidth;
      btnReset.classList.add('spin');
      btnReset.addEventListener('animationend', () => btnReset.classList.remove('spin'), { once: true });

      // Send reset message to iframe
      try {
        iframe.contentWindow.postMessage({ source: 'hera-host', action: 'reset' }, '*');
      } catch (e) {
        iframe.src = iframe.src;
      }
    });

    btnClose.addEventListener('click', minimize);

    function updateMaximizeIcon(isMaximized) {
      iconMaximize.style.display = isMaximized ? 'none' : '';
      iconRestore.style.display  = isMaximized ? ''     : 'none';
      btnMaximize.title          = isMaximized ? 'Restore' : 'Maximize';
      btnMaximize.setAttribute('aria-label', isMaximized ? 'Restore chat' : 'Maximize chat');
    }

    function setState(next) {
      state = next;
      frame.className = next === 'closed' ? 'closed' : next === 'maximized' ? 'open maximized' : 'open';
      fab.className   = next === 'closed' ? '' : 'hidden';
      backdrop.className = next === 'maximized' ? 'visible' : '';

      updateMaximizeIcon(next === 'maximized');

      try {
        iframe.contentWindow.postMessage({
          source: 'hera-host',
          action: 'state',
          maximized: next === 'maximized',
        }, '*');
      } catch (e) {
        // Ignore cross-origin errors
      }
    }

    function toggle()   { setState(state === 'closed' ? 'open' : 'closed'); }
    function open()     { if (state === 'closed') setState('open'); }
    function minimize() { setState('closed'); }
    function maximize() { setState('maximized'); }
    function restore()  { setState('open'); }

    // Listen for postMessage from the React iframe
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (data?.source !== 'hera-embed') return;

      switch (data.action) {
        case 'minimize': minimize(); break;
        case 'maximize': maximize(); break;
        case 'restore':  restore();  break;
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state !== 'closed') {
        state === 'maximized' ? restore() : minimize();
      }
    });

    // Click-outside to minimize (normal open state only — backdrop handles maximized)
    document.addEventListener('mousedown', (e) => {
      if (state !== 'open') return;
      if (!frame.contains(e.target) && !fab.contains(e.target)) {
        minimize();
      }
    });

    return { toggle, open, minimize, maximize, restore };
  })();
})();