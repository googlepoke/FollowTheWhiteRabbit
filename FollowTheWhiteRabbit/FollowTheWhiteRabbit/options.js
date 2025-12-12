// options.js

// Define a storage key for the list items.
const STORAGE_KEY = 'ifsQuickCallItems';

// Define storage key and defaults for hover settings.
const HOVER_SETTINGS_KEY = 'ifsHoverSettings';
const DEFAULT_HOVER_BG = '#0365D8';
const DEFAULT_HOVER_TEXT = '#FFFFFF';

// Load hover settings from chrome.storage.local.
function loadHoverSettings(callback) {
  chrome.storage.local.get([HOVER_SETTINGS_KEY], (result) => {
    const settings = result[HOVER_SETTINGS_KEY] || {
      hoverBgColor: DEFAULT_HOVER_BG,
      hoverTextColor: DEFAULT_HOVER_TEXT
    };
    callback(settings);
  });
}

// Save hover settings to chrome.storage.local.
function saveHoverSettings(settings, callback) {
  let data = {};
  data[HOVER_SETTINGS_KEY] = settings;
  chrome.storage.local.set(data, callback);
}

// Load items from chrome.storage.local.
function loadItems(callback) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const items = result[STORAGE_KEY] || [];
    callback(items);
  });
}

// Save items to chrome.storage.local.
function saveItems(items, callback) {
  let data = {};
  data[STORAGE_KEY] = items;
  chrome.storage.local.set(data, callback);
}

// Utility: Filter items based on the active URL using wildcard support (copied from content.js)
function filterItemsForCurrentUrl(activeUrl, items) {
  return items.filter(item => {
    const pkURL = item.pkURL.trim();
    const pattern = pkURL
      .replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp('^' + pattern + '$');
    return regex.test(activeUrl);
  });
}

// Get the active tab's URL (returns a Promise)
function getActiveTabUrl() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getActiveTabUrl' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve('');
      } else {
        resolve(response.activeUrl || '');
      }
    });
  });
}

// Render list items in the table, with filtering
async function renderItems() {
  const showAll = document.getElementById('showAllLinks').checked;
  loadItems(async (items) => {
    let filteredItems = items;
    if (!showAll) {
      const activeUrl = await getActiveTabUrl();
      filteredItems = filterItemsForCurrentUrl(activeUrl, items);
    }
    const tbody = document.getElementById('itemsBody');
    tbody.innerHTML = '';
    filteredItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      // Drag handle
      const tdHandle = document.createElement('td');
      tdHandle.innerHTML = '<span class="drag-handle" style="cursor:move;">&#9776;</span>';
      tr.appendChild(tdHandle);
      // Only Call Name
      const tdCallName = document.createElement('td');
      tdCallName.textContent = item.callName;
      tr.appendChild(tdCallName);
      // Actions
      const tdActions = document.createElement('td');
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn btn-sm btn-outline-primary me-2';
      editBtn.onclick = () => openModal('edit', items.indexOf(item));
      tdActions.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.onclick = () => {
        if (confirm('Are you sure you want to delete this item?')) {
          deleteItem(items.indexOf(item));
        }
      };
      tdActions.appendChild(deleteBtn);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
    // Initialize SortableJS for drag-and-drop
    if (window.Sortable) {
      if (window.itemsSortable) {
        window.itemsSortable.destroy();
      }
      window.itemsSortable = Sortable.create(tbody, {
        handle: '.drag-handle',
        animation: 150,
        onEnd: function (evt) {
          // Get the new order of visible (filtered) items from the DOM
          const newFilteredOrder = Array.from(tbody.children).map(row => row.children[1].textContent);
          loadItems((items) => {
            // Determine which items are currently visible (filtered)
            let showAll = document.getElementById('showAllLinks').checked;
            let filteredItems = items;
            if (!showAll) {
              // Use the same filtering as in renderItems
              getActiveTabUrl().then(activeUrl => {
                filteredItems = filterItemsForCurrentUrl(activeUrl, items);
                // Reorder filtered items in the full items array
                const filteredMap = {};
                filteredItems.forEach(item => { filteredMap[item.callName] = item; });
                // Build new filtered order
                const newFilteredItems = newFilteredOrder.map(name => filteredMap[name]);
                // Build new full items array
                let newItems = [];
                let filteredIdx = 0;
                for (let i = 0; i < items.length; i++) {
                  if (filteredItems.includes(items[i])) {
                    newItems.push(newFilteredItems[filteredIdx++]);
                  } else {
                    newItems.push(items[i]);
                  }
                }
                saveItems(newItems, renderItems);
              });
            } else {
              // If showing all, reorder the full array
              const nameToItem = {};
              items.forEach(item => { nameToItem[item.callName] = item; });
              const newItems = newFilteredOrder.map(name => nameToItem[name]);
              saveItems(newItems, renderItems);
            }
          });
        }
      });
    }
  });
}

// Delete an item at the given index.
function deleteItem(index) {
  loadItems((items) => {
    items.splice(index, 1);
    saveItems(items, renderItems);
  });
}

// Modal dialog handling.
const modal = document.getElementById('modalDialog');
const closeModalSpan = document.querySelector('.close');

closeModalSpan.onclick = closeModal;

window.onclick = function(event) {
  if (event.target == modal) {
    closeModal();
  }
};

function closeModal() {
  modal.style.display = 'none';
  document.getElementById('itemForm').reset();
  document.getElementById('editIndex').value = '';
}

// --- Dynamic Action Params UI ---
const actionTypeInput = document.getElementById('actionType');
const actionParamsContainer = document.getElementById('actionParamsContainer');
const urlInput = document.getElementById('url');

function renderActionParamsFields(actionType, params = {}) {
  actionParamsContainer.innerHTML = '';
  urlInput.disabled = actionType !== 'openUrl';
  if (actionType === 'alert') {
    actionParamsContainer.innerHTML = '<label>Alert Text:</label><input type="text" id="param_alert_text" class="form-control" value="' + (params.text || '') + '">';
  } else if (actionType === 'logToConsole') {
    actionParamsContainer.innerHTML = '<label>Console Message:</label><input type="text" id="param_console_message" class="form-control" value="' + (params.message || '') + '">';
  } else if (actionType === 'injectBanner') {
    actionParamsContainer.innerHTML = '<label>Banner Text:</label><input type="text" id="param_banner_text" class="form-control" value="' + (params.text || '') + '">';
  } else if (actionType === 'customHtmlModal') {
    actionParamsContainer.innerHTML = '<label>Custom HTML:</label><textarea id="param_html" class="form-control" rows="4">' + (params.html || '') + '</textarea>';
  } else if (actionType === 'richTextModal') {
    const fontOptions = [
      { value: 'Inter', label: 'Inter' },
      { value: 'Roboto', label: 'Roboto' },
      { value: 'Open Sans', label: 'Open Sans' },
      { value: 'Lato', label: 'Lato' },
      { value: 'Poppins', label: 'Poppins' },
      { value: 'Arial', label: 'Arial' },
      { value: 'Helvetica', label: 'Helvetica' },
      { value: 'Georgia', label: 'Georgia' },
      { value: 'Times New Roman', label: 'Times New Roman' }
    ];
    
    let fontSelectOptions = fontOptions.map(font => 
      `<option value="${font.value}" ${(params.fontFamily || 'Inter') === font.value ? 'selected' : ''}>${font.label}</option>`
    ).join('');

    actionParamsContainer.innerHTML = `
      <div class="row mb-3">
        <div class="col-md-6">
          <label>Modal Title:</label>
          <input type="text" id="param_richtext_title" class="form-control" value="${params.title || 'Rich Text Modal'}" placeholder="Modal Title">
        </div>
        <div class="col-md-6">
          <label>Font Family:</label>
          <select id="param_richtext_fontfamily" class="form-control">${fontSelectOptions}</select>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-4">
          <label>Font Size (px):</label>
          <input type="number" id="param_richtext_fontsize" class="form-control" min="8" max="72" value="${params.fontSize || 16}">
        </div>
        <div class="col-md-4">
          <label>Text Color:</label>
          <input type="color" id="param_richtext_color" class="form-control form-control-color" value="${params.textColor || '#333333'}">
        </div>
        <div class="col-md-4">
          <label>Background Color:</label>
          <input type="color" id="param_richtext_bgcolor" class="form-control form-control-color" value="${params.backgroundColor || '#ffffff'}">
        </div>
      </div>
      <div class="mb-3">
        <label>Content:</label>
        <div id="richtext-editor" style="height: 200px; border: 1px solid #ced4da; border-radius: 0.375rem;"></div>
        <input type="hidden" id="param_richtext_content" value="">
      </div>
    `;
    
    // Note: Quill editor will be initialized separately to avoid conflicts
  } else if (actionType === 'functionCall') {
    actionParamsContainer.innerHTML = '<label>Function Name:</label><input type="text" id="param_function_name" class="form-control" value="' + (params.functionName || '') + '" placeholder="e.g., goBack"><label>Function Type:</label><select id="param_function_type" class="form-control"><option value="complete" ' + (params.functionType === 'complete' ? 'selected' : '') + '>Complete Definition</option><option value="body" ' + (params.functionType === 'body' ? 'selected' : '') + '>Function Body Only</option></select><label>Function Code:</label><textarea id="param_function_code" class="form-control" rows="6" placeholder="Enter your JavaScript code here...">' + (params.functionCode || '') + '</textarea>';
  } else if (actionType === 'countdownClock') {
    actionParamsContainer.innerHTML = '<label>Countdown Duration (minutes):</label><input type="number" id="param_countdown_minutes" class="form-control" min="1" value="' + (params.minutes || 1) + '"><label>Label/Message (optional):</label><input type="text" id="param_countdown_label" class="form-control" value="' + (params.label || '') + '">';
  }
}

if (actionTypeInput) {
  actionTypeInput.addEventListener('change', function() {
    // Clean up existing Quill editor when changing action type
    if (window.richTextQuillEditor) {
      window.richTextQuillEditor = null;
    }
    renderActionParamsFields(this.value);
    
    // Initialize rich text editor if richTextModal is selected
    if (this.value === 'richTextModal') {
      setTimeout(() => initializeRichTextEditor(), 500);
    }
  });
}

// Function to initialize rich text editor
function initializeRichTextEditor(existingParams = {}) {
  console.log('Attempting to initialize Quill editor...');
  
  // Clean up any existing editor first
  if (window.richTextQuillEditor) {
    console.log('Cleaning up existing Quill editor');
    try {
      delete window.richTextQuillEditor;
    } catch (e) {
      console.log('Error cleaning up editor:', e);
    }
    window.richTextQuillEditor = null;
  }
  
  const editorElement = document.getElementById('richtext-editor');
  console.log('Editor element found:', !!editorElement);
  console.log('Quill available:', typeof Quill !== 'undefined');
  
  if (typeof Quill !== 'undefined' && editorElement) {
    try {
      // Clear any existing Quill content/classes
      editorElement.innerHTML = '';
      editorElement.className = '';
      
      const quill = new Quill('#richtext-editor', {
        theme: 'snow',
        placeholder: 'Click here to start typing your rich text content...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'align': [] }],
            ['link'],
            [{ 'color': [] }, { 'background': [] }],
            ['clean']
          ]
        }
      });
      
      console.log('Quill editor created successfully');
      
      // Set initial content if exists
      if (existingParams.content) {
        try {
          const content = JSON.parse(existingParams.content);
          quill.setContents(content);
          console.log('Existing content loaded');
        } catch (e) {
          console.log('Could not parse existing content, starting fresh:', e);
        }
      }
      
      // Store reference for form submission
      window.richTextQuillEditor = quill;
      
      // Add event listener to update hidden input for form submission
      quill.on('text-change', function(delta, oldDelta, source) {
        console.log('Text changed in editor');
        const hiddenInput = document.getElementById('param_richtext_content');
        if (hiddenInput) {
          hiddenInput.value = JSON.stringify(quill.getContents());
        }
      });
      
      // Focus the editor after a short delay
      setTimeout(() => {
        quill.focus();
        console.log('Editor focused');
      }, 200);
      
      return true;
    } catch (error) {
      console.error('Error initializing Quill editor:', error);
      return false;
    }
  } else {
    console.error('Cannot initialize Quill: Missing Quill library or editor element');
    return false;
  }
}

// --- Modal logic update ---
function openModal(mode, index) {
  const modalTitle = document.getElementById('modalTitle');
  const editIndexInput = document.getElementById('editIndex');
  if (mode === 'add') {
    modalTitle.textContent = 'Add New Item';
    editIndexInput.value = '';
    document.getElementById('callName').value = '';
    document.getElementById('pkURL').value = '';
    urlInput.value = '';
    document.getElementById('currentTab').checked = false;
    actionTypeInput.value = 'alert';
    renderActionParamsFields('alert');
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        document.getElementById('pkURL').value = currentUrl;
        urlInput.value = currentUrl;
      }
    });
  } else if (mode === 'edit') {
    modalTitle.textContent = 'Edit Item';
    loadItems((items) => {
      const item = items[index];
      editIndexInput.value = index;
      document.getElementById('pkURL').value = item.pkURL;
      document.getElementById('callName').value = item.callName;
      urlInput.value = item.url || '';
      document.getElementById('currentTab').checked = item.currentTab;
      actionTypeInput.value = item.actionType || 'alert';
      renderActionParamsFields(item.actionType || 'alert', item.actionParams || {});
      
      // Initialize rich text editor if this is a rich text modal
      if ((item.actionType || 'alert') === 'richTextModal') {
        setTimeout(() => {
          initializeRichTextEditor(item.actionParams || {});
        }, 600);
      }
    });
  }
  modal.style.display = 'block';
  
  // Additional initialization for rich text editor when modal is shown (for add mode only)
  setTimeout(() => {
    if (actionTypeInput.value === 'richTextModal' && mode === 'add') {
      initializeRichTextEditor({});
    }
  }, 600);
}

// Fallback to ensure rich text editor is initialized when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Check every second for rich text editor that needs initialization
  const checkForEditor = setInterval(() => {
    const actionType = document.getElementById('actionType');
    const editorElement = document.getElementById('richtext-editor');
    
    if (actionType && actionType.value === 'richTextModal' && 
        editorElement && !window.richTextQuillEditor && 
        typeof Quill !== 'undefined') {
      console.log('Fallback: Initializing Quill editor');
      if (initializeRichTextEditor()) {
        clearInterval(checkForEditor);
      }
    }
  }, 1000);
  
  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkForEditor), 10000);
});

// --- Form submission update ---
document.getElementById('itemForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const pkURL = document.getElementById('pkURL').value.trim();
  const callName = document.getElementById('callName').value.trim();
  const url = document.getElementById('url').value.trim();
  const currentTab = document.getElementById('currentTab').checked;
  const actionType = actionTypeInput.value;
  let actionParams = {};
  if (actionType === 'alert') {
    actionParams.text = document.getElementById('param_alert_text').value;
  } else if (actionType === 'logToConsole') {
    actionParams.message = document.getElementById('param_console_message').value;
  } else if (actionType === 'injectBanner') {
    actionParams.text = document.getElementById('param_banner_text').value;
  } else if (actionType === 'customHtmlModal') {
    actionParams.html = document.getElementById('param_html').value;
  } else if (actionType === 'richTextModal') {
    actionParams.title = document.getElementById('param_richtext_title').value;
    actionParams.fontFamily = document.getElementById('param_richtext_fontfamily').value;
    actionParams.fontSize = parseInt(document.getElementById('param_richtext_fontsize').value, 10) || 16;
    actionParams.textColor = document.getElementById('param_richtext_color').value;
    actionParams.backgroundColor = document.getElementById('param_richtext_bgcolor').value;
    
    // Get content from Quill editor
    if (window.richTextQuillEditor) {
      actionParams.content = JSON.stringify(window.richTextQuillEditor.getContents());
      actionParams.html = window.richTextQuillEditor.root.innerHTML;
    } else {
      actionParams.content = '';
      actionParams.html = '';
    }
  } else if (actionType === 'functionCall') {
    actionParams.functionName = document.getElementById('param_function_name').value.trim();
    actionParams.functionType = document.getElementById('param_function_type').value;
    actionParams.functionCode = document.getElementById('param_function_code').value;
  } else if (actionType === 'countdownClock') {
    actionParams.minutes = parseInt(document.getElementById('param_countdown_minutes').value, 10) || 1;
    actionParams.label = document.getElementById('param_countdown_label').value;
  }
  const editIndex = document.getElementById('editIndex').value;
  if (!pkURL || !callName || (actionType === 'openUrl' && !url)) {
    alert("Primary Key URL, Call Name, and URL (for Open URL) are required!");
    return;
  }
  if (actionType === 'openUrl') {
    const urlRegex = /^(https?:\/\/)[^\s$.?#].[^"]*$/gm;
    if (!urlRegex.test(url)) {
      alert("Please enter a valid URL");
      return;
    }
  }
  if (actionType === 'countdownClock' && (!actionParams.minutes || actionParams.minutes < 1)) {
    alert('Please enter a valid countdown duration (at least 1 minute).');
    return;
  }
  if (actionType === 'functionCall') {
    if (!actionParams.functionName) {
      alert('Please enter a function name.');
      return;
    }
    if (!actionParams.functionCode.trim()) {
      alert('Please enter function code.');
      return;
    }
    // Basic validation - check for obviously invalid syntax patterns
    const code = actionParams.functionCode.trim();
    if (code.includes('</script>') || code.includes('<script')) {
      alert('Function code cannot contain script tags.');
      return;
    }
    // Note: Full syntax validation is skipped due to CSP restrictions
    // Syntax errors will be caught during execution
  }
  const newItem = { pkURL, callName, url, currentTab, actionType, actionParams };
  loadItems((items) => {
    if (editIndex === '') {
      items.push(newItem);
    } else {
      items[editIndex] = newItem;
    }
    saveItems(items, () => {
      renderItems();
      closeModal();
    });
  });
});

// --- Migration logic for old functionCode items ---
function migrateOldItems(items) {
  let migrated = false;
  items.forEach(item => {
    if (item.functionCode && item.functionCode.trim()) {
      // Try to match to supported actions
      if (/alert\(['"](.+?)['"]\)/.test(item.functionCode)) {
        item.actionType = 'alert';
        item.actionParams = { text: RegExp.$1 };
      } else if (/console\.log\(['"](.+?)['"]\)/.test(item.functionCode)) {
        item.actionType = 'logToConsole';
        item.actionParams = { message: RegExp.$1 };
      } else if (/document\.body\.style\.backgroundColor\s*=\s*['"](.+?)['"]/.test(item.functionCode)) {
        item.actionType = 'changeBgColor';
        item.actionParams = { color: RegExp.$1 };
      } else if (/banner\.textContent\s*=\s*['"](.+?)['"]/.test(item.functionCode)) {
        item.actionType = 'injectBanner';
        item.actionParams = { text: RegExp.$1 };
      } else if (/modalBox\.innerHTML\s*=\s*['"]([\s\S]+?)['"]/.test(item.functionCode)) {
        item.actionType = 'customHtmlModal';
        item.actionParams = { html: RegExp.$1 };
      } else {
        // Not matched, skip
        item.actionType = 'openUrl';
        item.actionParams = {};
      }
      migrated = true;
      delete item.functionCode;
    }
  });
  return migrated;
}

// On load, migrate old items if needed
loadItems((items) => {
  if (migrateOldItems(items)) {
    saveItems(items, renderItems);
  }
});

// Export items as a JSON file.
document.getElementById('btnExport').addEventListener('click', function() {
  loadItems((items) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "ifs_quick_call_items.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
});

// Import items from a JSON file.
document.getElementById('btnImport').addEventListener('click', function() {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedItems = JSON.parse(e.target.result);
      if (Array.isArray(importedItems)) {
        saveItems(importedItems, () => {
          renderItems();
          alert("Import successful!");
        });
      } else {
        alert("Invalid file format.");
      }
    } catch (error) {
      alert("Error parsing the file.");
    }
  };
  reader.readAsText(file);
});

// Event listener for the Add New Item button.
document.getElementById('btnAdd').addEventListener('click', function() {
  openModal('add');
});

// Add event listener for the filter checkbox
const showAllLinksCheckbox = document.getElementById('showAllLinks');
showAllLinksCheckbox.addEventListener('change', renderItems);

// --- Hover Color Settings ---
const hoverBgColorInput = document.getElementById('hoverBgColor');
const hoverBgHexInput = document.getElementById('hoverBgHex');
const hoverTextColorInput = document.getElementById('hoverTextColor');
const hoverTextHexInput = document.getElementById('hoverTextHex');
const btnResetColors = document.getElementById('btnResetColors');

// Sync color picker with hex input and save
function syncAndSaveHoverSettings() {
  const settings = {
    hoverBgColor: hoverBgColorInput.value,
    hoverTextColor: hoverTextColorInput.value
  };
  saveHoverSettings(settings);
}

// Validate hex color format
function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// Background color picker -> hex input sync
hoverBgColorInput.addEventListener('input', function() {
  hoverBgHexInput.value = this.value.toUpperCase();
  syncAndSaveHoverSettings();
});

// Background hex input -> color picker sync
hoverBgHexInput.addEventListener('input', function() {
  let val = this.value.toUpperCase();
  if (!val.startsWith('#')) val = '#' + val;
  if (isValidHex(val)) {
    hoverBgColorInput.value = val;
    syncAndSaveHoverSettings();
  }
});

// Text color picker -> hex input sync
hoverTextColorInput.addEventListener('input', function() {
  hoverTextHexInput.value = this.value.toUpperCase();
  syncAndSaveHoverSettings();
});

// Text hex input -> color picker sync
hoverTextHexInput.addEventListener('input', function() {
  let val = this.value.toUpperCase();
  if (!val.startsWith('#')) val = '#' + val;
  if (isValidHex(val)) {
    hoverTextColorInput.value = val;
    syncAndSaveHoverSettings();
  }
});

// Reset to default colors
btnResetColors.addEventListener('click', function() {
  hoverBgColorInput.value = DEFAULT_HOVER_BG;
  hoverBgHexInput.value = DEFAULT_HOVER_BG;
  hoverTextColorInput.value = DEFAULT_HOVER_TEXT;
  hoverTextHexInput.value = DEFAULT_HOVER_TEXT;
  syncAndSaveHoverSettings();
});

// Load and apply saved hover settings on page load
function initHoverSettings() {
  loadHoverSettings((settings) => {
    hoverBgColorInput.value = settings.hoverBgColor;
    hoverBgHexInput.value = settings.hoverBgColor.toUpperCase();
    hoverTextColorInput.value = settings.hoverTextColor;
    hoverTextHexInput.value = settings.hoverTextColor.toUpperCase();
  });
}

// Initial render (default: show only current tab's links)
document.addEventListener('DOMContentLoaded', function() {
  renderItems();
  initHoverSettings();
});
