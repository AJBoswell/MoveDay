// ── STATE ──
let currentStep = 1;
const totalSteps = 6;

const stepLabels = ['Address', 'Inventory', 'Storage', 'Loading help', 'Extras', 'Your details'];

// ── INVENTORY — ROOM BY ROOM ──
const rooms = [
    {
        name: 'Living room',
        items: ['Sofa', 'Armchair', 'Coffee table', 'TV', 'TV unit', 'Bookcase', 'Side table', 'Lamp']
    },
    {
        name: 'Bedroom',
        items: ['Double bed', 'Single bed', 'King bed', 'Wardrobe', 'Chest of drawers', 'Bedside table', 'Dressing table', 'Mattress']
    },
    {
        name: 'Dining room',
        items: ['Dining table', 'Dining chairs', 'Sideboard', 'Display cabinet']
    },
    {
        name: 'Kitchen',
        items: ['Fridge / freezer', 'Washing machine', 'Tumble dryer', 'Dishwasher', 'Microwave', 'Oven']
    },
    {
        name: 'Office / other',
        items: ['Desk', 'Office chair', 'Filing cabinet', 'Shelving unit', 'Bike', 'Exercise equipment']
    },
    {
        name: 'Boxes',
        items: ['Boxes (small)', 'Boxes (medium)', 'Boxes (large)', 'Boxes (extra large)', 'Suitcase', 'Bag']
    }
];

const inventory = {};  // item -> qty
let activeRoom = 0;

function buildInventory() {
    renderRoomTabs();
    renderRoomItems();
}

function renderRoomTabs() {
    const tabContainer = document.getElementById('room-tabs');
    tabContainer.innerHTML = '';
    rooms.forEach((room, i) => {
        // Count how many items in this room have qty > 0
        const count = room.items.filter(it => inventory[it] > 0).reduce((sum, it) => sum + inventory[it], 0);
        const tab = document.createElement('div');
        tab.className = 'room-tab' + (i === activeRoom ? ' active' : '');
        tab.innerHTML = room.name + (count > 0 ? `<span class="room-badge">${count}</span>` : '');
        tab.onclick = () => { activeRoom = i; renderRoomTabs(); renderRoomItems(); };
        tabContainer.appendChild(tab);
    });
}

function renderRoomItems() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    rooms[activeRoom].items.forEach(item => {
        if (!(item in inventory)) inventory[item] = 0;
        const key = item.replace(/[^a-z0-9]/gi, '_');
        const div = document.createElement('div');
        div.className = 'inv-item' + (inventory[item] > 0 ? ' has-qty' : '');
        div.id = 'inv-item-' + key;
        div.innerHTML = `
            <span class="inv-name">${item}</span>
            <div class="qty-ctrl">
                <button class="qty-btn" onclick="changeQty('${item}', -1)">−</button>
                <span class="qty-num" id="qty-${key}">${inventory[item] || 0}</span>
                <button class="qty-btn" onclick="changeQty('${item}', 1)">+</button>
            </div>`;
        grid.appendChild(div);
    });
}

function changeQty(item, delta) {
    inventory[item] = Math.max(0, (inventory[item] || 0) + delta);
    const key = item.replace(/[^a-z0-9]/gi, '_');
    const numEl = document.getElementById('qty-' + key);
    if (numEl) numEl.textContent = inventory[item];
    const itemEl = document.getElementById('inv-item-' + key);
    if (itemEl) {
        itemEl.className = 'inv-item' + (inventory[item] > 0 ? ' has-qty' : '');
    }
    renderRoomTabs();
    renderSummary();
}

function renderSummary() {
    const selected = Object.entries(inventory).filter(([, qty]) => qty > 0);
    const summaryEl = document.getElementById('inv-summary');
    const tagsEl = document.getElementById('inv-summary-tags');
    if (!summaryEl || !tagsEl) return;
    if (selected.length === 0) {
        summaryEl.style.display = 'none';
        return;
    }
    summaryEl.style.display = 'block';
    tagsEl.innerHTML = selected.map(([item, qty]) =>
        `<span class="inv-tag">${item} x${qty}</span>`
    ).join('');
}

// ── YES/NO ──
const ynState = {};

function selectYN(card, group) {
    document.querySelectorAll(`[data-yn^="${group}"]`).forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    ynState[group] = card.dataset.yn.includes('yes') ? 'yes' : 'no';
}

// ── EXTRAS ──
function toggleExtra(el) {
    el.classList.toggle('checked');
}

// ── NAVIGATION ──
function updateUI() {
    // Panes
    document.querySelectorAll('.step-pane').forEach((p, i) => {
p.classList.toggle('active', i + 1 === currentStep);
    });

    // Progress
    document.querySelectorAll('.progress-step').forEach((p, i) => {
p.classList.remove('active', 'done');
if (i + 1 === currentStep) p.classList.add('active');
if (i + 1 < currentStep) p.classList.add('done');
    });

    // Label & counter
    document.getElementById('step-label').textContent = stepLabels[currentStep - 1];
    document.getElementById('step-counter-text').textContent = `${currentStep} / ${totalSteps}`;

    // Buttons
    document.getElementById('btn-back').style.display = currentStep > 1 ? 'inline-block' : 'none';
    document.getElementById('btn-next').textContent = currentStep === totalSteps ? 'Submit quote →' : 'Next step';
}

function validateStep() {
    if (currentStep === 1) {
        const from = document.getElementById('address-from').value.trim();
        const to = document.getElementById('address-to').value.trim();
        const propFrom = document.getElementById('prop-from').value;
        const propTo = document.getElementById('prop-to').value;
        const date = document.getElementById('move-date').value.trim();
        if (!from) { showError('address-from', 'Please enter a pickup address'); return false; }
        if (!propFrom) { showError('prop-from', 'Please select a property type'); return false; }
        if (!to) { showError('address-to', 'Please enter a delivery address'); return false; }
        if (!propTo) { showError('prop-to', 'Please select a property type'); return false; }
        if (!date) { showError('move-date', 'Please select a move date'); return false; }
    }
    if (currentStep === 6) {
        const name = document.getElementById('detail-name').value.trim();
        const email = document.getElementById('detail-email').value.trim();
        const phone = document.getElementById('detail-phone').value.trim();
        if (!name) { showError('detail-name', 'Please enter your name'); return false; }
        if (!email || !email.includes('@')) { showError('detail-email', 'Please enter a valid email'); return false; }
        if (!phone) { showError('detail-phone', 'Please enter your phone number'); return false; }
    }
    return true;
}

function showError(fieldId, msg) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.style.borderColor = '#e74c3c';
    field.style.boxShadow = '0 0 0 3px rgba(231,76,60,0.12)';
    let err = field.parentElement.querySelector('.field-error');
    if (!err) {
        err = document.createElement('div');
        err.className = 'field-error';
        err.style.cssText = 'color:#e74c3c;font-size:0.75rem;margin-top:5px;';
        field.parentElement.appendChild(err);
    }
    err.textContent = msg;
    field.addEventListener('input', () => {
        field.style.borderColor = '';
        field.style.boxShadow = '';
        if (err) err.remove();
    }, { once: true });
    field.focus();
}

function saveSession() {
    const data = {
        step: currentStep,
        from: document.getElementById('address-from')?.value || '',
        to: document.getElementById('address-to')?.value || '',
        propFrom: document.getElementById('prop-from')?.value || '',
        propTo: document.getElementById('prop-to')?.value || '',
        date: document.getElementById('move-date')?.value || '',
        inventory: inventory,
        ynState: ynState,
    };
    try { sessionStorage.setItem('moveday_quote', JSON.stringify(data)); } catch(e) {}
}

function loadSession() {
    try {
        const raw = sessionStorage.getItem('moveday_quote');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.from) document.getElementById('address-from').value = data.from;
        if (data.to) document.getElementById('address-to').value = data.to;
        if (data.propFrom) document.getElementById('prop-from').value = data.propFrom;
        if (data.propTo) document.getElementById('prop-to').value = data.propTo;
        if (data.date) document.getElementById('move-date').value = data.date;
        if (data.inventory) Object.assign(inventory, data.inventory);
        if (data.ynState) Object.assign(ynState, data.ynState);
    } catch(e) {}
}

function nextStep() {
    if (!validateStep()) return;
    saveSession();
    if (currentStep < totalSteps) {
        currentStep++;
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        submitQuote();
    }
}

function prevStep() {
    if (currentStep > 1) {
currentStep--;
updateUI();
    }
}

// ── SUBMIT TO MAKE.COM ──
function submitQuote() {
    const btn = document.getElementById('btn-next');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    // Collect inventory (only items with qty > 0)
    const itemsList = Object.entries(inventory)
.filter(([, qty]) => qty > 0)
.map(([item, qty]) => `${item} x${qty}`)
.join(', ') || 'None selected';

    // Collect extras
    const extrasList = Array.from(document.querySelectorAll('.extra-item.checked'))
.map(el => el.querySelector('.extra-title').textContent.trim())
.join(', ') || 'None';

    const payload = {
name: document.getElementById('detail-name').value,
email:document.getElementById('detail-email').value,
phone:document.getElementById('detail-phone').value,
address_from: document.getElementById('address-from').value,
property_from: document.getElementById('prop-from').value,
address_to:   document.getElementById('address-to').value,
property_to:  document.getElementById('prop-to').value,
move_date:    document.getElementById('move-date').value,
inventory:    itemsList,
storage:      ynState['storage'] || 'Not answered',
loading_help: ynState['loading'] || 'Not answered',
extras:       extrasList,
    };

    fetch('https://hook.eu1.make.com/kipa87v6p39qcvs2caf7em7dpaexl1la', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
    })
    .then(() => {
// Show success regardless (Make webhooks return 200 on accepted)
document.getElementById('step-footer').style.display = 'none';
document.getElementById('step-label').textContent = 'All done!';
document.querySelector('.step-counter').style.display = 'none';
document.querySelectorAll('.step-pane').forEach(p => p.classList.remove('active'));
document.getElementById('success-pane').classList.add('active');
document.querySelectorAll('.progress-step').forEach(p => p.classList.add('done'));
    })
    .catch(() => {
btn.textContent = 'Submit quote →';
btn.disabled = false;
alert('Something went wrong — please try again or call us directly.');
    });
}

// ── FLATPICKR DATE ──
// Booked dates are fetched from a public Google Sheet
// Format in the sheet: one date per row in column A, format YYYY-MM-DD
const BOOKED_DATES_URL = 'https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=Bookings';

async function getBookedDates() {
    try {
        const res = await fetch(BOOKED_DATES_URL);
        const text = await res.text();
        return text.split('\n')
            .map(r => r.replace(/"/g, '').trim())
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    } catch(e) {
        return [];
    }
}

async function initDatePicker() {
    const bookedDates = await getBookedDates();
    flatpickr('#move-date', {
        dateFormat: 'd-m-y',
        minDate: 'today',
        disableMobile: true,
        disable: bookedDates,
        onDayCreate: (dObj, dStr, fp, dayElem) => {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (bookedDates.includes(dateStr)) {
                dayElem.title = 'Fully booked';
                dayElem.style.background = '#fee2e2';
                dayElem.style.color = '#ef4444';
                dayElem.style.borderRadius = '4px';
            }
        }
    });
}

initDatePicker();

// ── INIT ──
loadSession();
buildInventory();
updateUI();

// ── SHOW/HIDE MAP PANEL ──
function toggleMapPanel() {
    const panel = document.getElementById('map-panel');
    const layout = document.getElementById('step1-layout');
    if (!panel || !layout) return;
    const isMobile = window.innerWidth <= 900;
    if (currentStep === 1 && !isMobile) {
        panel.classList.remove('hidden');
        layout.style.maxWidth = '1100px';
    } else {
        panel.classList.add('hidden');
        layout.style.maxWidth = '640px';
    }
}

// Re-check on resize
window.addEventListener('resize', toggleMapPanel);

// Patch updateUI to also toggle map
const _origUpdateUI = updateUI;
updateUI = function() {
    _origUpdateUI();
    toggleMapPanel();
};
toggleMapPanel();


// ── GOOGLE MAPS AUTOCOMPLETE + ROUTE ──
// All map vars scoped inside initMaps to avoid hoisting issues
function initMaps() {
    const mapEl = document.getElementById('route-map');
    if (!mapEl) return;

    const map = new google.maps.Map(mapEl, {
        center: { lat: 51.5, lng: -0.1 },
        zoom: 7,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
    });

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: { strokeColor: '#1a8a72', strokeWeight: 5 }
    });

    const placeholder = document.getElementById('map-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    let fromPlace = null;
    let toPlace = null;

    function tryRoute() {
        if (!fromPlace || !toPlace) return;
        directionsService.route({
            origin: fromPlace.geometry.location,
            destination: toPlace.geometry.location,
            travelMode: google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);
                const leg = result.routes[0].legs[0];
                // Main map info bar
                const distEl = document.getElementById('map-distance');
                const durEl = document.getElementById('map-duration');
                const infoEl = document.getElementById('map-info');
                if (distEl) distEl.textContent = leg.distance.text;
                if (durEl) durEl.textContent = leg.duration.text + ' drive';
                if (infoEl) infoEl.classList.add('visible');
                // Store result for reference
                window._lastRouteResult = result;
                window._lastRouteLeg = leg;
            }
        });
    }

    // Autocomplete - FROM
    const acFrom = new google.maps.places.Autocomplete(
        document.getElementById('address-from'),
        { fields: ['formatted_address', 'geometry'] }
    );
    acFrom.addListener('place_changed', () => {
        fromPlace = acFrom.getPlace();
        if (fromPlace.geometry) tryRoute();
    });

    // Autocomplete - TO
    const acTo = new google.maps.places.Autocomplete(
        document.getElementById('address-to'),
        { fields: ['formatted_address', 'geometry'] }
    );
    acTo.addListener('place_changed', () => {
        toPlace = acTo.getPlace();
        if (toPlace.geometry) tryRoute();
    });
}
