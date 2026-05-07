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


// ── ITEM WEIGHTS (kg) ──
const itemWeights = {
    // Living room
    'Sofa': 50, 'Armchair': 25, 'Coffee table': 15, 'TV': 20, 'TV unit': 25,
    'Bookcase': 30, 'Side table': 10, 'Lamp': 5,
    // Bedroom
    'Double bed': 60, 'Single bed': 35, 'King bed': 80, 'Wardrobe': 70,
    'Chest of drawers': 40, 'Bedside table': 12, 'Dressing table': 35, 'Mattress': 30,
    // Dining
    'Dining table': 40, 'Dining chairs': 8, 'Sideboard': 50, 'Display cabinet': 45,
    // Kitchen
    'Fridge / freezer': 80, 'Washing machine': 75, 'Tumble dryer': 40,
    'Dishwasher': 50, 'Microwave': 15, 'Oven': 40,
    // Office/other
    'Desk': 35, 'Office chair': 15, 'Filing cabinet': 45, 'Shelving unit': 30,
    'Bike': 12, 'Exercise equipment': 40,
    // Boxes
    'Boxes (small)': 10, 'Boxes (medium)': 15, 'Boxes (large)': 20,
    'Boxes (extra large)': 25, 'Suitcase': 15, 'Bag': 8
};

// ── VAN OPTIONS ──
// baseRate = £ per km
const vanOptions = [
    { name: 'Half van',       capacity: 500,   baseRate: 0.90 },
    { name: 'Full van',       capacity: 1000,  baseRate: 0.90 },
    { name: 'Van + trailer',  capacity: 3000,  baseRate: 0.90 },
    { name: '7-tonne lorry',  capacity: 99999, baseRate: 2.20 }
];

// ── PRICING CONFIG ──
const pricing = {
    minCharge:          150,   // £ minimum job charge
    ferryEstimate:      100,   // £ per vehicle (placeholder — update when confirmed)
    customsEstimate:    100,   // £ flat (placeholder — depends on location)
    helperLoading:      120,   // £ per person for loading
    helperUnloading:    100,   // £ per person for unloading (additional)
    storagePerWeek:     50,    // £ per week (placeholder)
    serviceFee:         100,   // £ fixed service charge added to every job
    ferryRoutes: ['france','calais','paris','lyon','marseille','belgium','brussels',
                  'netherlands','amsterdam','spain','madrid','barcelona',
                  'germany','berlin','frankfurt','italy','rome','milan'],
    customsCountries: ['france','belgium','netherlands','germany','spain',
                       'italy','portugal','poland','ireland'],
};

// ── GENERATE REF NUMBER ──
function generateRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = 'MD-';
    for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    return ref;
}

// ── CALCULATE TOTAL WEIGHT ──
function calculateTotalWeight() {
    return Object.entries(inventory).reduce((total, [item, qty]) => {
        return total + (itemWeights[item] || 20) * qty;
    }, 0);
}

// ── CHECK IF FERRY NEEDED ──
function needsFerry(addressTo) {
    const lower = (addressTo || '').toLowerCase();
    return pricing.ferryRoutes.some(r => lower.includes(r));
}

// ── CHECK IF CUSTOMS NEEDED ──
function needsCustoms(addressTo) {
    const lower = (addressTo || '').toLowerCase();
    return pricing.customsCountries.some(r => lower.includes(r));
}

// ── RECOMMEND VAN OPTIONS ──
function recommendVans(totalKg, distanceKm, addressTo, extras, ynState) {
    const ferry    = needsFerry(addressTo);
    const customs  = needsCustoms(addressTo);
    const loading  = ynState && ynState['loading'] === 'yes';
    const storage  = ynState && ynState['storage'] === 'yes';
    const packing  = extras && extras.toLowerCase().includes('packing');
    const dismantl = extras && extras.toLowerCase().includes('dismantl');

    function calcPrice(van, vans_needed) {
        let total = van.baseRate * distanceKm * vans_needed;        // distance cost
        total += pricing.serviceFee;                                  // service fee
        if (ferry)    total += pricing.ferryEstimate * vans_needed;  // ferry
        if (customs)  total += pricing.customsEstimate;              // customs (once)
        if (loading)  total += pricing.helperLoading + pricing.helperUnloading; // 1 helper both ways
        if (storage)  total += pricing.storagePerWeek;               // 1 week storage
        if (packing)  total += 80;                                    // packing materials estimate
        if (dismantl) total += 60;                                    // dismantling estimate
        total = Math.max(pricing.minCharge, total);
        return Math.round(total / 5) * 5; // round to nearest £5
    }

    // Find the minimum viable van
    let minViableIdx = vanOptions.findIndex(v => v.capacity >= totalKg);
    if (minViableIdx === -1) minViableIdx = 3; // lorry

    // Also consider 2x full vans if that's cheaper/more practical than lorry
    const options = [];

    // Option A: recommended (minimum viable)
    const recVan = vanOptions[minViableIdx];
    options.push({
        ref: generateRef(),
        label: 'Recommended',
        van: recVan.name,
        capacity: recVan.capacity,
        vans: 1,
        price: calcPrice(recVan, 1),
        ferry,
        note: totalKg > recVan.capacity * 0.8 ? 'Best fit for your load' : 'Plenty of space for your items'
    });

    // Option B: lower (one size down, if exists) or 2x smaller vans
    if (minViableIdx > 0) {
        const lowerVan = vanOptions[minViableIdx - 1];
        const vansNeeded = Math.ceil(totalKg / lowerVan.capacity);
        options.push({
            ref: generateRef(),
            label: 'Budget option',
            van: vansNeeded > 1 ? `${vansNeeded}x ${lowerVan.name}` : lowerVan.name,
            capacity: lowerVan.capacity * vansNeeded,
            vans: vansNeeded,
            price: calcPrice(lowerVan, vansNeeded),
            ferry,
            note: vansNeeded > 1 ? `If you have flexibility on move day` : 'If you have less than estimated'
        });
    } else {
        // Already at minimum — offer same but flag it
        options.push({
            ref: generateRef(),
            label: 'Budget option',
            van: recVan.name,
            capacity: recVan.capacity,
            vans: 1,
            price: calcPrice(recVan, 1),
            ferry,
            note: 'Minimum suitable vehicle for your move'
        });
    }

    // Option C: higher (one size up, if exists)
    if (minViableIdx < vanOptions.length - 1) {
        const higherVan = vanOptions[minViableIdx + 1];
        options.push({
            ref: generateRef(),
            label: 'Premium option',
            van: higherVan.name,
            capacity: higherVan.capacity,
            vans: 1,
            price: calcPrice(higherVan, 1),
            ferry,
            note: 'Extra space and flexibility on the day'
        });
    }

    // Ensure exactly 3 options
    return options.slice(0, 3);
}

// ── BUILD HTML EMAIL TEMPLATE ──
function buildEmailHTML(payload, options, totalKg, distanceText, durationText) {
    const ferry = options[0].ferry;
    const optionCards = options.map(opt => `
        <tr>
            <td style="padding:16px;background:#f8fafc;border-radius:10px;margin-bottom:12px;border:1px solid #e2e8f0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <span style="background:#0f1f38;color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;font-family:sans-serif;">${opt.label}</span>
                            <span style="float:right;background:#e6f7f3;color:#1a8a72;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;font-family:sans-serif;">Ref: ${opt.ref}</span>
                        </td>
                    </tr>
                    <tr><td style="padding-top:10px;">
                        <p style="margin:0;font-size:18px;font-weight:700;color:#0f1f38;font-family:sans-serif;">${opt.van}</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;font-family:sans-serif;">Capacity: up to ${opt.capacity >= 99999 ? 'unlimited' : opt.capacity + 'kg'} &nbsp;|&nbsp; ${opt.note}</p>
                    </td></tr>
                    <tr><td style="padding-top:12px;">
                        <p style="margin:0;font-size:28px;font-weight:700;color:#0f1f38;font-family:sans-serif;">£${opt.price} <span style="font-size:14px;font-weight:400;color:#6b7280;">estimated</span></p>
                        ${opt.ferry ? '<p style="margin:4px 0 0;font-size:12px;color:#e8631a;font-family:sans-serif;">* Includes estimated ferry/customs costs — final price confirmed on booking</p>' : ''}
                    </td></tr>
                </table>
            </td>
        </tr>
        <tr><td style="height:10px;"></td></tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background:#0f1f38;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
            <img src="https://static.wixstatic.com/media/611ec0_87da66db9fa54fac8f2509af6c5040b8~mv2.png/v1/crop/x_10,y_1,w_1478,h_1041/fill/w_160,h_116,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/_edited.png" alt="MoveDay Removals" style="height:56px;width:auto;">
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#ffffff;padding:32px;">

            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f1f38;">Your quote is ready, ${payload.name.split(' ')[0]}!</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Here are your personalised options for your move on <strong>${payload.move_date}</strong>.</p>

            <!-- MOVE DETAILS -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:24px;border:1px solid #e2e8f0;">
                <tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">
                        <span style="font-size:12px;color:#6b7280;">FROM</span><br>
                        <span style="font-size:14px;font-weight:600;color:#0f1f38;">${payload.address_from} &nbsp;(${payload.property_from})</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">
                        <span style="font-size:12px;color:#6b7280;">TO</span><br>
                        <span style="font-size:14px;font-weight:600;color:#0f1f38;">${payload.address_to} &nbsp;(${payload.property_to})</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;">
                        <span style="font-size:12px;color:#6b7280;">DISTANCE &nbsp;|&nbsp; TIME &nbsp;|&nbsp; EST. WEIGHT</span><br>
                        <span style="font-size:14px;font-weight:600;color:#0f1f38;">${distanceText} &nbsp;|&nbsp; ${durationText} &nbsp;|&nbsp; ~${totalKg}kg</span>
                    </td>
                </tr>
            </table>

            <!-- OPTIONS -->
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0f1f38;">Your options</p>
            <table width="100%" cellpadding="0" cellspacing="0">
                ${optionCards}
            </table>

            <!-- ADD-ONS BREAKDOWN -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border-radius:10px;padding:14px;margin-top:4px;border:1px solid #fde8d0;margin-bottom:16px;">
                <tr><td>
                    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#e8631a;">Add-ons included in your price</p>
                    ${options[0].ferry ? '<p style="margin:0 0 4px;font-size:12px;color:#374151;font-family:sans-serif;">Ferry: ~£100 per vehicle (subject to date)</p>' : ''}
                    ${needsCustoms(payload.address_to) ? '<p style="margin:0 0 4px;font-size:12px;color:#374151;font-family:sans-serif;">Customs documentation: ~£100</p>' : ''}
                    ${payload.loading_help === 'yes' ? '<p style="margin:0 0 4px;font-size:12px;color:#374151;font-family:sans-serif;">Loading help: £120 | Unloading help: £100</p>' : ''}
                    ${payload.storage === 'yes' ? '<p style="margin:0 0 4px;font-size:12px;color:#374151;font-family:sans-serif;">Storage: £50/week</p>' : ''}
                    ${payload.extras !== 'None' ? `<p style="margin:0 0 4px;font-size:12px;color:#374151;font-family:sans-serif;">Additional services: ${payload.extras}</p>` : ''}
                    <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">Service fee of £100 included. All prices are estimates and confirmed at booking.</p>
                </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr><td align="center">
                    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">To confirm a quote, simply reply to this email with the <strong>Ref number</strong> of your chosen option and we'll be in touch to finalise your booking.</p>
                    <a href="tel:+441233225111" style="display:inline-block;background:#0f1f38;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Call us: 01233 225111</a>
                </td></tr>
            </table>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">MoveDay Removals &nbsp;|&nbsp; 01233 225111 &nbsp;|&nbsp; movedayremovals.co.uk</p>
            <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Prices are estimates only and subject to confirmation. Ferry costs vary by date and are confirmed at booking.</p>
        </td></tr>

    </table>
    </td></tr>
</table>
</body>
</html>`;
}

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

    // Calculate weight and route
    const totalKg = calculateTotalWeight();
    const distanceLeg = window._lastRouteLeg;
    const distanceKm = distanceLeg ? distanceLeg.distance.value / 1000 : 50;
    const distanceText = distanceLeg ? distanceLeg.distance.text : 'Unknown';
    const durationText = distanceLeg ? distanceLeg.duration.text : 'Unknown';
    const addressTo = document.getElementById('address-to').value;

    // Get van recommendations
    const vanOpts = recommendVans(totalKg, distanceKm, addressTo, extrasList, ynState);

    // Build email HTML
    const emailPayload = {
        name:          document.getElementById('detail-name').value,
        address_from:  document.getElementById('address-from').value,
        property_from: document.getElementById('prop-from').value,
        address_to:    addressTo,
        property_to:   document.getElementById('prop-to').value,
        move_date:     document.getElementById('move-date').value,
        extras:        extrasList,
        storage:       ynState['storage'] || 'no',
        loading_help:  ynState['loading'] || 'no',
    };

    const payload = {
        name:          emailPayload.name,
        email:         document.getElementById('detail-email').value,
        phone:         document.getElementById('detail-phone').value,
        address_from:  emailPayload.address_from,
        property_from: emailPayload.property_from,
        address_to:    addressTo,
        property_to:   emailPayload.property_to,
        move_date:     emailPayload.move_date,
        inventory:     itemsList,
        storage:       ynState['storage'] || 'Not answered',
        loading_help:  ynState['loading'] || 'Not answered',
        extras:        extrasList,
        referral:      (document.getElementById('detail-referral') || {}).value || 'None',
        total_weight:  totalKg + 'kg',
        distance:      distanceText,
        option_1_ref:   vanOpts[0].ref,
        option_1_label: vanOpts[0].label,
        option_1_van:   vanOpts[0].van,
        option_1_price: '£' + vanOpts[0].price,
        option_2_ref:   vanOpts[1].ref,
        option_2_label: vanOpts[1].label,
        option_2_van:   vanOpts[1].van,
        option_2_price: '£' + vanOpts[1].price,
        option_3_ref:   vanOpts[2].ref,
        option_3_label: vanOpts[2].label,
        option_3_van:   vanOpts[2].van,
        option_3_price: '£' + vanOpts[2].price,
        customer_email_html: buildEmailHTML(emailPayload, vanOpts, totalKg, distanceText, durationText)
    };

    btn.textContent = 'Sending…';

    fetch('https://hook.eu1.make.com/kipa87v6p39qcvs2caf7em7dpaexl1la', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(() => {
        document.getElementById('step-footer').style.display = 'none';
        document.getElementById('step-label').textContent = 'All done!';
        document.querySelector('.step-counter').style.display = 'none';
        document.querySelectorAll('.step-pane').forEach(p => p.classList.remove('active'));
        document.getElementById('success-pane').classList.add('active');
        document.querySelectorAll('.progress-step').forEach(p => p.classList.add('done'));
        try { sessionStorage.removeItem('moveday_quote'); } catch(e) {}
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
