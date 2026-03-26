/**
 * Embeddable Chat Widget Loader
 * Usage: <script src="https://your-domain/widget-loader.js" data-server="http://localhost:3000"></script>
 */
(function() {
  'use strict';

  // Get server URL from script tag data attribute
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  
  var serverUrl = currentScript.getAttribute('data-server') || 'http://localhost:3000';
  
  // State
  var isOpen = false;
  var button = null;
  var iframe = null;
  var hasShownOnce = false;

  // Chat icon SVG
  var chatIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  
  var closeIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  // Create styles
  var style = document.createElement('style');
  style.textContent = \`
    @keyframes widget-pulse {
      0%, 100% { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); }
      50% { box-shadow: 0 4px 20px rgba(37, 99, 235, 0.6); }
    }
    
    .widget-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #2563eb;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
      z-index: 999999;
      transition: transform 0.2s ease, background 0.2s ease;
      color: white;
    }
    
    .widget-button:hover {
      background: #1d4ed8;
      transform: scale(1.05);
    }
    
    .widget-button:active {
      transform: scale(0.95);
    }
    
    .widget-button.pulse {
      animation: widget-pulse 2s ease-in-out 3;
    }
    
    .widget-iframe-container {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 400px;
      height: 600px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      z-index: 999998;
      display: none;
      overflow: hidden;
      background: white;
    }
    
    .widget-iframe-container.open {
      display: block;
      animation: widget-slide-in 0.3s ease-out;
    }
    
    @keyframes widget-slide-in {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @media (max-width: 480px) {
      .widget-iframe-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
      }
      
      .widget-button {
        bottom: 16px;
        right: 16px;
      }
    }
  \`;
  document.head.appendChild(style);

  // Create button
  function createButton() {
    button = document.createElement('button');
    button.className = 'widget-button pulse';
    button.innerHTML = chatIconSvg;
    button.setAttribute('aria-label', 'Open chat widget');
    button.onclick = toggleWidget;
    document.body.appendChild(button);
  }

  // Create iframe
  function createIframe() {
    var container = document.createElement('div');
    container.className = 'widget-iframe-container';
    
    iframe = document.createElement('iframe');
    iframe.src = serverUrl + '/widget';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('allow', 'microphone; camera');
    iframe.setAttribute('title', 'Chat Widget');
    
    container.appendChild(iframe);
    document.body.appendChild(container);
    
    return container;
  }

  // Toggle widget
  function toggleWidget() {
    if (!iframe) {
      var container = createIframe();
      setTimeout(function() {
        container.classList.add('open');
        isOpen = true;
        updateButton();
        sendMessageToIframe({ type: 'widget-toggle', open: true });
      }, 10);
    } else {
      isOpen = !isOpen;
      var container = iframe.parentElement;
      
      if (isOpen) {
        container.classList.add('open');
      } else {
        container.classList.remove('open');
      }
      
      updateButton();
      sendMessageToIframe({ type: 'widget-toggle', open: isOpen });
    }
    
    // Remove pulse animation after first interaction
    if (!hasShownOnce) {
      hasShownOnce = true;
      button.classList.remove('pulse');
    }
  }

  // Update button icon
  function updateButton() {
    if (isOpen) {
      button.innerHTML = closeIconSvg;
      button.setAttribute('aria-label', 'Close chat widget');
    } else {
      button.innerHTML = chatIconSvg;
      button.setAttribute('aria-label', 'Open chat widget');
    }
  }

  // Send message to iframe
  function sendMessageToIframe(message) {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, serverUrl);
    }
  }

  // Listen for messages from iframe
  window.addEventListener('message', function(event) {
    // Validate origin
    if (event.origin !== serverUrl) return;
    
    var data = event.data;
    
    if (data.type === 'widget-close') {
      if (isOpen) {
        toggleWidget();
      }
    }
  });

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createButton);
  } else {
    createButton();
  }
})();
