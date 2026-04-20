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

function nextStep() {
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
flatpickr('#move-date', {
    dateFormat: 'd-m-y',
    minDate: 'today',
    disableMobile: true,
});

// ── INIT ──
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
                // Store result for mini map
                window._lastRouteResult = result;
                window._lastRouteLeg = leg;
                renderMiniMap();
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
