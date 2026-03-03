(function() {
  // --- Utility Functions ---

  // Asynchronously load items from chrome.storage.local, filtered by active profile.
  function loadItems(callback) {
    chrome.storage.local.get(['ifsQuickCallItems', 'ifsActiveProfile'], (result) => {
      const items = result.ifsQuickCallItems || [];
      const activeProfile = result.ifsActiveProfile || '';
      const profileItems = activeProfile
        ? items.filter(item => item.profiles && item.profiles.includes(activeProfile))
        : items;
      callback(profileItems);
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
      .custom-context-menu li:hover,
      .ifs-todo-item:hover {
        background-color: ${bgColor} !important;
        color: ${textColor} !important;
      }
      .ifs-todo-item:hover .ifs-todo-text,
      .ifs-todo-item:hover .ifs-todo-link {
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

  // --- Sticky Note Persistence ---
  const NOTE_STATES_KEY = 'ifsNoteStates';

  // Generate storage key for a note item
  function getNoteStorageKey(item) {
    return `${item.pkURL || ''}||${item.callName || ''}`;
  }

  // Load note state for a specific item
  function loadNoteState(storageKey, callback) {
    chrome.storage.local.get([NOTE_STATES_KEY], (result) => {
      const allStates = result[NOTE_STATES_KEY] || {};
      const state = allStates[storageKey] || {};
      callback(state);
    });
  }

  // Save note state for a specific item
  function saveNoteState(storageKey, stateObj) {
    chrome.storage.local.get([NOTE_STATES_KEY], (result) => {
      const allStates = result[NOTE_STATES_KEY] || {};
      allStates[storageKey] = stateObj;
      chrome.storage.local.set({ [NOTE_STATES_KEY]: allStates });
    });
  }

  // Debounce utility for note text input
  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Track active notes to prevent duplicates and manage z-index
  const activeNotes = new Map();

  // Filter items based on the active URL using wildcard support.
  // It converts the pkURL (which can include *) into a regular expression.
  function filterItemsForCurrentUrl(activeUrl, items) {
    return items.filter(item => {
      // Skip hidden items
      if (item.hidden) return false;
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
                if (todoEntry.label === '---') {
                  var li = document.createElement('li');
                  li.className = 'ifs-todo-divider';
                  li.style.listStyle = 'none';
                  li.style.padding = '8px 0';
                  li.style.cursor = 'default';
                  var hr = document.createElement('hr');
                  hr.style.border = 'none';
                  hr.style.height = '4px';
                  hr.style.margin = '0';
                  hr.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.15) 40%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0.85))';
                  hr.style.borderRadius = '2px';
                  li.appendChild(hr);
                  todoList.appendChild(li);
                  return;
                }
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
          case 'note':
            var noteStorageKey = getNoteStorageKey(item);
            var defaultColor = (item.actionParams && item.actionParams.defaultColor) || '#FFEB3B';
            var defaultText = (item.actionParams && item.actionParams.defaultText) || '';

            // Color presets for the palette
            var noteColorPresets = [
              { value: '#FFEB3B', name: 'Yellow' },
              { value: '#F48FB1', name: 'Pink' },
              { value: '#81D4FA', name: 'Blue' },
              { value: '#A5D6A7', name: 'Green' },
              { value: '#FFCC80', name: 'Orange' },
              { value: '#E1BEE7', name: 'Purple' }
            ];

            // Check if note is already open - bring to front if so
            if (activeNotes.has(noteStorageKey)) {
              var existingNote = activeNotes.get(noteStorageKey);
              if (existingNote && existingNote.parentNode) {
                // Bring to front by updating z-index
                var maxZ = 999999998;
                activeNotes.forEach(function(n) {
                  var z = parseInt(n.style.zIndex) || 0;
                  if (z > maxZ) maxZ = z;
                });
                existingNote.style.zIndex = maxZ + 1;
                return;
              }
            }

            // Load saved state and create note
            loadNoteState(noteStorageKey, function(savedState) {
              var noteColor = savedState.color || defaultColor;
              var noteText = savedState.text !== undefined ? savedState.text : defaultText;
              var noteX = savedState.x !== undefined ? savedState.x : 100;
              var noteY = savedState.y !== undefined ? savedState.y : 100;

              // Clamp position to viewport
              noteX = Math.max(0, Math.min(noteX, window.innerWidth - 300));
              noteY = Math.max(0, Math.min(noteY, window.innerHeight - 220));

              // Create note container
              var noteElement = document.createElement('div');
              noteElement.className = 'ifs-sticky-note';
              noteElement.style.backgroundColor = noteColor;
              noteElement.style.left = noteX + 'px';
              noteElement.style.top = noteY + 'px';

              // Header with title and close button
              var noteHeader = document.createElement('div');
              noteHeader.className = 'ifs-sticky-note-header';

              var noteTitle = document.createElement('span');
              noteTitle.className = 'ifs-sticky-note-title';
              noteTitle.textContent = item.callName || 'Note';

              var noteCloseBtn = document.createElement('button');
              noteCloseBtn.className = 'ifs-sticky-note-close';
              noteCloseBtn.innerHTML = '&times;';
              noteCloseBtn.title = 'Close note';

              noteHeader.appendChild(noteTitle);
              noteHeader.appendChild(noteCloseBtn);

              // Color palette
              var noteColors = document.createElement('div');
              noteColors.className = 'ifs-sticky-note-colors';

              noteColorPresets.forEach(function(preset) {
                var colorBtn = document.createElement('button');
                colorBtn.className = 'ifs-sticky-note-color-btn';
                if (preset.value === noteColor) {
                  colorBtn.classList.add('active');
                }
                colorBtn.style.backgroundColor = preset.value;
                colorBtn.title = preset.name;

                colorBtn.addEventListener('click', function(ev) {
                  ev.stopPropagation();
                  // Update active state
                  noteColors.querySelectorAll('.ifs-sticky-note-color-btn').forEach(function(btn) {
                    btn.classList.remove('active');
                  });
                  colorBtn.classList.add('active');
                  // Change note color
                  noteElement.style.backgroundColor = preset.value;
                  // Persist color
                  savedState.color = preset.value;
                  saveNoteState(noteStorageKey, savedState);
                });

                noteColors.appendChild(colorBtn);
              });

              // Note body with textarea
              var noteBody = document.createElement('div');
              noteBody.className = 'ifs-sticky-note-body';

              var noteTextarea = document.createElement('textarea');
              noteTextarea.className = 'ifs-sticky-note-textarea';
              noteTextarea.placeholder = 'Write your note here...';
              noteTextarea.value = noteText;

              // Debounced save for text input
              var debouncedSaveText = debounce(function() {
                savedState.text = noteTextarea.value;
                saveNoteState(noteStorageKey, savedState);
              }, 300);

              noteTextarea.addEventListener('input', debouncedSaveText);

              noteBody.appendChild(noteTextarea);

              // Assemble note
              noteElement.appendChild(noteHeader);
              noteElement.appendChild(noteColors);
              noteElement.appendChild(noteBody);

              // Drag functionality
              var isDragging = false;
              var dragOffsetX = 0;
              var dragOffsetY = 0;

              noteHeader.addEventListener('mousedown', function(ev) {
                if (ev.target === noteCloseBtn) return;
                isDragging = true;
                dragOffsetX = ev.clientX - noteElement.offsetLeft;
                dragOffsetY = ev.clientY - noteElement.offsetTop;
                noteElement.style.cursor = 'grabbing';
                
                // Bring to front on drag start
                var maxZ = 999999998;
                activeNotes.forEach(function(n) {
                  var z = parseInt(n.style.zIndex) || 0;
                  if (z > maxZ) maxZ = z;
                });
                noteElement.style.zIndex = maxZ + 1;

                ev.preventDefault();
              });

              document.addEventListener('mousemove', function(ev) {
                if (!isDragging) return;
                var newX = ev.clientX - dragOffsetX;
                var newY = ev.clientY - dragOffsetY;

                // Clamp to viewport
                newX = Math.max(0, Math.min(newX, window.innerWidth - noteElement.offsetWidth));
                newY = Math.max(0, Math.min(newY, window.innerHeight - noteElement.offsetHeight));

                noteElement.style.left = newX + 'px';
                noteElement.style.top = newY + 'px';
              });

              document.addEventListener('mouseup', function() {
                if (isDragging) {
                  isDragging = false;
                  noteElement.style.cursor = '';
                  // Persist position
                  savedState.x = parseInt(noteElement.style.left);
                  savedState.y = parseInt(noteElement.style.top);
                  saveNoteState(noteStorageKey, savedState);
                }
              });

              // Close button handler
              noteCloseBtn.addEventListener('click', function() {
                noteElement.remove();
                activeNotes.delete(noteStorageKey);
              });

              // Bring to front on click
              noteElement.addEventListener('mousedown', function() {
                var maxZ = 999999998;
                activeNotes.forEach(function(n) {
                  var z = parseInt(n.style.zIndex) || 0;
                  if (z > maxZ) maxZ = z;
                });
                noteElement.style.zIndex = maxZ + 1;
              });

              // Add to DOM and track
              document.body.appendChild(noteElement);
              activeNotes.set(noteStorageKey, noteElement);
            });
            break;
          case 'markdown':
            var mdOverlay = document.createElement('div');
            mdOverlay.style.position = 'fixed';
            mdOverlay.style.top = '0';
            mdOverlay.style.left = '0';
            mdOverlay.style.width = '100vw';
            mdOverlay.style.height = '100vh';
            mdOverlay.style.background = 'rgba(0,0,0,0.5)';
            mdOverlay.style.zIndex = 999999999;
            mdOverlay.style.display = 'flex';
            mdOverlay.style.alignItems = 'center';
            mdOverlay.style.justifyContent = 'center';
            mdOverlay.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

            var mdBox = document.createElement('div');
            mdBox.style.background = '#ffffff';
            mdBox.style.padding = '32px';
            mdBox.style.borderRadius = '12px';
            mdBox.style.maxWidth = '90vw';
            mdBox.style.maxHeight = '90vh';
            mdBox.style.overflow = 'auto';
            mdBox.style.position = 'relative';
            mdBox.style.zIndex = 999999999;
            mdBox.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
            mdBox.style.width = '800px';

            var mdContent = document.createElement('div');
            mdContent.className = 'ifs-markdown-content';
            mdContent.style.lineHeight = '1.7';
            mdContent.style.color = '#333';
            mdContent.style.fontSize = '16px';
            mdContent.style.maxHeight = 'calc(90vh - 100px)';
            mdContent.style.overflow = 'auto';
            mdContent.style.paddingRight = '40px';

            var rawMd = (item.actionParams && item.actionParams.markdownText) || '';
            if (typeof marked !== 'undefined' && marked.parse) {
              mdContent.innerHTML = marked.parse(rawMd);
            } else {
              mdContent.textContent = rawMd;
            }

            mdBox.appendChild(mdContent);

            var mdCloseBtn = document.createElement('button');
            mdCloseBtn.innerHTML = '&times;';
            mdCloseBtn.style.position = 'absolute';
            mdCloseBtn.style.top = '20px';
            mdCloseBtn.style.right = '24px';
            mdCloseBtn.style.fontSize = '28px';
            mdCloseBtn.style.background = 'none';
            mdCloseBtn.style.border = 'none';
            mdCloseBtn.style.cursor = 'pointer';
            mdCloseBtn.style.color = '#666';
            mdCloseBtn.style.zIndex = 999999999;
            mdCloseBtn.style.width = '32px';
            mdCloseBtn.style.height = '32px';
            mdCloseBtn.style.borderRadius = '50%';
            mdCloseBtn.style.display = 'flex';
            mdCloseBtn.style.alignItems = 'center';
            mdCloseBtn.style.justifyContent = 'center';
            mdCloseBtn.style.transition = 'all 0.2s ease';
            mdCloseBtn.onmouseover = function() { mdCloseBtn.style.backgroundColor = 'rgba(0,0,0,0.1)'; };
            mdCloseBtn.onmouseout = function() { mdCloseBtn.style.backgroundColor = 'transparent'; };
            mdCloseBtn.onclick = function() { document.body.removeChild(mdOverlay); };
            mdBox.appendChild(mdCloseBtn);

            mdOverlay.appendChild(mdBox);
            mdOverlay.addEventListener('click', function(ev) {
              if (ev.target === mdOverlay) document.body.removeChild(mdOverlay);
            });
            document.body.appendChild(mdOverlay);
            break;
          case 'publishedPageUrl':
            var ppUrl = (item.actionParams && item.actionParams.pageUrl) || '';
            if (!ppUrl) break;

            if (item.actionParams.incognito) {
              chrome.runtime.sendMessage({ action: "openIncognito", url: ppUrl });
              break;
            }

            var ppOverlay = document.createElement('div');
            ppOverlay.className = 'ifs-published-page-overlay';
            ppOverlay.style.position = 'fixed';
            ppOverlay.style.top = '0';
            ppOverlay.style.left = '0';
            ppOverlay.style.width = '100vw';
            ppOverlay.style.height = '100vh';
            ppOverlay.style.background = 'rgba(0,0,0,0.6)';
            ppOverlay.style.zIndex = 999999999;
            ppOverlay.style.display = 'flex';
            ppOverlay.style.alignItems = 'center';
            ppOverlay.style.justifyContent = 'center';

            var ppBox = document.createElement('div');
            ppBox.className = 'ifs-published-page-modal';
            ppBox.style.background = '#fff';
            ppBox.style.borderRadius = '12px';
            ppBox.style.width = '95vw';
            ppBox.style.height = '90vh';
            ppBox.style.position = 'relative';
            ppBox.style.zIndex = 999999999;
            ppBox.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
            ppBox.style.overflow = 'hidden';
            ppBox.style.display = 'flex';
            ppBox.style.flexDirection = 'column';

            var ppIframe = document.createElement('iframe');
            ppIframe.src = ppUrl;
            ppIframe.style.width = '100%';
            ppIframe.style.flex = '1';
            ppIframe.style.border = 'none';
            ppIframe.style.borderRadius = '0 0 12px 12px';
            ppIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');

            var ppFallbackShown = false;
            var ppFallbackTimer = setTimeout(function() {
              if (!ppFallbackShown) {
                ppFallbackShown = true;
                var fallbackBar = document.createElement('div');
                fallbackBar.style.padding = '8px 16px';
                fallbackBar.style.background = '#fff3cd';
                fallbackBar.style.color = '#856404';
                fallbackBar.style.fontSize = '13px';
                fallbackBar.style.display = 'flex';
                fallbackBar.style.alignItems = 'center';
                fallbackBar.style.gap = '12px';
                fallbackBar.textContent = 'Page may not support embedded viewing. ';
                var fallbackBtn = document.createElement('button');
                fallbackBtn.textContent = 'Open in new window';
                fallbackBtn.style.background = '#0365D8';
                fallbackBtn.style.color = '#fff';
                fallbackBtn.style.border = 'none';
                fallbackBtn.style.padding = '4px 12px';
                fallbackBtn.style.borderRadius = '4px';
                fallbackBtn.style.cursor = 'pointer';
                fallbackBtn.style.fontSize = '13px';
                fallbackBtn.onclick = function() {
                  window.open(ppUrl, '_blank', 'width=1200,height=800,toolbar=no,menubar=no,scrollbars=yes,resizable=yes');
                  document.body.removeChild(ppOverlay);
                };
                fallbackBar.appendChild(fallbackBtn);
                ppBox.insertBefore(fallbackBar, ppIframe);
              }
            }, 5000);

            ppIframe.addEventListener('load', function() {
              clearTimeout(ppFallbackTimer);
            });

            ppBox.appendChild(ppIframe);

            var ppCloseBtn = document.createElement('button');
            ppCloseBtn.innerHTML = '&times;';
            ppCloseBtn.style.position = 'absolute';
            ppCloseBtn.style.top = '10px';
            ppCloseBtn.style.right = '16px';
            ppCloseBtn.style.fontSize = '28px';
            ppCloseBtn.style.background = 'rgba(255,255,255,0.9)';
            ppCloseBtn.style.border = 'none';
            ppCloseBtn.style.cursor = 'pointer';
            ppCloseBtn.style.color = '#333';
            ppCloseBtn.style.zIndex = 999999999;
            ppCloseBtn.style.width = '36px';
            ppCloseBtn.style.height = '36px';
            ppCloseBtn.style.borderRadius = '50%';
            ppCloseBtn.style.display = 'flex';
            ppCloseBtn.style.alignItems = 'center';
            ppCloseBtn.style.justifyContent = 'center';
            ppCloseBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            ppCloseBtn.style.transition = 'all 0.2s ease';
            ppCloseBtn.onmouseover = function() { ppCloseBtn.style.background = '#fff'; };
            ppCloseBtn.onmouseout = function() { ppCloseBtn.style.background = 'rgba(255,255,255,0.9)'; };
            ppCloseBtn.onclick = function() {
              clearTimeout(ppFallbackTimer);
              document.body.removeChild(ppOverlay);
            };
            ppBox.appendChild(ppCloseBtn);

            ppOverlay.appendChild(ppBox);
            ppOverlay.addEventListener('click', function(ev) {
              if (ev.target === ppOverlay) {
                clearTimeout(ppFallbackTimer);
                document.body.removeChild(ppOverlay);
              }
            });
            document.body.appendChild(ppOverlay);
            break;
          case 'imageSlideshow':
            var slideImages = (item.actionParams && item.actionParams.images && Array.isArray(item.actionParams.images)) ? item.actionParams.images : [];
            if (slideImages.length === 0) break;

            var slideOverlay = document.createElement('div');
            slideOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.9);z-index:999999999;display:flex;align-items:center;justify-content:center;';

            var slideFrame = document.createElement('div');
            slideFrame.style.cssText = 'position:relative;width:100%;max-width:min(100vw, 177.78vh);max-height:min(100vh, 56.25vw);aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#000;';

            var slideImg = document.createElement('img');
            slideImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;object-position:center;';
            slideImg.src = slideImages[0];
            slideImg.alt = 'Slide 1';

            var slideIdx = 0;
            function slideShowImg() {
              slideImg.src = slideImages[slideIdx];
              slideImg.alt = 'Slide ' + (slideIdx + 1);
              if (slideCounter) slideCounter.textContent = (slideIdx + 1) + ' / ' + slideImages.length;
            }

            var slideCounter = document.createElement('div');
            slideCounter.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.8);font-size:14px;z-index:10;';
            slideCounter.textContent = '1 / ' + slideImages.length;

            var fullscreenBtn = document.createElement('button');
            fullscreenBtn.innerHTML = '&#x26F6;';
            fullscreenBtn.title = 'Fullscreen';
            fullscreenBtn.style.cssText = 'position:absolute;top:12px;right:48px;font-size:20px;background:rgba(255,255,255,0.2);border:none;color:#fff;cursor:pointer;width:36px;height:36px;border-radius:4px;z-index:10;display:flex;align-items:center;justify-content:center;';
            fullscreenBtn.onclick = function() {
              if (slideFrame.requestFullscreen) {
                slideFrame.requestFullscreen().catch(function() {});
              }
            };

            var closeSlideBtn = document.createElement('button');
            closeSlideBtn.innerHTML = '&times;';
            closeSlideBtn.style.cssText = 'position:absolute;top:12px;right:12px;font-size:28px;background:rgba(255,255,255,0.2);border:none;color:#fff;cursor:pointer;width:36px;height:36px;border-radius:4px;z-index:10;display:flex;align-items:center;justify-content:center;line-height:1;';
            closeSlideBtn.onclick = function() {
              document.removeEventListener('keydown', slideKeyHandler);
              if (document.fullscreenElement === slideFrame && document.exitFullscreen) document.exitFullscreen();
              document.body.removeChild(slideOverlay);
            };

            slideFrame.appendChild(slideImg);
            slideFrame.appendChild(slideCounter);
            slideFrame.appendChild(fullscreenBtn);
            slideFrame.appendChild(closeSlideBtn);
            slideOverlay.appendChild(slideFrame);

            var slideKeyHandler = function(e) {
              if (e.key === 'Escape') {
                if (document.fullscreenElement === slideFrame && document.exitFullscreen) {
                  document.exitFullscreen();
                } else {
                  document.removeEventListener('keydown', slideKeyHandler);
                  document.body.removeChild(slideOverlay);
                }
                e.preventDefault();
                return;
              }
              if (e.key === 'ArrowLeft') {
                slideIdx = slideIdx <= 0 ? 0 : slideIdx - 1;
                slideShowImg();
                e.preventDefault();
              } else if (e.key === 'ArrowRight') {
                slideIdx = slideIdx >= slideImages.length - 1 ? slideImages.length - 1 : slideIdx + 1;
                slideShowImg();
                e.preventDefault();
              }
            };
            document.addEventListener('keydown', slideKeyHandler);

            slideOverlay.addEventListener('click', function(ev) {
              if (ev.target === slideOverlay) {
                document.removeEventListener('keydown', slideKeyHandler);
                if (document.fullscreenElement === slideFrame && document.exitFullscreen) document.exitFullscreen();
                document.body.removeChild(slideOverlay);
              }
            });

            document.body.appendChild(slideOverlay);
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
        console.error("Error retrieving active URL:", chrome.runtime.lastError.message || chrome.runtime.lastError);
      }
      const activeUrl = (response && response.activeUrl) ? response.activeUrl : "";
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
