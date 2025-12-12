(function() {
  // --- Utility Functions ---

  // Asynchronously load items from chrome.storage.local.
  function loadItems(callback) {
    chrome.storage.local.get(['ifsQuickCallItems'], (result) => {
      const items = result.ifsQuickCallItems || [];
      callback(items);
    });
  }

  // --- Hover Settings ---
  const HOVER_SETTINGS_KEY = 'ifsHoverSettings';
  const DEFAULT_HOVER_BG = '#0365D8';
  const DEFAULT_HOVER_TEXT = '#FFFFFF';

  // Inject dynamic hover styles based on saved settings.
  function applyHoverStyles(settings) {
    const bgColor = settings.hoverBgColor || DEFAULT_HOVER_BG;
    const textColor = settings.hoverTextColor || DEFAULT_HOVER_TEXT;

    // Remove existing dynamic style if present
    const existingStyle = document.getElementById('ifs-hover-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and inject new style
    const style = document.createElement('style');
    style.id = 'ifs-hover-styles';
    style.textContent = `
      .custom-context-menu li:hover {
        background-color: ${bgColor} !important;
        color: ${textColor} !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Load hover settings and apply styles on init.
  function initHoverStyles() {
    chrome.storage.local.get([HOVER_SETTINGS_KEY], (result) => {
      const settings = result[HOVER_SETTINGS_KEY] || {
        hoverBgColor: DEFAULT_HOVER_BG,
        hoverTextColor: DEFAULT_HOVER_TEXT
      };
      applyHoverStyles(settings);
    });
  }

  // Listen for storage changes to update hover styles dynamically.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[HOVER_SETTINGS_KEY]) {
      applyHoverStyles(changes[HOVER_SETTINGS_KEY].newValue || {});
    }
  });

  // Initialize hover styles on load.
  initHoverStyles();

  // Filter items based on the active URL using wildcard support.
  // It converts the pkURL (which can include *) into a regular expression.
  function filterItemsForCurrentUrl(activeUrl, items) {
    return items.filter(item => {
      // Trim any extra whitespace
      const pkURL = item.pkURL.trim();
      // Escape regex special characters except for *, then replace * with .*
      const pattern = pkURL
        .replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp('^' + pattern + '$');
      return regex.test(activeUrl);
    });
  }

  // --- Custom Context Menu Creation ---

  // Create the custom context (RMB) menu container.
  const customMenu = document.createElement("div");
  customMenu.className = "custom-context-menu";
  customMenu.style.display = "none";
  document.body.appendChild(customMenu);

  // Populate the menu with filtered list items.
  function populateCustomMenu(items) {
    // Clear any existing menu items.
    customMenu.innerHTML = "";

    // If no items match, show a "No matching items." message.
    if (!items || items.length === 0) {
      const noItems = document.createElement("div");
      noItems.textContent = "No matching items.";
      noItems.style.padding = "8px 12px";
      customMenu.appendChild(noItems);
      return;
    }

    // Create an unordered list to hold the menu items.
    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.margin = "0";
    ul.style.padding = "0";

    // Create a list item for each entry.
    items.forEach(item => {
      const li = document.createElement("li");
      // Add icon for function code or custom action
      if (item.actionType && item.actionType !== 'openUrl') {
        li.innerHTML = '<span style="color:#0365D8;font-weight:bold;margin-right:6px;">&#9881;</span>' + item.callName;
      } else {
        li.textContent = item.callName;
      }
      li.style.padding = "8px 12px";
      li.style.cursor = "pointer";

      li.addEventListener("click", function(e) {
        e.stopPropagation();
        customMenu.style.display = "none";
        switch (item.actionType) {
          case 'alert':
            alert(item.actionParams && item.actionParams.text ? item.actionParams.text : '');
            break;
          case 'openUrl':
            chrome.runtime.sendMessage({
              action: "navigate",
              url: item.url,
              currentTab: item.currentTab
            });
            break;
          case 'logToConsole':
            console.log(item.actionParams && item.actionParams.message ? item.actionParams.message : '');
            break;
          case 'injectBanner':
            var banner = document.createElement('div');
            banner.textContent = item.actionParams && item.actionParams.text ? item.actionParams.text : '';
            banner.style.position = 'fixed';
            banner.style.top = '0';
            banner.style.left = '0';
            banner.style.width = '100%';
            banner.style.background = '#0365D8';
            banner.style.color = '#fff';
            banner.style.padding = '10px';
            banner.style.zIndex = 999999999;
            document.body.appendChild(banner);
            break;
          case 'customHtmlModal':
            var modalOverlay = document.createElement('div');
            modalOverlay.style.position = 'fixed';
            modalOverlay.style.top = '0';
            modalOverlay.style.left = '0';
            modalOverlay.style.width = '100vw';
            modalOverlay.style.height = '100vh';
            modalOverlay.style.background = 'rgba(0,0,0,0.4)';
            modalOverlay.style.zIndex = 999999999;
            modalOverlay.style.display = 'flex';
            modalOverlay.style.alignItems = 'center';
            modalOverlay.style.justifyContent = 'center';
            var modalBox = document.createElement('div');
            modalBox.style.background = '#fff';
            modalBox.style.padding = '24px';
            modalBox.style.borderRadius = '8px';
            modalBox.style.maxWidth = '80vw';
            modalBox.style.maxHeight = '80vh';
            modalBox.style.overflow = 'auto';
            modalBox.style.position = 'relative';
            modalBox.style.zIndex = 999999999;
            modalBox.innerHTML = item.actionParams && item.actionParams.html ? item.actionParams.html : '';
            var closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '16px';
            closeBtn.style.right = '24px';
            closeBtn.style.fontSize = '24px';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 999999999;
            closeBtn.onclick = function() { document.body.removeChild(modalOverlay); };
            modalBox.appendChild(closeBtn);
            modalOverlay.appendChild(modalBox);
            modalOverlay.addEventListener('click', function(ev) {
              if (ev.target === modalOverlay) document.body.removeChild(modalOverlay);
            });
            document.body.appendChild(modalOverlay);
            break;
          case 'richTextModal':
            var modalOverlay = document.createElement('div');
            modalOverlay.style.position = 'fixed';
            modalOverlay.style.top = '0';
            modalOverlay.style.left = '0';
            modalOverlay.style.width = '100vw';
            modalOverlay.style.height = '100vh';
            modalOverlay.style.background = 'rgba(0,0,0,0.5)';
            modalOverlay.style.zIndex = 999999999;
            modalOverlay.style.display = 'flex';
            modalOverlay.style.alignItems = 'center';
            modalOverlay.style.justifyContent = 'center';
            modalOverlay.style.fontFamily = 'sans-serif';

            var modalBox = document.createElement('div');
            modalBox.style.background = item.actionParams && item.actionParams.backgroundColor ? item.actionParams.backgroundColor : '#ffffff';
            modalBox.style.padding = '32px';
            modalBox.style.borderRadius = '12px';
            modalBox.style.maxWidth = '90vw';
            modalBox.style.maxHeight = '90vh';
            modalBox.style.overflow = 'auto';
            modalBox.style.position = 'relative';
            modalBox.style.zIndex = 999999999;
            modalBox.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
            
            // Add modal title if provided
            if (item.actionParams && item.actionParams.title) {
              var titleElement = document.createElement('h2');
              titleElement.textContent = item.actionParams.title;
              titleElement.style.margin = '0 0 24px 0';
              titleElement.style.fontFamily = item.actionParams.fontFamily || 'Inter, sans-serif';
              titleElement.style.fontSize = Math.min(24, (item.actionParams.fontSize || 16) + 8) + 'px';
              titleElement.style.fontWeight = '600';
              titleElement.style.color = item.actionParams.textColor || '#333333';
              titleElement.style.paddingRight = '40px';
              modalBox.appendChild(titleElement);
            }

            // Content container
            var contentContainer = document.createElement('div');
            contentContainer.style.fontFamily = item.actionParams && item.actionParams.fontFamily ? item.actionParams.fontFamily + ', sans-serif' : 'Inter, sans-serif';
            contentContainer.style.fontSize = (item.actionParams && item.actionParams.fontSize ? item.actionParams.fontSize : 16) + 'px';
            contentContainer.style.color = item.actionParams && item.actionParams.textColor ? item.actionParams.textColor : '#333333';
            contentContainer.style.lineHeight = '1.6';
            contentContainer.style.maxWidth = '100%';
            contentContainer.style.wordWrap = 'break-word';
            
            // Set rich text content
            if (item.actionParams && item.actionParams.html) {
              contentContainer.innerHTML = item.actionParams.html;
            } else {
              contentContainer.textContent = 'No content available';
            }
            
            // Apply styling to lists and other elements
            var lists = contentContainer.querySelectorAll('ul, ol');
            lists.forEach(function(list) {
              list.style.paddingLeft = '24px';
              list.style.margin = '12px 0';
            });
            
            var listItems = contentContainer.querySelectorAll('li');
            listItems.forEach(function(li) {
              li.style.marginBottom = '6px';
            });
            
            var paragraphs = contentContainer.querySelectorAll('p');
            paragraphs.forEach(function(p) {
              p.style.margin = '12px 0';
            });
            
            var headings = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headings.forEach(function(heading) {
              heading.style.margin = '20px 0 12px 0';
              heading.style.fontWeight = '600';
            });

            modalBox.appendChild(contentContainer);

            // Close button
            var closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '20px';
            closeBtn.style.right = '24px';
            closeBtn.style.fontSize = '28px';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.color = item.actionParams && item.actionParams.textColor ? item.actionParams.textColor : '#666666';
            closeBtn.style.zIndex = 999999999;
            closeBtn.style.width = '32px';
            closeBtn.style.height = '32px';
            closeBtn.style.borderRadius = '50%';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.justifyContent = 'center';
            closeBtn.style.transition = 'all 0.2s ease';
            
            closeBtn.onmouseover = function() {
              closeBtn.style.backgroundColor = 'rgba(0,0,0,0.1)';
            };
            closeBtn.onmouseout = function() {
              closeBtn.style.backgroundColor = 'transparent';
            };
            
            closeBtn.onclick = function() { 
              document.body.removeChild(modalOverlay); 
            };
            
            modalBox.appendChild(closeBtn);
            modalOverlay.appendChild(modalBox);
            
            // Close on overlay click
            modalOverlay.addEventListener('click', function(ev) {
              if (ev.target === modalOverlay) document.body.removeChild(modalOverlay);
            });
            
             document.body.appendChild(modalOverlay);
             break;
          case 'functionCall':
            try {
              if (item.actionParams && item.actionParams.functionCode) {
                let codeToExecute = item.actionParams.functionCode;
                
                if (item.actionParams.functionType === 'body') {
                  // Wrap function body in function definition
                  const functionName = item.actionParams.functionName || 'customFunction';
                  codeToExecute = `function ${functionName}() { ${item.actionParams.functionCode} }; ${functionName}();`;
                }
                
                // Execute the function in page context
                const script = document.createElement('script');
                script.textContent = `
                  try {
                    ${codeToExecute}
                  } catch (error) {
                    console.error('Function execution error:', error);
                    alert('Function execution error: ' + error.message);
                  }
                `;
                document.head.appendChild(script);
                document.head.removeChild(script);
              }
            } catch (err) {
              alert('Error executing function: ' + err.message);
              console.error('Function call error:', err);
            }
            break;
          case 'countdownClock':
            // Remove any existing countdown modal
            if (window.activeCountdownModal) {
              clearInterval(window.activeCountdownInterval);
              document.body.removeChild(window.activeCountdownModal);
              window.activeCountdownModal = null;
            }
            var modalOverlay = document.createElement('div');
            modalOverlay.style.position = 'fixed';
            modalOverlay.style.top = '0';
            modalOverlay.style.left = '0';
            modalOverlay.style.width = '100vw';
            modalOverlay.style.height = '100vh';
            modalOverlay.style.background = 'rgba(0,0,0,0.85)';
            modalOverlay.style.zIndex = 999999999;
            modalOverlay.style.display = 'flex';
            modalOverlay.style.alignItems = 'center';
            modalOverlay.style.justifyContent = 'center';
            var modalBox = document.createElement('div');
            modalBox.style.background = 'none';
            modalBox.style.padding = '0';
            modalBox.style.borderRadius = '0';
            modalBox.style.maxWidth = '90vw';
            modalBox.style.maxHeight = '90vh';
            modalBox.style.overflow = 'visible';
            modalBox.style.position = 'relative';
            modalBox.style.textAlign = 'center';
            modalBox.style.zIndex = 999999999;
            // Label/message
            if (item.actionParams && item.actionParams.label) {
              var label = document.createElement('div');
              label.textContent = item.actionParams.label;
              label.style.color = '#fff';
              label.style.fontSize = '2rem';
              label.style.marginBottom = '24px';
              label.style.zIndex = 999999999;
              modalBox.appendChild(label);
            }
            // Countdown clock
            var clock = document.createElement('div');
            clock.style.fontFamily = 'monospace';
            clock.style.fontSize = '8rem';
            clock.style.fontWeight = 'bold';
            clock.style.color = '#fff';
            clock.style.textShadow = '0 0 16px #000, 0 0 8px #000';
            clock.style.margin = '0 auto 24px auto';
            clock.style.zIndex = 999999999;
            clock.textContent = '00:00';
            modalBox.appendChild(clock);
            // Close button
            var closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '16px';
            closeBtn.style.right = '24px';
            closeBtn.style.fontSize = '32px';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#fff';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 999999999;
            closeBtn.onclick = function() {
              clearInterval(window.activeCountdownInterval);
              document.body.removeChild(modalOverlay);
              window.activeCountdownModal = null;
            };
            modalBox.appendChild(closeBtn);
            modalOverlay.appendChild(modalBox);
            modalOverlay.addEventListener('click', function(ev) {
              if (ev.target === modalOverlay) {
                clearInterval(window.activeCountdownInterval);
                document.body.removeChild(modalOverlay);
                window.activeCountdownModal = null;
              }
            });
            document.body.appendChild(modalOverlay);
            window.activeCountdownModal = modalOverlay;
            // Countdown logic
            var totalSeconds = (item.actionParams && item.actionParams.minutes ? parseInt(item.actionParams.minutes, 10) : 1) * 60;
            function formatTime(secs) {
              var m = Math.floor(secs / 60);
              var s = secs % 60;
              return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            }
            function playBeep() {
              try {
                var ctx = new (window.AudioContext || window.webkitAudioContext)();
                var o = ctx.createOscillator();
                var g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = 880;
                o.connect(g);
                g.connect(ctx.destination);
                g.gain.value = 0.2;
                o.start();
                setTimeout(function() { o.stop(); ctx.close(); }, 500);
              } catch (e) {}
            }
            function tick() {
              if (totalSeconds > 0) {
                clock.textContent = formatTime(totalSeconds);
                totalSeconds--;
              } else {
                clock.textContent = '00:00';
                clearInterval(window.activeCountdownInterval);
                // Show Time's up!
                clock.textContent = "Time's up!";
                clock.style.fontSize = '5rem';
                clock.style.color = '#ff4444';
                playBeep();
              }
            }
            tick();
            window.activeCountdownInterval = setInterval(tick, 1000);
            break;
        }
      });

      // Simple hover effects.
      li.addEventListener("mouseenter", () => {
        li.style.backgroundColor = "#f0f0f0";
      });
      li.addEventListener("mouseleave", () => {
        li.style.backgroundColor = "";
      });

      ul.appendChild(li);
    });

    customMenu.appendChild(ul);
  }

  // --- Event Listeners for the Custom RMB Menu ---

  // Intercept right-click events.
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault(); // Prevent the default context menu

    // Request the active tab URL from the background script.
    chrome.runtime.sendMessage({ action: "getActiveTabUrl" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving active URL:", chrome.runtime.lastError);
        return;
      }
      
      const activeUrl = response.activeUrl || "";
      // Load the items from chrome.storage.local, then filter.
      loadItems((items) => {
        const filteredItems = filterItemsForCurrentUrl(activeUrl, items);
        populateCustomMenu(filteredItems);

        // Position the custom menu at the mouse coordinates.
        customMenu.style.top = e.clientY + "px";
        customMenu.style.left = e.clientX + "px";
        customMenu.style.display = "block";
      });
    });
  });

  // Hide the custom menu when clicking anywhere else.
  document.addEventListener("click", () => {
    customMenu.style.display = "none";
  });
})();
