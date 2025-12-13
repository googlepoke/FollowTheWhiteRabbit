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

  // --- To-Do List Persistence ---
  const TODO_STATES_KEY = 'ifsTodoStates';

  // Generate storage key for a todo list item
  function getTodoStorageKey(item) {
    return `${item.pkURL || ''}||${item.callName || ''}`;
  }

  // Load todo state for a specific item
  function loadTodoState(storageKey, callback) {
    chrome.storage.local.get([TODO_STATES_KEY], (result) => {
      const allStates = result[TODO_STATES_KEY] || {};
      const state = allStates[storageKey] || {};
      callback(state);
    });
  }

  // Save todo state for a specific item
  function saveTodoState(storageKey, stateObj) {
    chrome.storage.local.get([TODO_STATES_KEY], (result) => {
      const allStates = result[TODO_STATES_KEY] || {};
      allStates[storageKey] = stateObj;
      chrome.storage.local.set({ [TODO_STATES_KEY]: allStates });
    });
  }

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
      li.textContent = item.callName;
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
            modalBox.style.padding = '16px';
            modalBox.style.borderRadius = '8px';
            modalBox.style.width = 'calc(95vw - 32px)';
            modalBox.style.maxHeight = '95vh';
            modalBox.style.overflow = 'hidden';
            modalBox.style.position = 'relative';
            modalBox.style.zIndex = 999999999;
            modalBox.style.boxSizing = 'border-box';
            modalBox.innerHTML = item.actionParams && item.actionParams.html ? item.actionParams.html : '';
            
            // Auto-resize any iframes to fit modal responsively
            var iframes = modalBox.querySelectorAll('iframe');
            iframes.forEach(function(iframe) {
              iframe.style.width = '100%';
              iframe.style.maxWidth = 'calc(95vw - 40px)';
              iframe.style.height = 'calc(90vh - 60px)';
              iframe.style.border = 'none';
              iframe.style.display = 'block';
            });
            
            var closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '12px';
            closeBtn.style.right = '16px';
            closeBtn.style.fontSize = '28px';
            closeBtn.style.background = 'rgba(255,255,255,0.9)';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.zIndex = 999999999;
            closeBtn.style.width = '32px';
            closeBtn.style.height = '32px';
            closeBtn.style.borderRadius = '50%';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.justifyContent = 'center';
            closeBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            closeBtn.onmouseover = function() { closeBtn.style.background = '#fff'; };
            closeBtn.onmouseout = function() { closeBtn.style.background = 'rgba(255,255,255,0.9)'; };
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
            contentContainer.className = 'ifs-richtext-content';
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

            // Clamp images to fit within modal width
            var images = contentContainer.querySelectorAll('img');
            images.forEach(function(img) {
              img.style.maxWidth = '100%';
              img.style.height = 'auto';
              img.style.display = 'block';
              img.style.margin = '16px auto';
            });

            // Limit content height for tall content
            contentContainer.style.maxHeight = 'calc(90vh - 160px)';
            contentContainer.style.overflow = 'auto';

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
          case 'todoList':
            var todoStorageKey = getTodoStorageKey(item);
            // Normalize items to {label, url?} format for backward compatibility
            var rawTodoItems = (item.actionParams && item.actionParams.items) || [];
            var todoItems = rawTodoItems.map(function(entry) {
              if (typeof entry === 'string') {
                return { label: entry };
              }
              return { label: entry.label, url: entry.url };
            });
            var todoFontSize = (item.actionParams && item.actionParams.fontSize) || 16;
            var todoFontColor = (item.actionParams && item.actionParams.fontColor) || '#333333';

            var todoOverlay = document.createElement('div');
            todoOverlay.className = 'ifs-todo-overlay';
            todoOverlay.style.position = 'fixed';
            todoOverlay.style.top = '0';
            todoOverlay.style.left = '0';
            todoOverlay.style.width = '100vw';
            todoOverlay.style.height = '100vh';
            todoOverlay.style.background = 'rgba(0,0,0,0.5)';
            todoOverlay.style.zIndex = 999999999;
            todoOverlay.style.display = 'flex';
            todoOverlay.style.alignItems = 'center';
            todoOverlay.style.justifyContent = 'center';

            var todoBox = document.createElement('div');
            todoBox.className = 'ifs-todo-modal';
            todoBox.style.background = '#fff';
            todoBox.style.padding = '32px';
            todoBox.style.borderRadius = '12px';
            todoBox.style.maxWidth = '90vw';
            todoBox.style.maxHeight = '90vh';
            todoBox.style.overflow = 'auto';
            todoBox.style.position = 'relative';
            todoBox.style.zIndex = 999999999;
            todoBox.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
            todoBox.style.minWidth = '300px';

            // Title
            var todoTitle = document.createElement('h2');
            todoTitle.textContent = item.callName || 'To Do List';
            todoTitle.style.margin = '0 0 24px 0';
            todoTitle.style.fontSize = Math.min(24, todoFontSize + 8) + 'px';
            todoTitle.style.fontWeight = '600';
            todoTitle.style.color = todoFontColor;
            todoTitle.style.paddingRight = '40px';
            todoBox.appendChild(todoTitle);

            // List container
            var todoList = document.createElement('ul');
            todoList.className = 'ifs-todo-list';
            todoList.style.listStyle = 'none';
            todoList.style.margin = '0';
            todoList.style.padding = '0';

            // Load persisted states and build list
            loadTodoState(todoStorageKey, function(savedStates) {
              todoItems.forEach(function(todoEntry, idx) {
                var li = document.createElement('li');
                li.className = 'ifs-todo-item';
                li.style.display = 'flex';
                li.style.alignItems = 'flex-start';
                li.style.gap = '12px';
                li.style.padding = '8px 0';
                li.style.cursor = 'pointer';

                var checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'ifs-todo-checkbox';
                checkbox.style.width = '20px';
                checkbox.style.height = '20px';
                checkbox.style.marginTop = '2px';
                checkbox.style.cursor = 'pointer';
                checkbox.style.accentColor = '#0365D8';
                checkbox.checked = savedStates[idx] === true;

                // Create text element - anchor if URL exists, span otherwise
                var textElement;
                if (todoEntry.url) {
                  textElement = document.createElement('a');
                  textElement.href = todoEntry.url;
                  textElement.className = 'ifs-todo-text ifs-todo-link';
                  textElement.textContent = todoEntry.label;
                  textElement.style.fontSize = todoFontSize + 'px';
                  textElement.style.color = todoFontColor; // Use default font color, not blue
                  textElement.style.flex = '1';
                  textElement.style.lineHeight = '1.5';
                  textElement.style.textDecoration = 'none';
                  textElement.style.cursor = 'pointer';
                  // Hover underline only - no color change
                  textElement.addEventListener('mouseenter', function() {
                    if (!checkbox.checked) {
                      textElement.style.textDecoration = 'underline';
                    }
                  });
                  textElement.addEventListener('mouseleave', function() {
                    if (!checkbox.checked) {
                      textElement.style.textDecoration = 'none';
                    }
                  });
                  // Click navigates, close modal
                  textElement.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    // Navigate in current tab
                    window.location.href = todoEntry.url;
                    // Close the todo overlay
                    if (todoOverlay.parentNode) {
                      document.body.removeChild(todoOverlay);
                    }
                  });
                  // Keyboard accessibility
                  textElement.addEventListener('keydown', function(ev) {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      ev.stopPropagation();
                      window.location.href = todoEntry.url;
                      if (todoOverlay.parentNode) {
                        document.body.removeChild(todoOverlay);
                      }
                    }
                  });
                } else {
                  textElement = document.createElement('span');
                  textElement.className = 'ifs-todo-text';
                  textElement.textContent = todoEntry.label;
                  textElement.style.fontSize = todoFontSize + 'px';
                  textElement.style.color = todoFontColor;
                  textElement.style.flex = '1';
                  textElement.style.lineHeight = '1.5';
                }

                // Apply strikethrough if checked
                if (checkbox.checked) {
                  li.classList.add('ifs-todo-checked');
                  textElement.style.textDecoration = 'line-through';
                  textElement.style.opacity = '0.6';
                }

                // Toggle handler
                checkbox.addEventListener('change', function() {
                  savedStates[idx] = checkbox.checked;
                  if (checkbox.checked) {
                    li.classList.add('ifs-todo-checked');
                    textElement.style.textDecoration = 'line-through';
                    textElement.style.opacity = '0.6';
                  } else {
                    li.classList.remove('ifs-todo-checked');
                    textElement.style.textDecoration = 'none';
                    textElement.style.opacity = '1';
                  }
                  saveTodoState(todoStorageKey, savedStates);
                });

                // Click on row toggles checkbox (but not on links)
                li.addEventListener('click', function(ev) {
                  if (ev.target !== checkbox && !ev.target.classList.contains('ifs-todo-link')) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                  }
                });

                li.appendChild(checkbox);
                li.appendChild(textElement);
                todoList.appendChild(li);
              });
            });

            todoBox.appendChild(todoList);

            // Close button
            var todoCloseBtn = document.createElement('button');
            todoCloseBtn.innerHTML = '&times;';
            todoCloseBtn.style.position = 'absolute';
            todoCloseBtn.style.top = '20px';
            todoCloseBtn.style.right = '24px';
            todoCloseBtn.style.fontSize = '28px';
            todoCloseBtn.style.background = 'none';
            todoCloseBtn.style.border = 'none';
            todoCloseBtn.style.cursor = 'pointer';
            todoCloseBtn.style.color = '#666';
            todoCloseBtn.style.zIndex = 999999999;
            todoCloseBtn.style.width = '32px';
            todoCloseBtn.style.height = '32px';
            todoCloseBtn.style.borderRadius = '50%';
            todoCloseBtn.style.display = 'flex';
            todoCloseBtn.style.alignItems = 'center';
            todoCloseBtn.style.justifyContent = 'center';
            todoCloseBtn.style.transition = 'all 0.2s ease';

            todoCloseBtn.onmouseover = function() {
              todoCloseBtn.style.backgroundColor = 'rgba(0,0,0,0.1)';
            };
            todoCloseBtn.onmouseout = function() {
              todoCloseBtn.style.backgroundColor = 'transparent';
            };

            todoCloseBtn.onclick = function() {
              document.body.removeChild(todoOverlay);
            };

            todoBox.appendChild(todoCloseBtn);
            todoOverlay.appendChild(todoBox);

            // Close on overlay click
            todoOverlay.addEventListener('click', function(ev) {
              if (ev.target === todoOverlay) document.body.removeChild(todoOverlay);
            });

            document.body.appendChild(todoOverlay);
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

      // Middle-click to open URL in new tab (only for openUrl action type)
      li.addEventListener("auxclick", function(e) {
        if (e.button === 1 && item.actionType === 'openUrl' && item.url) {
          e.preventDefault();
          e.stopPropagation();
          customMenu.style.display = "none";
          chrome.runtime.sendMessage({
            action: "navigate",
            url: item.url,
            currentTab: false  // Always open in new tab
          });
        }
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
