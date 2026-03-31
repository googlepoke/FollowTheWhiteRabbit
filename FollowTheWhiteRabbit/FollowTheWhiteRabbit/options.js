// options.js

const IFS_UI_JAPANESE_KEY = 'ifsUiJapanese';

function t(key) {
  return typeof OptionsI18n !== 'undefined' ? OptionsI18n.t(key) : key;
}

function applyPageI18n() {
  if (typeof OptionsI18n !== 'undefined') OptionsI18n.apply();
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Define a storage key for the list items.
const STORAGE_KEY = 'ifsQuickCallItems';

// Define storage key and defaults for hover settings.
const HOVER_SETTINGS_KEY = 'ifsHoverSettings';
const DEFAULT_HOVER_BG = '#0365D8';
const DEFAULT_HOVER_TEXT = '#FFFFFF';
const DEFAULT_MENU_BG = '#FFFFFF';
const DEFAULT_MENU_TEXT = '#1A1B1D';
const DEFAULT_FONT_SIZE = '12';
const DEFAULT_FONT_FAMILY = 'Open Sans';

// Profile storage keys
const PROFILES_KEY = 'ifsProfiles';
const ACTIVE_PROFILE_KEY = 'ifsActiveProfile';

// Default appearance settings object.
function getDefaultHoverSettings() {
  return {
    hoverBgColor: DEFAULT_HOVER_BG,
    hoverTextColor: DEFAULT_HOVER_TEXT,
    menuBgColor: DEFAULT_MENU_BG,
    menuTextColor: DEFAULT_MENU_TEXT,
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: DEFAULT_FONT_FAMILY
  };
}

// Normalize imported menu appearance (export/import and legacy migration).
function normalizeMenuAppearance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = getDefaultHoverSettings();
  const hexOk = (s) => typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s);
  return {
    hoverBgColor: hexOk(raw.hoverBgColor) ? raw.hoverBgColor : d.hoverBgColor,
    hoverTextColor: hexOk(raw.hoverTextColor) ? raw.hoverTextColor : d.hoverTextColor,
    menuBgColor: hexOk(raw.menuBgColor) ? raw.menuBgColor : d.menuBgColor,
    menuTextColor: hexOk(raw.menuTextColor) ? raw.menuTextColor : d.menuTextColor,
    fontSize: String(raw.fontSize != null ? raw.fontSize : d.fontSize),
    fontFamily: typeof raw.fontFamily === 'string' && raw.fontFamily.trim() ? raw.fontFamily.trim() : d.fontFamily
  };
}

// Load hover settings: primary source is profile.menuAppearance; legacy keys supported until migrated.
function loadHoverSettings(profileId, callback) {
  loadProfiles((profiles) => {
    const prof = profileId ? profiles.find(p => p.id === profileId) : null;
    if (prof && prof.menuAppearance && typeof prof.menuAppearance === 'object') {
      callback(Object.assign(getDefaultHoverSettings(), prof.menuAppearance));
      return;
    }
    const profileKey = profileId ? HOVER_SETTINGS_KEY + '_' + profileId : HOVER_SETTINGS_KEY;
    chrome.storage.local.get([profileKey, HOVER_SETTINGS_KEY], (result) => {
      if (result[profileKey]) {
        callback(Object.assign(getDefaultHoverSettings(), result[profileKey]));
      } else if (result[HOVER_SETTINGS_KEY]) {
        callback(Object.assign(getDefaultHoverSettings(), result[HOVER_SETTINGS_KEY]));
      } else {
        callback(getDefaultHoverSettings());
      }
    });
  });
}

// Save hover settings on the profile record (ifsProfiles).
function saveHoverSettings(profileId, settings, callback) {
  if (!profileId) {
    const data = {};
    data[HOVER_SETTINGS_KEY] = settings;
    chrome.storage.local.set(data, callback);
    return;
  }
  loadProfiles((profiles) => {
    const idx = profiles.findIndex(p => p.id === profileId);
    if (idx === -1) {
      if (callback) callback();
      return;
    }
    profiles[idx].menuAppearance = Object.assign(getDefaultHoverSettings(), settings);
    saveProfiles(profiles, callback);
  });
}

// Copy legacy per-key menu settings onto profile objects once.
function ensureMenuAppearanceOnProfiles(callback) {
  loadProfiles((profiles) => {
    if (!profiles.length) {
      if (callback) callback();
      return;
    }
    const keysToLoad = [HOVER_SETTINGS_KEY];
    profiles.forEach(p => keysToLoad.push(HOVER_SETTINGS_KEY + '_' + p.id));
    chrome.storage.local.get(keysToLoad, (legacy) => {
      let changed = false;
      profiles.forEach(p => {
        if (p.menuAppearance && typeof p.menuAppearance === 'object') return;
        p.menuAppearance = Object.assign(
          getDefaultHoverSettings(),
          legacy[HOVER_SETTINGS_KEY + '_' + p.id] || legacy[HOVER_SETTINGS_KEY] || {}
        );
        changed = true;
      });
      if (changed) saveProfiles(profiles, callback);
      else if (callback) callback();
    });
  });
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
  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      console.error("Save failed:", chrome.runtime.lastError.message);
      if (callback) callback(chrome.runtime.lastError);
    } else {
      if (callback) callback(null);
    }
  });
}

function saveItemsAndRender(items) {
  saveItems(items, (err) => {
    if (err) {
      alert(t('alert_save_failed') + (err.message || t('alert_storage_quota')));
      return;
    }
    renderItems();
  });
}

function generateProfileId() {
  return 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function loadProfiles(callback) {
  chrome.storage.local.get([PROFILES_KEY], (result) => {
    callback(result[PROFILES_KEY] || []);
  });
}

function saveProfiles(profiles, callback) {
  let data = {};
  data[PROFILES_KEY] = profiles;
  chrome.storage.local.set(data, callback);
}

function loadActiveProfile(callback) {
  chrome.storage.local.get([ACTIVE_PROFILE_KEY], (result) => {
    callback(result[ACTIVE_PROFILE_KEY] || '');
  });
}

function saveActiveProfile(profileId, callback) {
  let data = {};
  data[ACTIVE_PROFILE_KEY] = profileId;
  chrome.storage.local.set(data, callback);
}

function migrateToProfiles(callback) {
  chrome.storage.local.get([PROFILES_KEY, STORAGE_KEY, HOVER_SETTINGS_KEY], (result) => {
    const profiles = result[PROFILES_KEY];
    if (profiles && profiles.length > 0) { callback(); return; }
    const generalId = generateProfileId();
    const items = result[STORAGE_KEY] || [];
    items.forEach(item => {
      if (!item.profiles || !Array.isArray(item.profiles)) {
        item.profiles = [generalId];
      }
    });
    const firstProfile = {
      id: generalId,
      name: 'General',
      menuAppearance: Object.assign(
        getDefaultHoverSettings(),
        result[HOVER_SETTINGS_KEY] || {}
      )
    };
    const data = {};
    data[PROFILES_KEY] = [firstProfile];
    data[ACTIVE_PROFILE_KEY] = generalId;
    data[STORAGE_KEY] = items;
    chrome.storage.local.set(data, callback);
  });
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
  const activeProfileId = getActiveProfileId();
  loadItems(async (items) => {
    loadProfiles(async (profiles) => {
      let filteredItems = activeProfileId
        ? items.filter(item => item.profiles && item.profiles.includes(activeProfileId))
        : items;
      if (!showAll) {
        const activeUrl = await getActiveTabUrl();
        filteredItems = filterItemsForCurrentUrl(activeUrl, filteredItems);
      }
      const tbody = document.getElementById('itemsBody');
      tbody.innerHTML = '';
      filteredItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        // Drag handle
        const tdHandle = document.createElement('td');
        tdHandle.innerHTML = '<span class="drag-handle" style="cursor:move;">&#9776;</span>';
        tr.appendChild(tdHandle);
        // Call Name
        const tdCallName = document.createElement('td');
        tdCallName.textContent = item.callName;
        tr.appendChild(tdCallName);
        // Profile badges
        const tdProfiles = document.createElement('td');
        if (item.profiles && profiles.length > 0) {
          item.profiles.forEach(pId => {
            const prof = profiles.find(p => p.id === pId);
            if (prof) {
              const badge = document.createElement('span');
              badge.className = 'badge bg-secondary me-1';
              badge.style.fontSize = '0.7em';
              badge.textContent = prof.name;
              tdProfiles.appendChild(badge);
            }
          });
        }
        tr.appendChild(tdProfiles);
        // Actions
        const tdActions = document.createElement('td');
        const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm btn-outline-primary me-2';
      editBtn.title = t('tooltip_edit');
      editBtn.setAttribute('aria-label', t('tooltip_edit'));
      editBtn.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
      editBtn.onclick = () => openModal('edit', items.indexOf(item));
      tdActions.appendChild(editBtn);
      const duplicateBtn = document.createElement('button');
      duplicateBtn.type = 'button';
      duplicateBtn.className = 'btn btn-sm btn-outline-secondary me-2';
      duplicateBtn.title = t('tooltip_duplicate');
      duplicateBtn.setAttribute('aria-label', t('tooltip_duplicate'));
      duplicateBtn.innerHTML = '<i class="bi bi-copy" aria-hidden="true"></i>';
      duplicateBtn.onclick = () => duplicateItem(items.indexOf(item));
      tdActions.appendChild(duplicateBtn);
      const toggleBtn = document.createElement('button');
      toggleBtn.innerHTML = item.hidden ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
      toggleBtn.className = 'btn btn-sm btn-outline-secondary me-2';
      toggleBtn.title = item.hidden ? t('tooltip_show_in_menu') : t('tooltip_hide_from_menu');
      toggleBtn.onclick = () => toggleItemVisibility(items.indexOf(item));
      tdActions.appendChild(toggleBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.title = t('tooltip_delete');
      deleteBtn.setAttribute('aria-label', t('tooltip_delete'));
      deleteBtn.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
      deleteBtn.onclick = () => {
        if (confirm(t('confirm_delete_item'))) {
          deleteItem(items.indexOf(item));
        }
      };
      tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
      // Initialize SortableJS for drag-and-drop
      if (window.Sortable) {
        if (window.itemsSortable) { window.itemsSortable.destroy(); }
        window.itemsSortable = Sortable.create(tbody, {
          handle: '.drag-handle',
          animation: 150,
          onEnd: function (evt) {
            const newFilteredOrder = Array.from(tbody.children).map(row => row.children[1].textContent);
            loadItems((allItems) => {
              const curProfileId = getActiveProfileId();
              let profileFiltered = curProfileId
                ? allItems.filter(item => item.profiles && item.profiles.includes(curProfileId))
                : allItems;
              let visibleItems = profileFiltered;
              const showAll = document.getElementById('showAllLinks').checked;
              if (!showAll) {
                getActiveTabUrl().then(activeUrl => {
                  visibleItems = filterItemsForCurrentUrl(activeUrl, profileFiltered);
                  const filteredMap = {};
                  visibleItems.forEach(item => { filteredMap[item.callName] = item; });
                  const newFilteredItems = newFilteredOrder.map(name => filteredMap[name]);
                  let newItems = []; let idx = 0;
                  for (let i = 0; i < allItems.length; i++) {
                    if (visibleItems.includes(allItems[i])) { newItems.push(newFilteredItems[idx++]); }
                    else { newItems.push(allItems[i]); }
                  }
                  saveItemsAndRender(newItems);
                });
              } else {
                const filteredMap = {};
                visibleItems.forEach(item => { filteredMap[item.callName] = item; });
                const newFilteredItems = newFilteredOrder.map(name => filteredMap[name]);
                let newItems = []; let idx = 0;
                for (let i = 0; i < allItems.length; i++) {
                  if (visibleItems.includes(allItems[i])) { newItems.push(newFilteredItems[idx++]); }
                  else { newItems.push(allItems[i]); }
                }
                saveItemsAndRender(newItems);
              }
            });
          }
        });
      }
    });
  });
}

// Delete an item at the given index.
function deleteItem(index) {
  loadItems((items) => {
    items.splice(index, 1);
    saveItemsAndRender(items);
  });
}

// Generate a unique call name by appending (1), (2), etc.
function generateUniqueCallName(baseName, items) {
  const baseMatch = baseName.match(/^(.+?)\s*\((\d+)\)$/);
  const coreName = baseMatch ? baseMatch[1].trim() : baseName;
  
  const existingNames = new Set(items.map(i => i.callName));
  let counter = 1;
  let newName = `${coreName} (${counter})`;
  
  while (existingNames.has(newName)) {
    counter++;
    newName = `${coreName} (${counter})`;
  }
  return newName;
}

// Duplicate an item at the given index.
function duplicateItem(index) {
  loadItems((items) => {
    const original = items[index];
    const clone = JSON.parse(JSON.stringify(original));
    clone.callName = generateUniqueCallName(original.callName, items);
    items.splice(index + 1, 0, clone);
    saveItemsAndRender(items);
  });
}

// Toggle item visibility in the RMB menu.
function toggleItemVisibility(index) {
  loadItems((items) => {
    items[index].hidden = !items[index].hidden;
    saveItemsAndRender(items);
  });
}

// --- Profile Management ---

function renderProfileDropdown(callback) {
  loadProfiles((profiles) => {
    loadActiveProfile((activeId) => {
      const select = document.getElementById('profileSelect');
      select.innerHTML = '';
      profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === activeId) opt.selected = true;
        select.appendChild(opt);
      });
      if (callback) callback(profiles, activeId);
    });
  });
}

function getActiveProfileId() {
  const select = document.getElementById('profileSelect');
  return select ? select.value : '';
}

function addProfile() {
  const name = prompt(t('prompt_new_profile'));
  if (!name || !name.trim()) return;
  loadProfiles((profiles) => {
    const newProfile = { id: generateProfileId(), name: name.trim(), menuAppearance: getDefaultHoverSettings() };
    profiles.push(newProfile);
    saveProfiles(profiles, () => {
      saveActiveProfile(newProfile.id, () => {
        renderProfileDropdown(() => {
          renderItems();
          initHoverSettings();
        });
      });
    });
  });
}

function editProfile() {
  const activeId = getActiveProfileId();
  if (!activeId) return;
  loadProfiles((profiles) => {
    const profile = profiles.find(p => p.id === activeId);
    if (!profile) return;
    const newName = prompt(t('prompt_rename_profile'), profile.name);
    if (!newName || !newName.trim()) return;
    profile.name = newName.trim();
    saveProfiles(profiles, () => {
      renderProfileDropdown(() => renderItems());
    });
  });
}

function duplicateProfile() {
  const activeId = getActiveProfileId();
  if (!activeId) return;
  loadProfiles((profiles) => {
    const source = profiles.find(p => p.id === activeId);
    if (!source) return;
    const newId = generateProfileId();
    const existingNames = new Set(profiles.map(p => p.name));
    let counter = 1;
    let newName = source.name + ' (' + counter + ')';
    while (existingNames.has(newName)) { counter++; newName = source.name + ' (' + counter + ')'; }
    const dupAppearance = Object.assign(getDefaultHoverSettings(), source.menuAppearance || {});
    profiles.push({ id: newId, name: newName, menuAppearance: dupAppearance });
    saveProfiles(profiles, () => {
      loadItems((items) => {
        items.forEach(item => {
          if (item.profiles && item.profiles.includes(activeId) && !item.profiles.includes(newId)) {
            item.profiles.push(newId);
          }
        });
        saveItems(items, (err) => {
          if (err) { alert(t('alert_save_failed') + (err.message || t('alert_storage_quota_short'))); return; }
          saveActiveProfile(newId, () => {
            renderProfileDropdown(() => {
              renderItems();
              initHoverSettings();
            });
          });
        });
      });
    });
  });
}

function deleteProfile() {
  const activeId = getActiveProfileId();
  if (!activeId) return;
  loadProfiles((profiles) => {
    if (profiles.length <= 1) { alert(t('alert_cannot_delete_last_profile')); return; }
    const profile = profiles.find(p => p.id === activeId);
    if (!confirm(t('confirm_delete_profile_prefix') + (profile ? profile.name : '') + t('confirm_delete_profile_suffix'))) return;
    const newProfiles = profiles.filter(p => p.id !== activeId);
    saveProfiles(newProfiles, () => {
      // Remove appearance settings for deleted profile
      chrome.storage.local.remove(HOVER_SETTINGS_KEY + '_' + activeId);
      loadItems((items) => {
        items.forEach(item => { if (item.profiles) { item.profiles = item.profiles.filter(id => id !== activeId); } });
        saveItems(items, (err) => {
          if (err) { alert(t('alert_save_failed') + (err.message || t('alert_storage_quota_short'))); return; }
          saveActiveProfile(newProfiles[0].id, () => {
            renderProfileDropdown(() => {
              renderItems();
              initHoverSettings();
            });
          });
        });
      });
    });
  });
}

function renderProfileCheckboxes(selectedProfiles) {
  const container = document.getElementById('profileCheckboxes');
  if (!container) return;
  container.innerHTML = '';
  loadProfiles((profiles) => {
    profiles.forEach(p => {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-check form-check-inline';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'form-check-input';
      cb.id = 'profile_cb_' + p.id; cb.value = p.id;
      cb.checked = selectedProfiles.includes(p.id);
      const label = document.createElement('label');
      label.className = 'form-check-label';
      label.htmlFor = 'profile_cb_' + p.id;
      label.textContent = p.name;
      wrapper.appendChild(cb); wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  });
}

function getSelectedProfileIds() {
  const container = document.getElementById('profileCheckboxes');
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
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
  var openUrlFields = document.getElementById('openUrlFields');
  var isOpenUrl = actionType === 'openUrl';
  if (openUrlFields) {
    openUrlFields.style.display = isOpenUrl ? '' : 'none';
  }
  urlInput.disabled = !isOpenUrl;
  urlInput.required = isOpenUrl;
  if (actionType === 'alert') {
    actionParamsContainer.innerHTML = '<label>' + t('label_alert_text') + '</label><input type="text" id="param_alert_text" class="form-control" value="' + (params.text || '') + '">';
  } else if (actionType === 'logToConsole') {
    actionParamsContainer.innerHTML = '<label>' + t('label_console_message') + '</label><input type="text" id="param_console_message" class="form-control" value="' + (params.message || '') + '">';
  } else if (actionType === 'injectBanner') {
    actionParamsContainer.innerHTML = '<label>' + t('label_banner_text') + '</label><input type="text" id="param_banner_text" class="form-control" value="' + (params.text || '') + '">';
  } else if (actionType === 'customHtmlModal') {
    actionParamsContainer.innerHTML = '<label>' + t('label_custom_html') + '</label><textarea id="param_html" class="form-control" rows="4">' + (params.html || '') + '</textarea>';
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

    const richtextDefaultTitle = escapeAttr(params.title || t('default_rich_modal_title'));
    actionParamsContainer.innerHTML = `
      <div class="row mb-3">
        <div class="col-md-6">
          <label>${t('label_modal_title')}</label>
          <input type="text" id="param_richtext_title" class="form-control" value="${richtextDefaultTitle}" placeholder="${escapeAttr(t('ph_modal_title'))}">
        </div>
        <div class="col-md-6">
          <label>${t('label_font_family')}</label>
          <select id="param_richtext_fontfamily" class="form-control">${fontSelectOptions}</select>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-4">
          <label>${t('label_font_size_px')}</label>
          <input type="number" id="param_richtext_fontsize" class="form-control" min="8" max="72" value="${params.fontSize || 16}">
        </div>
        <div class="col-md-4">
          <label>${t('label_text_color')}</label>
          <input type="color" id="param_richtext_color" class="form-control form-control-color" value="${params.textColor || '#333333'}">
        </div>
        <div class="col-md-4">
          <label>${t('label_background_color')}</label>
          <input type="color" id="param_richtext_bgcolor" class="form-control form-control-color" value="${params.backgroundColor || '#ffffff'}">
        </div>
      </div>
      <div class="mb-3">
        <label>${t('label_content')}</label>
        <div id="richtext-editor" style="height: 200px; border: 1px solid #ced4da; border-radius: 0.375rem;"></div>
        <input type="hidden" id="param_richtext_content" value="">
      </div>
    `;
    
    // Note: Quill editor will be initialized separately to avoid conflicts
  } else if (actionType === 'functionCall') {
    actionParamsContainer.innerHTML = '<label>' + t('label_function_name') + '</label><input type="text" id="param_function_name" class="form-control" value="' + (params.functionName || '') + '" placeholder="' + t('ph_function_name').replace(/"/g, '&quot;') + '"><label>' + t('label_function_type') + '</label><select id="param_function_type" class="form-control"><option value="complete" ' + (params.functionType === 'complete' ? 'selected' : '') + '>' + t('opt_function_complete') + '</option><option value="body" ' + (params.functionType === 'body' ? 'selected' : '') + '>' + t('opt_function_body') + '</option></select><label>' + t('label_function_code') + '</label><textarea id="param_function_code" class="form-control" rows="6" placeholder="' + t('ph_function_code').replace(/"/g, '&quot;') + '">' + (params.functionCode || '') + '</textarea>';
  } else if (actionType === 'countdownClock') {
    actionParamsContainer.innerHTML = '<label>' + t('label_countdown_minutes') + '</label><input type="number" id="param_countdown_minutes" class="form-control" min="1" value="' + (params.minutes || 1) + '"><label>' + t('label_countdown_label') + '</label><input type="text" id="param_countdown_label" class="form-control" value="' + (params.label || '') + '">';
  } else if (actionType === 'todoList') {
    // Normalize items to {label, url?} format, then convert to Label|URL text for editing
    let itemsText = '';
    if (params.items && Array.isArray(params.items)) {
      itemsText = params.items.map(entry => {
        if (typeof entry === 'string') {
          return entry; // legacy string format
        }
        // Object format: {label, url?}
        return entry.url ? `[${entry.label}](${entry.url})` : entry.label;
      }).join('\n');
    }
    const todoPlaceholderAttr = t('ph_todo_items').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
    actionParamsContainer.innerHTML = `
      <div class="mb-3">
        <label>${t('label_todo_items')}</label>
        <textarea id="param_todo_items" class="form-control" rows="6" placeholder="${todoPlaceholderAttr}">${itemsText}</textarea>
        <small class="text-muted">${t('hint_todo_format')}<code>Label</code> or <code>[Label](https://example.com)</code> or <code>Label|https://example.com</code></small>
      </div>
      <div class="row mb-3">
        <div class="col-md-6">
          <label>${t('label_font_size_px')}</label>
          <input type="number" id="param_todo_fontsize" class="form-control" min="8" max="72" value="${params.fontSize || 16}">
        </div>
        <div class="col-md-6">
          <label>${t('label_font_color')}</label>
          <div class="input-group">
            <input type="color" id="param_todo_fontcolor" class="form-control form-control-color" value="${params.fontColor || '#333333'}">
            <input type="text" id="param_todo_fontcolor_hex" class="form-control" value="${params.fontColor || '#333333'}" maxlength="7">
          </div>
        </div>
      </div>
    `;
    // Sync color picker with hex input
    const colorPicker = document.getElementById('param_todo_fontcolor');
    const hexInput = document.getElementById('param_todo_fontcolor_hex');
    if (colorPicker && hexInput) {
      colorPicker.addEventListener('input', function() {
        hexInput.value = this.value.toUpperCase();
      });
      hexInput.addEventListener('input', function() {
        let val = this.value.toUpperCase();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          colorPicker.value = val;
        }
      });
    }
  } else if (actionType === 'note') {
    const colorPresets = [
      { value: '#FFEB3B', label: t('color_yellow') },
      { value: '#F48FB1', label: t('color_pink') },
      { value: '#81D4FA', label: t('color_blue') },
      { value: '#A5D6A7', label: t('color_green') },
      { value: '#FFCC80', label: t('color_orange') },
      { value: '#E1BEE7', label: t('color_purple') }
    ];
    
    let colorSelectOptions = colorPresets.map(color => 
      `<option value="${color.value}" ${(params.defaultColor || '#FFEB3B') === color.value ? 'selected' : ''}>${color.label}</option>`
    ).join('');

    const notePh = t('ph_note_default').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    actionParamsContainer.innerHTML = `
      <div class="row mb-3">
        <div class="col-md-6">
          <label>${t('label_default_color')}</label>
          <select id="param_note_color" class="form-control">${colorSelectOptions}</select>
        </div>
        <div class="col-md-6">
          <label>${t('label_color_preview')}</label>
          <div id="param_note_color_preview" style="width: 100%; height: 38px; border-radius: 4px; border: 1px solid #ced4da; background-color: ${params.defaultColor || '#FFEB3B'};"></div>
        </div>
      </div>
      <div class="mb-3">
        <label>${t('label_default_text_optional')}</label>
        <textarea id="param_note_text" class="form-control" rows="3" placeholder="${notePh}">${params.defaultText || ''}</textarea>
      </div>
    `;

    // Update color preview when selection changes
    const colorSelect = document.getElementById('param_note_color');
    const colorPreview = document.getElementById('param_note_color_preview');
    if (colorSelect && colorPreview) {
      colorSelect.addEventListener('change', function() {
        colorPreview.style.backgroundColor = this.value;
      });
    }
  } else if (actionType === 'markdown') {
    const mdPh = t('ph_markdown').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    actionParamsContainer.innerHTML = `
      <div class="mb-3">
        <label>${t('label_markdown_content')}</label>
        <textarea id="param_markdown_content" class="form-control" rows="10"
          placeholder="${mdPh}" style="font-family: monospace; font-size: 13px;">${(params.markdownText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      </div>
    `;
  } else if (actionType === 'publishedPageUrl') {
    const pubPh = t('ph_published_url').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    actionParamsContainer.innerHTML = `
      <div class="mb-3">
        <label>${t('label_published_page_url')}</label>
        <input type="url" id="param_published_url" class="form-control"
          placeholder="${pubPh}" value="${escapeAttr(params.pageUrl || '')}">
        <small class="text-muted">${t('help_published_url')}</small>
      </div>
      <div class="form-check mt-2">
        <input type="checkbox" class="form-check-input" id="param_published_incognito" ${params.incognito ? 'checked' : ''}>
        <label class="form-check-label" for="param_published_incognito">${t('label_open_incognito')}</label>
      </div>
    `;
  } else if (actionType === 'imageSlideshow') {
    const images = params.images && Array.isArray(params.images) ? params.images : [];
    window.imageSlideshowImages = [...images];
    const slideDrop = t('slideshow_dropzone').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const slideHelp = t('slideshow_help').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    actionParamsContainer.innerHTML = `
      <div class="mb-3">
        <label>${t('label_slideshow_images')}</label>
        <div id="param_imageslide_dropzone" tabindex="0" class="border border-2 border-dashed rounded p-3 mb-2 text-center" style="min-height: 80px; cursor: pointer; background: #f8f9fa; outline: none;">
          <span class="text-muted">${slideDrop}</span>
        </div>
        <div class="d-flex gap-2 mb-2">
          <input type="file" id="param_imageslide_fileinput" accept="image/*" multiple style="display: none;">
          <button type="button" id="param_imageslide_choosebtn" class="btn btn-sm btn-outline-primary">${t('slideshow_choose_files')}</button>
        </div>
        <div id="param_imageslide_list" class="d-flex flex-wrap gap-2 mt-2"></div>
        <small class="text-muted d-block mt-1">${slideHelp}</small>
      </div>
    `;
    const dropZone = document.getElementById('param_imageslide_dropzone');
    const fileInput = document.getElementById('param_imageslide_fileinput');
    const chooseBtn = document.getElementById('param_imageslide_choosebtn');
    const listEl = document.getElementById('param_imageslide_list');

    function compressImage(dataUrl, maxWidth, maxHeight, quality) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }

    async function addImagesFromFiles(files) {
      if (!files || files.length === 0) return;
      for (const f of Array.from(files)) {
        if (!f.type || !f.type.startsWith('image/')) continue;
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(f);
        });
        const compressed = await compressImage(dataUrl, 1920, 1080, 0.8);
        window.imageSlideshowImages.push(compressed);
      }
      renderThumbnails();
    }

    var activePreviewEl = null;
    var activeHoverTimer = null;
    var isSortingSlides = false;

    function clearSlidePreview() {
      if (activeHoverTimer) { clearTimeout(activeHoverTimer); activeHoverTimer = null; }
      if (activePreviewEl && activePreviewEl.parentNode) {
        activePreviewEl.parentNode.removeChild(activePreviewEl);
      }
      activePreviewEl = null;
    }

    function renderThumbnails() {
      clearSlidePreview();
      if (window.imageSlideshowSortable) {
        window.imageSlideshowSortable.destroy();
        window.imageSlideshowSortable = null;
      }
      listEl.innerHTML = '';
      (window.imageSlideshowImages || []).forEach((dataUrl, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'position-relative d-inline-block slide-thumb-item';
        wrap.style.width = '60px';
        wrap.dataset.index = String(i);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = '60px';
        img.style.height = '45px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        img.style.border = '1px solid #dee2e6';
        wrap.appendChild(img);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn btn-sm btn-danger position-absolute';
        rm.style.top = '-6px';
        rm.style.right = '-6px';
        rm.style.padding = '0 4px';
        rm.style.fontSize = '10px';
        rm.innerHTML = '&times;';
        rm.onclick = function(e) {
          e.stopPropagation();
          const idx = Array.from(listEl.children).indexOf(wrap);
          if (idx >= 0) {
            window.imageSlideshowImages.splice(idx, 1);
            renderThumbnails();
          }
        };
        wrap.appendChild(rm);

        wrap.addEventListener('mouseenter', function() {
          if (isSortingSlides) return;
          clearSlidePreview();
          activeHoverTimer = setTimeout(function() {
            if (isSortingSlides) return;
            activePreviewEl = document.createElement('div');
            activePreviewEl.className = 'slide-thumb-preview';
            var previewImg = document.createElement('img');
            previewImg.src = dataUrl;
            activePreviewEl.appendChild(previewImg);
            document.body.appendChild(activePreviewEl);
            var rect = wrap.getBoundingClientRect();
            var previewW = activePreviewEl.offsetWidth || 168;
            var previewH = activePreviewEl.offsetHeight || 128;
            var vw = document.documentElement.clientWidth;
            var vh = document.documentElement.clientHeight;
            var pad = 8;
            var desiredLeft = rect.left + (rect.width / 2) - (previewW / 2);
            var left = Math.max(pad, Math.min(desiredLeft, vw - previewW - pad));
            var top = rect.top - previewH - 4;
            if (top < pad) { top = rect.bottom + 4; }
            top = Math.max(pad, Math.min(top, vh - previewH - pad));
            activePreviewEl.style.position = 'fixed';
            activePreviewEl.style.left = left + 'px';
            activePreviewEl.style.top = top + 'px';
            activePreviewEl.style.bottom = 'auto';
            activePreviewEl.style.transform = 'none';
          }, 300);
        });
        wrap.addEventListener('mouseleave', function() {
          clearSlidePreview();
        });

        wrap.addEventListener('dblclick', function(e) {
          e.stopPropagation();
          if (e.target === rm) return;
          clearSlidePreview();
          var overlay = document.createElement('div');
          overlay.className = 'slide-preview-overlay';
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;';
          var overlayImg = document.createElement('img');
          overlayImg.src = dataUrl;
          overlayImg.style.cssText = 'max-width:80vw;max-height:80vh;object-fit:contain;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
          overlay.appendChild(overlayImg);
          function closeOverlay() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', escHandler);
          }
          var escHandler = function(ev) { if (ev.key === 'Escape') closeOverlay(); };
          overlay.addEventListener('click', function(ev) { if (ev.target === overlay) closeOverlay(); });
          document.addEventListener('keydown', escHandler);
          document.body.appendChild(overlay);
        });

        listEl.appendChild(wrap);
      });
      if (window.Sortable && window.imageSlideshowImages && window.imageSlideshowImages.length > 0) {
        window.imageSlideshowSortable = Sortable.create(listEl, {
          animation: 150,
          direction: 'horizontal',
          filter: 'button, .btn',
          ghostClass: 'slide-thumb-ghost',
          chosenClass: 'slide-thumb-chosen',
          dragClass: 'slide-thumb-drag',
          placeholderClass: 'slide-drop-indicator',
          placeholder: 'div',
          onStart: function() {
            isSortingSlides = true;
            clearSlidePreview();
          },
          onEnd: function() {
            isSortingSlides = false;
            clearSlidePreview();
            var orderedSrcs = Array.from(listEl.querySelectorAll('.slide-thumb-item img')).map(function(img) { return img.src; });
            window.imageSlideshowImages = orderedSrcs;
            renderThumbnails();
          }
        });
      }
    }

    chooseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function() {
      addImagesFromFiles(Array.from(this.files || []));
      this.value = '';
    });

    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.style.background = '#e9ecef';
    });
    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.style.background = '#f8f9fa';
    });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.style.background = '#f8f9fa';
      addImagesFromFiles(Array.from(e.dataTransfer.files || []));
    });

    dropZone.addEventListener('paste', function(e) {
      e.preventDefault();
      const items = e.clipboardData && e.clipboardData.items ? e.clipboardData.items : [];
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type && items[i].type.startsWith('image/')) {
          files.push(items[i].getAsFile());
        }
      }
      addImagesFromFiles(files);
    });

    renderThumbnails();
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
        placeholder: t('quill_placeholder'),
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
    modalTitle.textContent = t('modal_add_item');
    editIndexInput.value = '';
    document.getElementById('callName').value = '';
    document.getElementById('pkURL').value = '';
    urlInput.value = '';
    document.getElementById('currentTab').checked = true;
    actionTypeInput.value = 'openUrl';
    renderActionParamsFields('openUrl');
    renderProfileCheckboxes([getActiveProfileId()]);
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        document.getElementById('pkURL').value = currentUrl;
        urlInput.value = currentUrl;
      }
    });
  } else if (mode === 'edit') {
    modalTitle.textContent = t('modal_edit_item');
    loadItems((items) => {
      const item = items[index];
      editIndexInput.value = index;
      document.getElementById('pkURL').value = item.pkURL;
      document.getElementById('callName').value = item.callName;
      urlInput.value = item.url || '';
      document.getElementById('currentTab').checked = item.currentTab;
      actionTypeInput.value = item.actionType || 'alert';
      renderActionParamsFields(item.actionType || 'alert', item.actionParams || {});
      renderProfileCheckboxes(item.profiles || []);
      
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
  } else if (actionType === 'todoList') {
    const itemsRaw = document.getElementById('param_todo_items').value;
    // Split by newlines, trim each, filter out empty lines, parse Label|URL format
    const lines = itemsRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    actionParams.items = lines.map(line => {
      if (line === '---') {
        return { label: '---' };
      }
      const mdMatch = line.match(/^\[(.+?)\]\((https?:\/\/.+)\)$/);
      if (mdMatch) {
        return { label: mdMatch[1].trim(), url: mdMatch[2].trim() };
      }
      const pipeIndex = line.indexOf('|');
      if (pipeIndex > 0 && pipeIndex < line.length - 1) {
        const label = line.substring(0, pipeIndex).trim();
        const url = line.substring(pipeIndex + 1).trim();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          return { label, url };
        }
      }
      return { label: line };
    });
    actionParams.fontSize = parseInt(document.getElementById('param_todo_fontsize').value, 10) || 16;
    actionParams.fontColor = document.getElementById('param_todo_fontcolor').value;
  } else if (actionType === 'note') {
    actionParams.defaultColor = document.getElementById('param_note_color').value;
    actionParams.defaultText = document.getElementById('param_note_text').value;
  } else if (actionType === 'markdown') {
    actionParams.markdownText = document.getElementById('param_markdown_content').value;
  } else if (actionType === 'publishedPageUrl') {
    actionParams.pageUrl = document.getElementById('param_published_url').value.trim();
    actionParams.incognito = document.getElementById('param_published_incognito').checked;
  } else if (actionType === 'imageSlideshow') {
    actionParams.images = window.imageSlideshowImages && Array.isArray(window.imageSlideshowImages) ? window.imageSlideshowImages : [];
  }
  const editIndex = document.getElementById('editIndex').value;
  if (!pkURL || !callName || (actionType === 'openUrl' && !url)) {
    alert(t('alert_pk_required'));
    return;
  }
  if (actionType === 'openUrl') {
    const urlRegex = /^(https?:\/\/)[^\s$.?#].[^"]*$/gm;
    if (!urlRegex.test(url)) {
      alert(t('alert_valid_url'));
      return;
    }
  }
  if (actionType === 'countdownClock' && (!actionParams.minutes || actionParams.minutes < 1)) {
    alert(t('alert_countdown_duration'));
    return;
  }
  if (actionType === 'functionCall') {
    if (!actionParams.functionName) {
      alert(t('alert_function_name'));
      return;
    }
    if (!actionParams.functionCode.trim()) {
      alert(t('alert_function_code'));
      return;
    }
    // Basic validation - check for obviously invalid syntax patterns
    const code = actionParams.functionCode.trim();
    if (code.includes('</script>') || code.includes('<script')) {
      alert(t('alert_no_script_tags'));
      return;
    }
    // Note: Full syntax validation is skipped due to CSP restrictions
    // Syntax errors will be caught during execution
  }
  if (actionType === 'todoList') {
    if (!actionParams.items || actionParams.items.length === 0) {
      alert(t('alert_todo_one_item'));
      return;
    }
    // Validate URLs if provided
    for (const item of actionParams.items) {
      if (item.url && !item.url.match(/^https?:\/\/.+/)) {
        alert(t('alert_invalid_url_for').replace('{label}', item.label));
        return;
      }
    }
  }
  if (actionType === 'publishedPageUrl') {
    if (!actionParams.pageUrl || !actionParams.pageUrl.match(/^https?:\/\/.+/)) {
      alert(t('alert_published_url'));
      return;
    }
  }
  if (actionType === 'imageSlideshow') {
    if (!actionParams.images || actionParams.images.length === 0) {
      alert(t('alert_slideshow_image'));
      return;
    }
  }
  const selectedProfiles = getSelectedProfileIds();
  if (selectedProfiles.length === 0) {
    alert(t('alert_assign_profile'));
    return;
  }
  const newItem = { pkURL, callName, url, currentTab, actionType, actionParams, profiles: selectedProfiles };
  loadItems((items) => {
    if (editIndex === '') {
      items.push(newItem);
    } else {
      newItem.hidden = items[editIndex].hidden;
      items[editIndex] = newItem;
    }
    saveItems(items, (err) => {
      if (err) {
        alert(t('alert_save_failed') + (err.message || t('alert_storage_quota')));
        return;
      }
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

// On load, migrate old items if needed (runs after UI language is loaded; see DOMContentLoaded)

// Export items and menu appearance for the active profile as a JSON file.
document.getElementById('btnExport').addEventListener('click', function() {
  const activeProfileId = getActiveProfileId();
  loadItems((items) => {
    loadProfiles((profiles) => {
      const profileItems = activeProfileId
        ? items.filter(item => item.profiles && item.profiles.includes(activeProfileId))
        : items;
      const activeProfile = profiles.find(p => p.id === activeProfileId);
      const profileName = activeProfile ? activeProfile.name.replace(/[^a-zA-Z0-9]/g, '_') : 'all';
      loadHoverSettings(activeProfileId, (appearance) => {
        const payload = {
          exportVersion: 1,
          profileName: activeProfile ? activeProfile.name : 'all',
          menuAppearance: appearance,
          items: profileItems
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "ifs_quick_call_" + profileName + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      });
    });
  });
});

// Import items from a JSON file into the active profile.
document.getElementById('btnImport').addEventListener('click', function() {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      let importedItems;
      let importedMenu = null;
      if (Array.isArray(parsed)) {
        importedItems = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        importedItems = parsed.items;
        if (parsed.menuAppearance) importedMenu = normalizeMenuAppearance(parsed.menuAppearance);
      } else {
        alert(t('alert_invalid_file'));
        return;
      }
      const activeProfileId = getActiveProfileId();
      const doReplace = confirm(t('confirm_import_replace'));
      loadItems((allItems) => {
        importedItems.forEach(item => {
          if (!item.profiles || !Array.isArray(item.profiles)) item.profiles = [];
          if (activeProfileId && !item.profiles.includes(activeProfileId)) item.profiles.push(activeProfileId);
        });
        const finishImport = (err) => {
          if (err) { alert(t('alert_import_failed') + (err.message || t('alert_storage_quota_short'))); return; }
          if (importedMenu && activeProfileId) {
            saveHoverSettings(activeProfileId, importedMenu, () => {
              renderItems();
              initHoverSettings();
              alert((doReplace ? t('alert_import_success_replaced') : t('alert_import_success_merged')) + t('alert_import_menu_updated'));
            });
          } else {
            renderItems();
            alert(doReplace ? t('alert_import_success_replaced') : t('alert_import_success_merged'));
          }
        };
        if (doReplace) {
          const kept = allItems.filter(item => {
            if (!item.profiles) return true;
            item.profiles = item.profiles.filter(id => id !== activeProfileId);
            return item.profiles.length > 0;
          });
          saveItems(kept.concat(importedItems), finishImport);
        } else {
          saveItems(allItems.concat(importedItems), finishImport);
        }
      });
    } catch (error) { alert(t('alert_parse_error')); }
  };
  reader.readAsText(file);
  this.value = '';
});

// Event listener for the Add New Item button.
document.getElementById('btnAdd').addEventListener('click', function() {
  openModal('add');
});

var btnOpenInTab = document.getElementById('btnOpenInTab');
if (btnOpenInTab) {
  btnOpenInTab.addEventListener('click', function() {
    window.open(chrome.runtime.getURL('options.html'), '_blank');
    window.close();
  });
}

// Add event listener for the filter checkbox
const showAllLinksCheckbox = document.getElementById('showAllLinks');
showAllLinksCheckbox.addEventListener('change', renderItems);

// --- Hover Color Settings ---
const hoverBgColorInput = document.getElementById('hoverBgColor');
const hoverBgHexInput = document.getElementById('hoverBgHex');
const hoverTextColorInput = document.getElementById('hoverTextColor');
const hoverTextHexInput = document.getElementById('hoverTextHex');
const menuBgColorInput = document.getElementById('menuBgColor');
const menuBgHexInput = document.getElementById('menuBgHex');
const menuTextColorInput = document.getElementById('menuTextColor');
const menuTextHexInput = document.getElementById('menuTextHex');
const btnResetColors = document.getElementById('btnResetColors');
const menuFontSizeSelect = document.getElementById('menuFontSize');
const menuFontFamilySelect = document.getElementById('menuFontFamily');

// Sync color picker with hex input and save
function syncAndSaveHoverSettings() {
  const settings = {
    hoverBgColor: hoverBgColorInput.value,
    hoverTextColor: hoverTextColorInput.value,
    menuBgColor: menuBgColorInput.value,
    menuTextColor: menuTextColorInput.value,
    fontSize: menuFontSizeSelect.value,
    fontFamily: menuFontFamilySelect.value
  };
  saveHoverSettings(getActiveProfileId(), settings);
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

// Menu background color picker -> hex input sync
menuBgColorInput.addEventListener('input', function() {
  menuBgHexInput.value = this.value.toUpperCase();
  syncAndSaveHoverSettings();
});

// Menu background hex input -> color picker sync
menuBgHexInput.addEventListener('input', function() {
  let val = this.value.toUpperCase();
  if (!val.startsWith('#')) val = '#' + val;
  if (isValidHex(val)) {
    menuBgColorInput.value = val;
    syncAndSaveHoverSettings();
  }
});

// Menu text color picker -> hex input sync
menuTextColorInput.addEventListener('input', function() {
  menuTextHexInput.value = this.value.toUpperCase();
  syncAndSaveHoverSettings();
});

// Menu text hex input -> color picker sync
menuTextHexInput.addEventListener('input', function() {
  let val = this.value.toUpperCase();
  if (!val.startsWith('#')) val = '#' + val;
  if (isValidHex(val)) {
    menuTextColorInput.value = val;
    syncAndSaveHoverSettings();
  }
});

// Reset to default colors and font settings
btnResetColors.addEventListener('click', function() {
  hoverBgColorInput.value = DEFAULT_HOVER_BG;
  hoverBgHexInput.value = DEFAULT_HOVER_BG;
  hoverTextColorInput.value = DEFAULT_HOVER_TEXT;
  hoverTextHexInput.value = DEFAULT_HOVER_TEXT;
  menuBgColorInput.value = DEFAULT_MENU_BG;
  menuBgHexInput.value = DEFAULT_MENU_BG;
  menuTextColorInput.value = DEFAULT_MENU_TEXT;
  menuTextHexInput.value = DEFAULT_MENU_TEXT;
  menuFontSizeSelect.value = DEFAULT_FONT_SIZE;
  menuFontFamilySelect.value = DEFAULT_FONT_FAMILY;
  syncAndSaveHoverSettings();
});

// Font size and font family change listeners
menuFontSizeSelect.addEventListener('change', syncAndSaveHoverSettings);
menuFontFamilySelect.addEventListener('change', syncAndSaveHoverSettings);

// Load and apply saved hover settings on page load (per-profile)
function initHoverSettings() {
  const profileId = getActiveProfileId();
  loadHoverSettings(profileId, (settings) => {
    hoverBgColorInput.value = settings.hoverBgColor;
    hoverBgHexInput.value = settings.hoverBgColor.toUpperCase();
    hoverTextColorInput.value = settings.hoverTextColor;
    hoverTextHexInput.value = settings.hoverTextColor.toUpperCase();
    menuBgColorInput.value = settings.menuBgColor;
    menuBgHexInput.value = settings.menuBgColor.toUpperCase();
    menuTextColorInput.value = settings.menuTextColor;
    menuTextHexInput.value = settings.menuTextColor.toUpperCase();
    menuFontSizeSelect.value = settings.fontSize;
    menuFontFamilySelect.value = settings.fontFamily;
  });
}

// Initial render with profile migration
document.addEventListener('DOMContentLoaded', function() {
  const toggleJa = document.getElementById('toggleUiJapanese');
  if (toggleJa) {
    toggleJa.addEventListener('change', function() {
      chrome.storage.local.set({ [IFS_UI_JAPANESE_KEY]: this.checked }, () => {
        if (typeof OptionsI18n !== 'undefined') OptionsI18n.setJapanese(this.checked);
        applyPageI18n();
        renderItems();
        toggleJa.setAttribute('aria-label', t('lang_switch_label'));
      });
    });
  }

  chrome.storage.local.get([IFS_UI_JAPANESE_KEY], function(res) {
    const ja = !!res[IFS_UI_JAPANESE_KEY];
    if (typeof OptionsI18n !== 'undefined') OptionsI18n.setJapanese(ja);
    if (toggleJa) {
      toggleJa.checked = ja;
      toggleJa.setAttribute('aria-label', t('lang_switch_label'));
    }
    applyPageI18n();

    loadItems((items) => {
      if (migrateOldItems(items)) {
        saveItemsAndRender(items);
      }
    });

    migrateToProfiles(() => {
      ensureMenuAppearanceOnProfiles(() => {
        renderProfileDropdown(() => {
          renderItems();
          initHoverSettings();
        });
      });
    });
  });

  document.getElementById('btnAddProfile').addEventListener('click', addProfile);
  document.getElementById('btnEditProfile').addEventListener('click', editProfile);
  document.getElementById('btnDuplicateProfile').addEventListener('click', duplicateProfile);
  document.getElementById('btnDeleteProfile').addEventListener('click', deleteProfile);

  document.getElementById('profileSelect').addEventListener('change', function() {
    saveActiveProfile(this.value, () => {
      renderItems();
      initHoverSettings();
    });
  });
});
