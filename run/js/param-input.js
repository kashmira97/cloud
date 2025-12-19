document.addEventListener('hashChangeEvent', function (event) {
    console.log("param-input.js detects URL hashChangeEvent");
    
    // Reload YAML content for the current parambase
    const hash = getHash();
    if (hash.parambase) {
        const select = document.getElementById('parambase');
    if (select) {
      const decodedParambase = decodeHashValue(hash.parambase);

      const selectedOption = Array.from(select.options)
        .find(option => option.value === decodedParambase);

      if (selectedOption?.dataset?.url  && decodedParambase !== currentParambase) {
        loadParambaseYAML(decodedParambase, selectedOption.dataset.url);
      }
    }
    } else {
        // No parambase - reload using the standard paramText loading process
        loadParamTextFromCurrentState();
    }
}, false);


function shouldSkipBaseYamlLoad(hash) {
  // Only skip base YAML when we have hash-driven config AND no parambase selected.
  if (hash.parambase || hash.customYamlUrl) return false;

  const hasDcid =
    hash?.features?.dcid ||
    hash?.targets?.dcid ||
    hash["features.dcid"] ||
    hash["targets.dcid"];

  return (
    hasDcid ||
    hash.folder ||
    hash.features ||
    hash.targets ||
    hash.models ||
    Object.keys(hash).some(k =>
      k.startsWith("features.") ||
      k.startsWith("targets.") ||
      k.startsWith("models.")
    )
  );
}




// Function to reload paramText content without affecting the dropdown
function loadParamTextFromCurrentState() {
  const el = document.getElementById('paramText');
  if (!el) return;

  // ✅ If we have a current parambase with cached content
  if (currentParambase && cachedParambaseContent[currentParambase]) {
    updateParamTextWithBase(cachedParambaseContent[currentParambase]);
    return;
  }

  // ✅ Fall back to current content + hash overrides
  let content = el.value || '';
  const hash = getHash();
  console.log("loadParamTextFromCurrentState - hash:", hash);

  const addHashKeys = ["folder", "features", "targets", "models"];
  let parsedContent = parseYAML(content);
  parsedContent = updateYAMLFromHash(parsedContent, hash, addHashKeys);
  el.value = convertToYAML(parsedContent);

  updateResetButtonVisibility();
}


function updateYAMLFromHash(parsedContent, hash, addHashKeys) {
    // Sets nested yaml values for textbox while preserving existing structure
    function setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            // Preserve existing object or create new one if doesn't exist
            current[key] = current[key] || {};
            current = current[key];
        }

        // Set the value at the final key, converting numeric strings to numbers
        const lastKey = keys[keys.length - 1];
        current[lastKey] = convertValueType(decodeURIComponent(value));

    }

    // Helper function to handle comma-separated values, including encrypted commas
    function handleCommaSeparatedValue(value) {
        if (typeof value === 'string' && value.includes('%2C')) {
            return value.split('%2C').map(item => item.trim());
        } else if (typeof value === 'string' && value.includes(',')) {
            return value.split(',').map(item => item.trim());
        }
        return value;
    }

    // Check if a path should be included based on addHashKeys
    function shouldIncludePath(path) {
        const rootKey = path.split('.')[0];
        return addHashKeys.includes(rootKey);
    }

    // Traverse hash and update parsedContent
    function traverseAndUpdate(obj, prefix = '') {
        Object.keys(obj).forEach(key => {
            const currentPath = prefix ? `${prefix}.${key}` : key;

            // Skip if this path doesn't match our allowed root keys
            if (!shouldIncludePath(currentPath)) {
                return;
            }

           if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
  traverseAndUpdate(obj[key], currentPath);
} else {
  const processedValue = handleCommaSeparatedValue(obj[key]);
  setNestedValue(parsedContent, currentPath, processedValue);
}
        });
    }

    // Start the traversal
    traverseAndUpdate(hash);
    return parsedContent;
}

// Helper function to convert string values to appropriate types
function convertValueType(value) {
    if (typeof value !== 'string') return value;
    
    // Check if it's a number (integer or decimal)
    if (/^\d+$/.test(value)) {
        return parseInt(value, 10);
    }
    if (/^\d*\.\d+$/.test(value)) {
        return parseFloat(value);
    }
    
    // Check if it's a boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Return as string if no conversion needed
    return value;
}

function initFeatureTargetPanel() {
  const featuresList = document.getElementById("featuresList");
  const targetInput = document.getElementById("targetInput");
  const addBtn = document.getElementById("addFeatureBtn");
  const invertBtn = document.getElementById("invertBtn");
  const getFeatureBtn = document.getElementById("getFeatureBtn");
const getTargetBtn = document.getElementById("getTargetBtn");


  if (!featuresList || !targetInput || !addBtn || !invertBtn || !getFeatureBtn || !getTargetBtn) {
    return; // UI not present
  }

  // local UI state (so +Add can show an empty row without writing junk to hash)
  let uiFeatures = [];
  let uiTarget = "";

  function readFromHash() {
  const h = getHash();

  // try hash first
  let fRaw = h?.features?.dcid ?? h["features.dcid"] ?? "";
  let tRaw = h?.targets?.dcid ?? h["targets.dcid"] ?? "";

  fRaw = decodeHashValue(fRaw);
  tRaw = decodeHashValue(tRaw);

  let featuresArr = String(fRaw || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  let target = String(tRaw || "").trim();

  // ✅ fallback: if hash has nothing, read from YAML in textarea
  if (!featuresArr.length && !target) {


    const el = document.getElementById("paramText");
    if ((!featuresArr.length && !target)) {
  const el = document.getElementById("paramText");
    if (el && el.value) {
      try {
        const y = parseYAML(el.value);

        // features can be either array or object with dcid
        let yFeatures = [];
        if (Array.isArray(y?.features)) {
          yFeatures = y.features.map(f => f?.dcid).filter(Boolean);
        } else if (y?.features?.dcid) {
          if (Array.isArray(y.features.dcid)) yFeatures = y.features.dcid;
          else yFeatures = String(y.features.dcid).split(",").map(s => s.trim()).filter(Boolean);
        }

        const yTarget = (y?.targets?.dcid || "").toString().trim();

        
         if (!featuresArr.length) featuresArr = yFeatures;
      if (!target) target = yTarget;
      } catch (e) {
        console.warn("readFromHash: YAML parse failed", e);
      }
    }
  }}

  uiFeatures = featuresArr.length ? featuresArr : [""];
  uiTarget = target;
}


  function writeToHash() {
    const h = getHash();
    h.features = h.features || {};
    h.targets = h.targets || {};

    // only write non-empty features to hash
    const cleanFeatures = uiFeatures.map(s => (s || "").trim()).filter(Boolean);
    if (cleanFeatures.length) {
      h.features.dcid = cleanFeatures.join(",");
    } else {
      // remove features.dcid if empty
      if (h.features) delete h.features.dcid;
      delete h["features.dcid"];
    }

    // only one target
    const cleanTarget = (uiTarget || "").trim();
    if (cleanTarget) {
      h.targets.dcid = cleanTarget;
    } else {
      if (h.targets) delete h.targets.dcid;
      delete h["targets.dcid"];
    }

    goHash(h);
  }

  function refreshYamlBox() {
    // rebuild YAML box from current state/hash
    loadParamTextFromCurrentState();
  }

  function render() {
    // target
    targetInput.value = uiTarget || "";

    // features list
    featuresList.innerHTML = "";
    uiFeatures.forEach((val, idx) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.margin = "6px 0";

      row.innerHTML = `
        <input class="featureInput" type="text" value="${val || ""}"
               placeholder="features.dcid"
               style="padding:8px; width:420px; max-width:100%;" />
        <button type="button" class="removeBtn">Remove</button>
      `;

      row.querySelector(".featureInput").addEventListener("input", (e) => {
        uiFeatures[idx] = e.target.value;
        writeToHash();
        refreshYamlBox();
      });

      row.querySelector(".removeBtn").addEventListener("click", () => {
        uiFeatures.splice(idx, 1);
        if (uiFeatures.length === 0) uiFeatures = [""];
        writeToHash();
        render();
        refreshYamlBox();
      });

      featuresList.appendChild(row);
    });
  }

  // + Add (now works because it only changes local UI state)
  addBtn.addEventListener("click", () => {
    uiFeatures.push("");
    render();
  });

  // target typing
  targetInput.addEventListener("input", (e) => {
    uiTarget = e.target.value;
    writeToHash();
    refreshYamlBox();
  });

  // invert (swap target with first feature)
  invertBtn.addEventListener("click", () => {
    if (!uiFeatures.length) uiFeatures = [""];
    const tmp = uiFeatures[0] || "";
    uiFeatures[0] = uiTarget || "";
    uiTarget = tmp;
    writeToHash();
    render();
    refreshYamlBox();
  });

 getFeatureBtn.addEventListener("click", () => {
  const h = getHash();
  h.rsRole = "feature";
  delete h.rsDcid; // clear previous selection
  delete h.rsPath;  
  goHash(h);
  window.location.href = "/localsite/timeline/" + window.location.hash;
});

getTargetBtn.addEventListener("click", () => {
  const h = getHash();
  h.rsRole = "target";
  delete h.rsDcid;
  delete h.rsPath;  
  goHash(h);
  window.location.href = "/localsite/timeline/" + window.location.hash;
});


  // keep UI in sync when hash changes (back/forward/navigation)
  window.addEventListener("hashchange", () => {
    readFromHash();
    render();
    refreshYamlBox();
  });

  // init


  function applyReturnedSelectionIfAny() {
  const h = getHash();

  // Timeline should send back the picked dcid in rsDcid
  const picked = decodeHashValue(h.rsDcid || "");
  const pickedPath = decodeHashValue(h.rsPath || ""); 
  const role = (h.rsRole || "").toLowerCase(); // "feature" or "target"

  if (!picked || !role) return;
h.features = h.features || {};
  h.targets = h.targets || {};
  if (role === "target") {
    uiTarget = picked;
      if (pickedPath) h.targets.path = pickedPath;
  } else if (role === "feature") {
    // append into first empty feature row, else push
    const emptyIndex = uiFeatures.findIndex(v => !(v || "").trim());
    if (emptyIndex >= 0) uiFeatures[emptyIndex] = picked;
    else uiFeatures.push(picked);
       // set features.path if timeline provided one (single path for now)
    if (pickedPath) h.features.path = pickedPath;
  }

  // IMPORTANT: remove rsRole/rsDcid so it doesn’t re-apply on every reload
  delete h.rsRole;
  delete h.rsDcid;
  delete h.rsPath; 
  goHash(h);

  // write merged features/target to hash
  writeToHash();
  render();
  refreshYamlBox();
}

  readFromHash();
  render();
  applyReturnedSelectionIfAny();
}



function parseHashParams() {
    const hash = window.location.hash.substring(1);
    const paramsHere = {};
    hash.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) paramsHere[key] = decodeURIComponent(value || '');
    });
    return paramsHere;
  }


  function displayParams(obj) {
    const paramDiv = document.getElementById('pageparams');
    if (!obj || Object.keys(obj).length === 0) {
      paramDiv.style.display = 'none';
      return;
    }
    paramDiv.style.display = 'block';
    paramDiv.textContent = 'Parameters:\n' + JSON.stringify(obj, null, 2);
  }

document.addEventListener('DOMContentLoaded', function() {
  // Only load paramText if we're not expecting parambase to be loaded later
  // The parambase system will handle this when it's ready
  const hash = getHash();
  if (!hash.parambase) {
    loadParamText();
  }
  
  // Listen for hash changes to update YAML content when hash params change
  window.addEventListener('hashchange', function() {
    handleHashChange();
  });
  
  // Add edit detection for paramText
  setupParamTextEditDetection();
  
  function loadParamText() {
  const el = document.getElementById('paramText');
  if (!el) return;

  let content = el.value || '';
  const hash = getHash();
  console.log("hash:", hash);

  const addHashKeys = ["folder", "features", "targets", "models"];
  let parsedContent = parseYAML(content);
  parsedContent = updateYAMLFromHash(parsedContent, hash, addHashKeys);
  // If URL provides features but no targets, don't keep default targets from textarea
const hasFeatureDcid =
  hash?.features?.dcid || hash["features.dcid"];

const hasTargetDcid =
  hash?.targets?.dcid || hash["targets.dcid"];

if (hasFeatureDcid && !hasTargetDcid && !hash.parambase) {
  delete parsedContent.targets; // removes bees targets
}


  el.value = convertToYAML(parsedContent);

  updateResetButtonVisibility();
}

  
  function handleHashChange() {
    const hash = getHash();
    
    // Filter out script loading parameters (but don't exit)
    filterScriptParamsFromHash(hash, 'Hash change');
    
    // Check for custom YAML URL first
    if (hash.customYamlUrl) {
      const select = document.getElementById('parambase');
      if (select) {
        select.value = 'custom';
        showCustomPathInput();
        // Load custom URL if different from current
        const customUrl = decodeHashValue(hash.customYamlUrl);
        const currentCustomUrl = document.getElementById('customYamlUrl')?.value;
        if (customUrl !== currentCustomUrl) {
          document.getElementById('customYamlUrl').value = customUrl;
          // Load the YAML
          fetch(customUrl)
            .then(response => response.text())
            .then(yamlText => {
              updateParamTextWithBase(yamlText);
              // Set button text to "Loaded" after successful load
              const loadButton = document.getElementById('loadCustomYamlButton');
              if (loadButton) {
                loadButton.textContent = 'Loaded';
              }
            })
            .catch(error => console.error('Error loading custom YAML:', error));
        }
      }
    }
    // If parambase changed, reload the YAML
    else if (hash.parambase) {
      // Decode hash value using shared function
      const decodedParambase = decodeHashValue(hash.parambase);
      
      if (decodedParambase === 'custom') {
        // Show custom path input for parambase=custom
        const select = document.getElementById('parambase');
        if (select) {
          select.value = 'custom';
          showCustomPathInput();
        }
      } else {
        // Hide custom path when switching to regular parambase
        hideCustomPathInput();
        
        if (decodedParambase !== currentParambase) {
          const select = document.getElementById('parambase');
          if (select && select.options.length > 0) {
            console.log('HandleHashChange - Trying to set dropdown to:', decodedParambase);
            console.log('HandleHashChange - Available options:', Array.from(select.options).map(opt => opt.value));
            select.value = decodedParambase;
            // Find the selected option by value (compare with decoded value)
            const selectedOption = Array.from(select.options).find(option => option.value === decodedParambase);
            console.log('HandleHashChange - Found matching option:', selectedOption);
            if (selectedOption && selectedOption.dataset && selectedOption.dataset.url) {
              loadParambaseYAML(decodedParambase, selectedOption.dataset.url);
            } else {
              console.warn('HandleHashChange - No matching option found for parambase:', decodedParambase);
            }
          }
        }
      }
    } else {
      // No parambase or customYamlUrl - hide custom path and use regular loading
      hideCustomPathInput();
      if (currentParambase) {
        // Just update existing content with new hash values
        const cachedYaml = cachedParambaseContent[currentParambase];
        if (cachedYaml) {
          updateParamTextWithBase(cachedYaml);
        }
      } else {
        // No parambase, use regular loading
        loadParamText();
      }
    }
    
    // Update reset button visibility after hash changes
    updateResetButtonVisibility();
  }
});



// Parse YAML content from the #paramText element
function parseYamlContent() {
  const el = document.getElementById('paramText');
  return el ? (el.value || '') : '';
}


// Function to convert YAML to URL parameters
function yamlToUrlParams(yamlStr) {
  let obj;
  try {
    obj = jsyaml.load(yamlStr);
  } catch (e) {
    console.warn("yamlToUrlParams: YAML parse failed", e);
    return "";
  }

  const hashParams = [];

  // folder
  if (obj?.folder) {
    hashParams.push(`folder=${encodeURIComponent(obj.folder)}`);
  }

  // target (single)
  const targetDcid = obj?.targets?.dcid;
  if (targetDcid) {
    hashParams.push(`targets.dcid=${encodeURIComponent(targetDcid)}`);
  }

  const targetPath = obj?.targets?.path;            // add
if (targetPath) hashParams.push(`targets.path=${encodeURIComponent(targetPath)}`);

// features path (single string in YAML)
const featuresPath = obj?.features?.path;         // add
if (featuresPath) hashParams.push(`features.path=${encodeURIComponent(featuresPath)}`);

  // features (multiple)
  let features = [];

  // case 1: features as array of objects
  if (Array.isArray(obj?.features)) {
    features = obj.features
      .map(f => f?.dcid)
      .filter(Boolean);
  }

  // case 2: features.dcid as string or array
  else if (obj?.features?.dcid) {
    if (Array.isArray(obj.features.dcid)) {
      features = obj.features.dcid;
    } else {
      features = String(obj.features.dcid)
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  if (features.length) {
    hashParams.push(
      `features.dcid=${features.map(encodeURIComponent).join(",")}`
    );
  }

  // models
  if (obj?.models) {
    if (typeof obj.models === "string") {
      hashParams.push(`models=${encodeURIComponent(obj.models)}`);
    } else if (obj.models?.name) {
      hashParams.push(`models=${encodeURIComponent(obj.models.name)}`);
    }
  }

  return hashParams.join("&");
}



// Global variable to store cached parambase YAML content
let cachedParambaseContent = {};
let currentParambase = null;

// Function to create choose links after parambase dropdown
function createChooseLinks() {
    // Check if choose links already exist
    if (document.getElementById('chooseLinks')) {
        return;
    }
    
    // Create choose links div
    const chooseDiv = document.createElement('div');
    chooseDiv.id = 'chooseLinks';
    chooseDiv.style.marginTop = '10px';
    chooseDiv.innerHTML = `
        Choose:
        
        <a href="#" onclick="goToPage('/realitystream/models'); return false;">models</a> | 
        <a href="#geoview=country">location</a> 
        <div class="local" style="display:none">
            | <a href="#" onclick="goToPage('/localsite/info'); return false;">features</a> |
            <a href="#" onclick="goToPage('/localsite/timeline'); return false;">targets</a>
        </div>
        <span style="font-style: italic; font-size: 0.9em;"> (Location selector not yet integrated.)</span>
    `;
    
    // Insert after the parambase select
    const parambaseSelect = document.getElementById('parambase');
    parambaseSelect.parentNode.insertBefore(chooseDiv, parambaseSelect.nextSibling);
}

// Function to load base parameter selector dropdown
async function loadBaseParamsSelect() {
    console.log('loadBaseParamsSelect() called');
    const hash = getHash();

    const hashDriven = hasRecognizedParamsInHash(hash) && !hash.parambase;

if (hashDriven) {
  console.log('[parambase] Hash-driven config detected (no parambase). Will populate dropdown but skip auto-load.');
}

    // Insert dropdown before the paramText div
    const paramTextDiv = document.getElementById('paramText');
    console.log('paramText div found:', !!paramTextDiv);
    

    // Fetch parameter paths CSV
    console.log('Fetching CSV from /realitystream/parameters/parameter-paths.csv');
    const response = await fetch('/realitystream/parameters/parameter-paths.csv', { cache: 'no-store' });
    console.log('CSV fetch response status:', response.status);

    if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }

    let csvText = await response.text();
    // Strip UTF-8 BOM if present
    csvText = csvText.replace(/^\uFEFF/, '');
    console.debug('[parambase] CSV loaded (no-store), length:', csvText.length);
    console.log('CSV first 100 chars:', csvText.substring(0, 100));
    
    // Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('CSV lines found:', lines.length);
    const paramOptions = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            // Handle potential BOM and parse CSV line
            const cleanLine = line.replace(/^\uFEFF/, ''); // Remove BOM
            const [key, url] = cleanLine.split(',');
            if (key && url) {
                paramOptions.push({ key: key.trim(), url: url.trim() });
            }
        }
    }

    // Populate dropdown
    const select = document.getElementById('parambase');
    console.log('Parambase select element found:', !!select);
    
    if (!select) {
        console.error('Could not find parambase select element');
        return;
    }
    
    select.innerHTML = '<option value="">Select parameter base...</option>';
    
    console.log('Populating dropdown with', paramOptions.length, 'options');
    paramOptions.forEach(option => {
        console.log('Adding option:', option.key);
        const optionEl = document.createElement('option');
        optionEl.value = option.key;
        optionEl.textContent = option.key;
        optionEl.dataset.url = option.url;
        select.appendChild(optionEl);
    });
    
    // Add "Custom Path..." option at the end
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom Path...';
    select.appendChild(customOption);

    // Create the choose links after the dropdown
    createChooseLinks();

    // Set up event listener for dropdown changes
   select.addEventListener('change', async function() {
  const selectedKey = this.value;

  const currentHash = getHash();

  // remove script params that should not be in hash
  delete currentHash.showheader;
  delete currentHash.showsearch;

  // remove old YAML overrides so new parambase can load cleanly
  delete currentHash.folder;
  delete currentHash.features;
  delete currentHash.targets;
  delete currentHash.models;

    // clear "return from timeline" flags too
  delete currentHash.rsRole;
  delete currentHash.rsDcid;
  delete currentHash.rsPath;

  // also remove dotted keys if they exist
  Object.keys(currentHash).forEach(k => {
    if (
      k === "folder" ||
      k.startsWith("features.") ||
      k.startsWith("targets.") ||
      k.startsWith("models.") ||
      k.startsWith("rs")
    ) {
      delete currentHash[k];
    }
  });


  delete currentHash["features.path"];
  delete currentHash["targets.path"];
  delete currentHash["features.dcid"];
  delete currentHash["targets.dcid"];


  if (selectedKey === 'custom') {
    showCustomPathInput();
    delete currentHash.customYamlUrl;
    currentHash.parambase = 'custom';
    goHash(currentHash);
    return;
  }

  if (selectedKey) {
    hideCustomPathInput();
    delete currentHash.customYamlUrl;
    currentHash.parambase = selectedKey;
    goHash(currentHash);

    // load YAML for selection
    const url = this.selectedOptions[0]?.dataset?.url;
    if (url) await loadParambaseYAML(selectedKey, url);
    return;
  }

  // selectedKey is empty
  hideCustomPathInput();
  delete currentHash.customYamlUrl;
  delete currentHash.parambase;
  goHash(currentHash);
});


    // Check if there's already a parambase in the URL hash
    // const hash = getHash();
    
    // Filter out script loading parameters (but don't exit if they exist)
    filterScriptParamsFromHash(hash, 'Initial load');
    
    if (hash.customYamlUrl) {
        // Custom URL in hash - set dropdown to custom and show custom input
        select.value = 'custom';
        showCustomPathInput();
        // Load the custom URL
        try {
            const customUrl = decodeHashValue(hash.customYamlUrl);
            document.getElementById('customYamlUrl').value = customUrl;
            const response = await fetch(customUrl);
            const yamlText = await response.text();
            updateParamTextWithBase(yamlText);
            // Set button text to "Loaded" since we successfully loaded from hash
            const loadButton = document.getElementById('loadCustomYamlButton');
            if (loadButton) {
                loadButton.textContent = 'Loaded';
            }
        } catch (error) {
            console.error('Error loading custom YAML from hash:', error);
        }
    } else if (hash.parambase) {
        // Decode hash value using shared function
        const decodedParambase = decodeHashValue(hash.parambase);
        
        if (decodedParambase === 'custom') {
            // Set dropdown to custom and show custom input
            select.value = 'custom';
            showCustomPathInput();
        } else {
            // Set dropdown to the decoded hash value
            console.log('Trying to set dropdown to:', decodedParambase);
            console.log('Available options:', Array.from(select.options).map(opt => opt.value));
            select.value = decodedParambase;
            // Find the selected option by value (compare with decoded value)
            const selectedOption = Array.from(select.options).find(option => option.value === decodedParambase);
            console.log('Found matching option:', selectedOption);
            if (selectedOption && selectedOption.dataset && selectedOption.dataset.url) {
                await loadParambaseYAML(decodedParambase, selectedOption.dataset.url);
            } else {
                console.warn('No matching option found for parambase:', decodedParambase);
            }
        }
    } else {
      // If hash already contains model params, do NOT auto-load the first parambase
  if (hashDriven || hasRecognizedParamsInHash(hash)) {
    console.log('[parambase] Skipping default parambase load (hash already has config)');
    select.value = "";
    loadParamTextFromCurrentState();
  } else {
    // Original behavior: load first option by default
    if (paramOptions.length > 0) {
      const firstOption = paramOptions[0];
      select.value = firstOption.key;
      updateHashParam('parambase', firstOption.key);
      await loadParambaseYAML(firstOption.key, firstOption.url);
    }
  }
    }

    // Ensure UI elements are created after dropdown is populated
    ensureParambaseUI();
    initFeatureTargetPanel();

}

function hasRecognizedParamsInHash(hash) {
  if (!hash) return false;

  // direct keys
  if (hash.folder) return true;

  // nested objects (getHash seems to build these, since you use hash.features?.dcid)
  if (hash.features && Object.keys(hash.features).length) return true;
  if (hash.targets && Object.keys(hash.targets).length) return true;
  if (hash.models && Object.keys(hash.models).length) return true;

  // fallback: dotted keys if they exist
  return Object.keys(hash).some(k =>
    k === "folder" ||
    k.startsWith("features.") ||
    k.startsWith("targets.") ||
    k.startsWith("models.")
  );
}


// Function to load YAML content from parambase URL
async function loadParambaseYAML(key, url) {
    try {
        // Don't reload if it's the same parambase
        if (currentParambase === key && cachedParambaseContent[key]) {
            return;
        }

        // Fetch YAML content
        const response = await fetch(url);
        const yamlText = await response.text();
        
        // Cache the content
        cachedParambaseContent[key] = yamlText;
        currentParambase = key;
        
        // Update the paramText div with new base YAML
        updateParamTextWithBase(yamlText);
        // keep panel synced to new YAML
window.dispatchEvent(new HashChangeEvent("hashchange"));

        
    } catch (error) {
        console.error('Error loading parambase YAML:', error);
    }
}

// Function to update paramText div with base YAML and apply hash overrides
function updateParamTextWithBase(baseYamlText) {
  const el = document.getElementById('paramText');
  if (!el) return;

  const hash = getHash();

  // 🚫 If hash already defines model config, DO NOT overwrite with base YAML
  if (!hash.parambase && shouldSkipBaseYamlLoad(hash)) {
    console.log('[RealityStream] Skipping base YAML load, using hash-driven config');

    let parsed = parseYAML(el.value || baseYamlText || '');
    parsed = updateYAMLFromHash(parsed, hash, ["folder", "features", "targets", "models"]);
    el.value = convertToYAML(parsed);

    updateResetButtonVisibility();
    return;
  }

  // ✅ Normal behavior
  el.value = baseYamlText;

  let parsedContent = parseYAML(baseYamlText);
  parsedContent = updateYAMLFromHash(parsedContent, hash, ["folder", "features", "targets", "models"]);
  el.value = convertToYAML(parsedContent);

  updateResetButtonVisibility();
}



// Helper function to encode only necessary characters in hash values
function encodeHashValue(value) {
    return String(value)
        .replace(/ /g, '%20')   // Space to %20
        .replace(/&/g, '%26')   // Ampersand to %26
        .replace(/=/g, '%3D');  // Equals to %3D
}

// Helper function to decode hash values
function decodeHashValue(value) {
    if (!value) return value;
    return decodeURIComponent(String(value)
        .replace(/\+/g, ' '));  // + to space (URL encoding), then decode URI components
}

// Function to show custom path input
function showCustomPathInput() {
    // Check if custom path div already exists
    let customDiv = document.getElementById('customPathDiv');
    if (customDiv) {
        customDiv.style.display = 'block';
        return;
    }
    
    // Create custom path input div
    customDiv = document.createElement('div');
    customDiv.id = 'customPathDiv';
    customDiv.style.marginTop = '10px';
    customDiv.innerHTML = `
        <p><strong>Load YAML from custom URL:</strong></p>
        <div style="display: flex; gap: 10px; align-items: center; margin-top: 8px; margin-bottom: 12px;">
            <input type="url" id="customYamlUrl" placeholder="Paste URL to parameters.yaml" 
                   style="flex: 1; padding:10px; font-size:14px;"
                   value="https://raw.githubusercontent.com/ModelEarth/RealityStream/main/parameters/parameters.yaml">
            <button id="loadCustomYamlButton" style="padding: 10px 16px; font-size: 14px; white-space: nowrap;">Load it</button>
        </div>
    `;
    
    // Insert after the parambase select (or after choose links if they exist)
    const parambaseSelect = document.getElementById('parambase');
    const chooseLinks = document.getElementById('chooseLinks');
    const insertAfter = chooseLinks || parambaseSelect;
    insertAfter.parentNode.insertBefore(customDiv, insertAfter.nextSibling);
    
    // Set up event listener for the load button
    const loadButton = document.getElementById('loadCustomYamlButton');
    const urlInput = document.getElementById('customYamlUrl');
    
    loadButton.addEventListener('click', async function() {
        const customUrl = urlInput.value.trim();
        if (customUrl) {
            try {
                // Load YAML from custom URL
                const response = await fetch(customUrl);
                const yamlText = await response.text();
                
                // Update the paramText div with custom YAML
                updateParamTextWithBase(yamlText);
                
                // Update hash to reflect custom URL
                updateHashParam('customYamlUrl', customUrl);
                
                // Change button text to "Loaded"
                loadButton.textContent = 'Loaded';
                
                console.log('Loaded custom YAML from:', customUrl);
            } catch (error) {
                console.error('Error loading custom YAML:', error);
                alert('Failed to load YAML from custom URL: ' + error.message);
            }
        }
    });
    
    // Set up event listener for URL input changes
    urlInput.addEventListener('input', function() {
        // Change button text back to "Load it" when URL is edited
        loadButton.textContent = 'Load it';
    });
}

// Function to hide custom path input
function hideCustomPathInput() {
    const customDiv = document.getElementById('customPathDiv');
    if (customDiv) {
        customDiv.style.display = 'none';
    }
}

// Helper function to filter out script loading parameters that don't belong in hash
function filterScriptParamsFromHash(hash, context = 'unknown') {
    if (hash.showheader || hash.showsearch) {
        console.log(`⚠️ ${context}: Detected script loading parameters in hash (these should be query params, not hash params):`, {
            showheader: hash.showheader,
            showsearch: hash.showsearch,
            fullHash: {...hash}
        });
        delete hash.showheader;
        delete hash.showsearch;
        return true; // Indicates filtering occurred
    }
    return false; // No filtering needed
}

// Helper function to update a single hash parameter
function updateHashParam(key, value) {
    const hash = getHash();
    hash[key] = value;
    
    // Filter out incorrect parameters
    filterScriptParamsFromHash(hash, 'updateHashParam');
    
    // Use existing goHash function from localsite.js
    goHash(hash);
}

// Helper function to get the parambase select element (supports both #parambase and #parambase-select)
function getParambaseSelect() {
    return document.getElementById('parambase') || document.getElementById('parambase-select');
}

// Helper function to ensure parambase UI elements exist (idempotent)
function ensureParambaseUI() {
    const selectEl = getParambaseSelect();
    if (!selectEl) {
        console.warn('ensureParambaseUI: No parambase select element found');
        return;
    }

    // Check if wrapper row already exists
    let wrapperRow = document.getElementById('parambase-row');
    if (wrapperRow) {
        // Already exists, just update the YAML link
        updateYamlLink(selectEl);
        return;
    }

    // Create wrapper row
    wrapperRow = document.createElement('div');
    wrapperRow.id = 'parambase-row';
    wrapperRow.style.display = 'flex';
    wrapperRow.style.alignItems = 'center';
    wrapperRow.style.gap = '6px';
    wrapperRow.style.marginBottom = '10px';

    // Create label
    const label = document.createElement('label');
    label.id = 'parambase-label';
    label.textContent = 'Base parameters:';
    label.style.fontSize = '14px';
    label.style.marginRight = '8px';
    label.style.marginBottom = '0';


    // Create Base YAML link
    const yamlLink = document.createElement('a');
    yamlLink.id = 'parambase-yaml';
    yamlLink.target = '_blank';
    yamlLink.rel = 'noopener';
    yamlLink.textContent = 'Base YAML';
    yamlLink.style.fontSize = '12px';
    yamlLink.style.marginLeft = '6px';
    yamlLink.style.textDecoration = 'none';
    yamlLink.style.color = 'inherit';


    // Create Reset button (initially hidden)
    const resetButton = document.createElement('button');
    resetButton.id = 'parambase-reset';
    resetButton.type = 'button';
    resetButton.textContent = 'Reset';
    resetButton.className = 'btn btn-white btn-sm';
    resetButton.title = 'Clear URL parameters and reload base YAML';
    resetButton.style.fontSize = '12px';
    resetButton.style.marginLeft = '6px';
    resetButton.style.padding = '2px 6px';
    resetButton.style.whiteSpace = 'nowrap';
    resetButton.style.display = 'none'; // Initially hidden

    // Insert elements in correct order: label, select, yaml link, reset button
    const parent = selectEl.parentNode;
    parent.insertBefore(wrapperRow, selectEl);

    // Add label to wrapper
    wrapperRow.appendChild(label);

    // Move select into wrapper
    wrapperRow.appendChild(selectEl);

    // Add yaml link and reset button to wrapper
    wrapperRow.appendChild(yamlLink);
    wrapperRow.appendChild(resetButton);


    // Set up reset button handler
    resetButton.addEventListener('click', function() {
        console.info('[parambase] Reset: retaining current parambase, clearing other hash values');

        // Get currently selected parambase
        const currentParambase = selectEl.value;
        
        // Clear localStorage keys
        localStorage.removeItem('parambase/value');
        localStorage.removeItem('parambase/url');

        // Create new URL with only parambase in hash (if one is selected)
        const newHashString = currentParambase ? `parambase=${encodeURIComponent(currentParambase)}` : '';
        const newUrl = window.location.pathname + window.location.search + (newHashString ? '#' + newHashString : '');
        
        // Update URL directly without using goHash
        window.history.pushState('', '', newUrl);
        
        // Directly reload the YAML content immediately
        if (currentParambase && cachedParambaseContent[currentParambase]) {
            // Use the cached base YAML for the current parambase
            updateParamTextWithBase(cachedParambaseContent[currentParambase]);
        } else {
            // Fall back to loading from current state
            loadParamTextFromCurrentState();
        }
        
        // Also trigger custom hash change event for any other listeners
        const hashChangeEvent = new CustomEvent('hashChangeEvent', { detail: { parambase: currentParambase } });
        document.dispatchEvent(hashChangeEvent);
    });

    // Update YAML link and reset button visibility initially
    updateYamlLink(selectEl);
    updateResetButtonVisibility();

    // Add change listener for YAML link updates (only if not already present)
    if (!selectEl.hasAttribute('data-yaml-listener-added')) {
        selectEl.addEventListener('change', function() {
            updateYamlLink(this);
            updateResetButtonVisibility();
        });
        selectEl.setAttribute('data-yaml-listener-added', 'true');
    }
}

// Helper function to update the YAML link href
function updateYamlLink(selectEl) {
    const yamlLink = document.getElementById('parambase-yaml');
    if (!yamlLink) return;

    const selectedOption = selectEl.selectedOptions[0];
    if (selectedOption && selectedOption.dataset && selectedOption.dataset.url) {
        yamlLink.href = selectedOption.dataset.url;
    } else {
        yamlLink.href = '';
    }
}

// Helper function to check if current YAML differs from base and show/hide reset button
function updateResetButtonVisibility() {
    const resetButton = document.getElementById('parambase-reset');
    if (!resetButton) return;

    // Check if there are any hash parameters that would modify the YAML content
    const hash = getHash();
    const modelHashParams = ["folder", "features", "targets", "models"];

    
    // Check if any model parameters exist in the hash
    const hasYamlOverrides = modelHashParams.some(param => {
        if (hash[param]) return true;
        // Check for nested parameters like features.data, targets.path, etc.
        return Object.keys(hash).some(key => key.startsWith(param + '.'));
    });

    // Show reset button only if there are YAML overrides from URL hash
    resetButton.style.display = hasYamlOverrides ? 'inline-block' : 'none';
}

// Function to setup edit detection for paramText
function setupParamTextEditDetection() {
  let editTimeout;
  let baseYamlContent = null;

  function storeBaseYamlContent() {
    if (currentParambase && cachedParambaseContent[currentParambase]) {
      baseYamlContent = cachedParambaseContent[currentParambase];
    }
  }

  function handleParamTextEdit() {
    const el = document.getElementById('paramText');
    if (!el) return;

    const currentContent = el.value || '';

    if (!baseYamlContent || !currentParambase) return;

    try {
      const baseYaml = parseYAML(baseYamlContent);
      const currentYaml = parseYAML(currentContent);

      const differences = findYamlDifferences(baseYaml, currentYaml);

      if (Object.keys(differences).length > 0) {
        updateHash(differences, true);
        updateResetButtonVisibility();
      } else {
        const hash = getHash();
        const modelHashParams = ["features", "targets", "models"];
        const toRemove = {};

        modelHashParams.forEach(param => {
          if (hash[param]) toRemove[param] = '';
          Object.keys(hash).forEach(key => {
            if (key.startsWith(param + '.')) toRemove[key] = '';
          });
        });

        if (Object.keys(toRemove).length > 0) updateHash(toRemove, true);
        updateResetButtonVisibility();
      }
    } catch (e) {
      console.warn('Error parsing YAML during edit detection:', e);
    }
  }

  const el = document.getElementById('paramText');
  if (!el) {
    setTimeout(setupParamTextEditDetection, 1000);
    return;
  }

  storeBaseYamlContent();

  el.addEventListener('input', () => {
    clearTimeout(editTimeout);
    editTimeout = setTimeout(handleParamTextEdit, 500);
  });

  el.addEventListener('keyup', () => {
    clearTimeout(editTimeout);
    editTimeout = setTimeout(handleParamTextEdit, 500);
  });
}


// Helper function to determine if a change is meaningful (not just whitespace or trivial punctuation)
function isMeaningfulChange(baseValue, currentValue) {
    // Convert to strings for comparison
    const baseStr = String(baseValue || '').trim();
    const currentStr = String(currentValue || '').trim();
    
    // If strings are the same after trimming, not meaningful
    if (baseStr === currentStr) return false;
    
    // Check if the only difference is trailing punctuation (comma, semicolon, etc.)
    const baseTrimmed = baseStr.replace(/[,;:\s]+$/, '');
    const currentTrimmed = currentStr.replace(/[,;:\s]+$/, '');
    
    // If the content is the same after removing trailing punctuation, not meaningful
    if (baseTrimmed === currentTrimmed) return false;
    
    // Check if the only difference is leading/trailing whitespace or punctuation
    const baseNormalized = baseStr.replace(/^[\s,;:]+|[\s,;:]+$/g, '');
    const currentNormalized = currentStr.replace(/^[\s,;:]+|[\s,;:]+$/g, '');
    
    if (baseNormalized === currentNormalized) return false;
    
    // If we get here, it's a meaningful change
    return true;
}

// Function to find differences between base and current YAML
function findYamlDifferences(baseYaml, currentYaml) {
    const differences = {};
    const modelHashParams = ["features", "targets", "models"];
    
    // Helper function to flatten nested objects for comparison
    function flattenObject(obj, prefix = '') {
        const flattened = {};
        Object.keys(obj || {}).forEach(key => {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(flattened, flattenObject(obj[key], newKey));
            } else {
                // Don't flatten arrays - treat them as complete values
                flattened[newKey] = obj[key];
            }
        });
        return flattened;
    }
    
    // Only compare model-related parameters
    modelHashParams.forEach(param => {
        if (currentYaml[param] || baseYaml[param]) {
            const baseValue = baseYaml[param];
            const currentValue = currentYaml[param];
            
            console.log(`Comparing ${param}:`, { baseValue, currentValue });
            
            // For top-level parameters, compare directly without flattening
            if (JSON.stringify(baseValue) !== JSON.stringify(currentValue)) {
                if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
                    // Check if this is a meaningful change (not just whitespace or punctuation)
                    if (isMeaningfulChange(baseValue, currentValue)) {
                        console.log(`Found meaningful difference in ${param}:`, currentValue);
                        differences[param] = currentValue;
                    } else {
                        console.log(`Ignoring trivial change in ${param}:`, { base: baseValue, current: currentValue });
                    }
                }
            }
            
            // If the parameter is an object, also check nested properties
            if (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
                const baseFlat = flattenObject(baseValue || {}, param);
                const currentFlat = flattenObject(currentValue || {}, param);
                
                // Find differences in nested properties
                Object.keys({...baseFlat, ...currentFlat}).forEach(key => {
                    // Skip the top-level key we already handled
                    if (key === param) return;
                    
                    const baseNestedValue = baseFlat[key];
                    const currentNestedValue = currentFlat[key];
                    
                    if (JSON.stringify(baseNestedValue) !== JSON.stringify(currentNestedValue)) {
                        if (currentNestedValue !== undefined && currentNestedValue !== null && currentNestedValue !== '') {
                            // Check if this is a meaningful change for nested properties too
                            if (isMeaningfulChange(baseNestedValue, currentNestedValue)) {
                                console.log(`Found meaningful nested difference in ${key}:`, currentNestedValue);
                                differences[key] = currentNestedValue;
                            } else {
                                console.log(`Ignoring trivial nested change in ${key}:`, { base: baseNestedValue, current: currentNestedValue });
                            }
                        }
                    }
                });
            }
        }
    });
    
    return differences;
}

// Helper functions for YAML parsing (moved from anonymous functions)
function parseYAML(yamlString) {
    yamlString = yamlString.replace(/<b>|<\/b>/g, '');
    return jsyaml.load(yamlString);
}

function convertToYAML(obj) {
    return jsyaml.dump(obj, {
        lineWidth: -1,
        noCompatMode: true
    });
}

// Get model parameters from textbox and pass forward in hash.
function goToPage(whatPage) { // Used by RealityStream/index.html
    // Get current hash parameters
    const currentHash = getHash();
    
    // Get YAML content and convert to URL parameters
    const yamlContent = parseYamlContent();
    const yamlParams = yamlToUrlParams(yamlContent);
    
    // Parse YAML params into object for merging
    const yamlParamsObj = {};
    if (yamlParams) {
        yamlParams.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) yamlParamsObj[key] = decodeURIComponent(value || '');
        });
    }
    
    // Merge current hash with YAML params (YAML params take priority)
    const mergedParams = { ...currentHash, ...yamlParamsObj };
    
    // Rebuild hash string with encoded values
    const hashParts = [];
    for (const [key, value] of Object.entries(mergedParams)) {
        if (value !== undefined && value !== null && value !== '') {
            const encodedValue = encodeHashValue(value);
            hashParts.push(`${key}=${encodedValue}`);
        }
    }
    
    const finalHash = hashParts.join('&');
    window.location.href = whatPage + "#" + finalHash;
}
