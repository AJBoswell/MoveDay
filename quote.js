// ── STATE ──
// currentStep is 1-indexed and maps directly to step-pane IDs and progress-step IDs in the HTML.
let currentStep = 1;
const totalSteps = 6;

// Displayed in the step-header label as the user moves through the form.
const stepLabels = ['Address', 'Inventory', 'Storage', 'Loading help', 'Extras', 'Your details'];

// ── INVENTORY — ROOM BY ROOM ──
// Each room renders as a tab in step 2; its items render as quantity-control rows.
// Adding or removing items here automatically updates both the UI and weight calculations
// with no other changes required.
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
// Used to estimate total load weight and choose the minimum viable van.
// Any item not listed here falls back to 20 kg in calculateTotalWeight().
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
// Must be ordered smallest to largest capacity — recommendVans() uses findIndex()
// to locate the first van that fits the load, so order is critical.
// baseRate = £ per km. The lorry's higher rate reflects specialist driver costs.
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

    // These are matched against the destination address string to detect international moves.
    // Matching is a simple substring check (case-insensitive), so keep entries as specific
    // city/country names — short strings like "es" or "de" would cause false positives.
    ferryRoutes: ['france','calais','paris','lyon','marseille','belgium','brussels',
                  'netherlands','amsterdam','spain','madrid','barcelona',
                  'germany','berlin','frankfurt','italy','rome','milan'],
    customsCountries: ['france','belgium','netherlands','germany','spain',
                       'italy','portugal','poland','ireland'],
};

// ── GENERATE REF NUMBER ──
// Omits visually ambiguous characters (0, 1, I, O) so customers can read
// the reference back over the phone without confusion.
function generateRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = 'MD-';
    for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    return ref;
}

// ── CALCULATE TOTAL WEIGHT ──
function calculateTotalWeight() {
    // Falls back to 20 kg for any item not in itemWeights. This handles items
    // added to rooms[] in the future before a weight has been assigned.
    return Object.entries(inventory).reduce((total, [item, qty]) => {
        return total + (itemWeights[item] || 20) * qty;
    }, 0);
}

// ── CHECK IF FERRY NEEDED ──
// Performs a case-insensitive substring match on the full destination address.
// A partial match like "Amsterdam Road" will trigger ferry pricing, so the
// ferryRoutes list uses specific city names rather than country codes.
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
// Always returns exactly 3 options for the email template:
//   A (Recommended) — smallest van that fits the estimated load
//   B (Budget)      — one size down, using multiple vans if the load requires it
//   C (Premium)     — one size up for extra space and flexibility
// Edge cases: if already at the smallest van, B mirrors A with a note;
// if already at the largest, C is dropped and slice(0,3) handles the trim.
function recommendVans(totalKg, distanceKm, addressTo, extras, ynState) {
    const ferry    = needsFerry(addressTo);
    const customs  = needsCustoms(addressTo);
    const loading  = ynState && ynState['loading'] === 'yes';
    const storage  = ynState && ynState['storage'] === 'yes';
    const packing  = extras && extras.toLowerCase().includes('packing');
    const dismantl = extras && extras.toLowerCase().includes('dismantl');

    // Inner function closes over the add-on flags so each of the 3 options
    // gets the same add-on costs applied consistently without re-checking them.
    function calcPrice(van, vans_needed) {
        let total = van.baseRate * distanceKm * vans_needed;        // distance cost
        total += pricing.serviceFee;                                  // service fee
        if (ferry)    total += pricing.ferryEstimate * vans_needed;  // ferry charged per vehicle
        if (customs)  total += pricing.customsEstimate;              // customs charged once per job
        if (loading)  total += pricing.helperLoading + pricing.helperUnloading; // 1 helper both ways
        if (storage)  total += pricing.storagePerWeek;               // 1 week storage
        if (packing)  total += 80;                                    // packing materials estimate
        if (dismantl) total += 60;                                    // dismantling estimate
        total = Math.max(pricing.minCharge, total);
        return Math.round(total / 5) * 5; // round to nearest £5 for cleaner-looking quotes
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
// Generates a fully inline-styled HTML email (no external CSS) so it renders
// correctly in Outlook, Gmail, and Apple Mail. Contains the move summary and
// all 3 quote option cards. This is intended to be included as html_body in
// the submitQuote() webhook payload so Make.com can send it to the customer.
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

// ── INVENTORY STATE ──
// Flat map of item name → quantity. Initialised empty; keys are added on
// first render of each room so every item is always present after step 2 loads.
const inventory = {};
let activeRoom = 0; // index into rooms[] for the currently visible tab

// Initialises the inventory UI — called once on page load.
function buildInventory() {
    renderRoomTabs();
    renderRoomItems();
}

// Redraws the room tab strip. Each tab shows a badge with the total quantity
// of items selected in that room so users can see what they've added at a glance.
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

// Redraws the item grid for the active room tab.
// Item names are slugified (non-alphanumeric → underscore) to produce safe DOM IDs
// used by changeQty() for targeted DOM updates without re-rendering the whole grid.
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

// Updates inventory[item] and patches the DOM in-place rather than re-rendering
// the entire grid, keeping the interaction snappy on slower devices.
function changeQty(item, delta) {
    inventory[item] = Math.max(0, (inventory[item] || 0) + delta);
    const key = item.replace(/[^a-z0-9]/gi, '_');
    const numEl = document.getElementById('qty-' + key);
    if (numEl) numEl.textContent = inventory[item];
    // Toggle the highlight class so items with qty > 0 stand out visually
    const itemEl = document.getElementById('inv-item-' + key);
    if (itemEl) {
        itemEl.className = 'inv-item' + (inventory[item] > 0 ? ' has-qty' : '');
    }
    renderRoomTabs(); // refresh tab badges
    renderSummary();  // refresh the selected-items strip at the bottom
}

// Renders a scrollable strip of tags showing all selected items and quantities.
// Hidden when nothing has been selected.
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

// ── YES/NO CARDS ──
// Tracks answers to binary questions (storage, loading help).
// Keys match the group argument passed from onclick="selectYN(this, 'storage')".
const ynState = {};

// Deselects all cards in the group, selects the clicked one, and stores the answer.
// The data-yn attribute format is "<group>-yes" or "<group>-no" (e.g. "storage-yes").
function selectYN(card, group) {
    document.querySelectorAll(`[data-yn^="${group}"]`).forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    ynState[group] = card.dataset.yn.includes('yes') ? 'yes' : 'no';
}

// ── EXTRAS ──
// Toggling adds/removes the "checked" CSS class which drives both the visual
// tick and the selection state read by submitQuote().
function toggleExtra(el) {
    el.classList.toggle('checked');
}

// ── NAVIGATION ──
// Syncs all visual state to currentStep: which pane is visible, progress bar
// colouring (active/done), step label text, back button visibility, and
// next button label (changes to "Submit quote →" on the final step).
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

// Validates required fields before advancing. Only steps 1 and 6 have required
// fields — intermediate steps (inventory, yes/no, extras) are intentionally
// optional so the form is low-friction.
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

// Highlights a field red and appends an error message below it.
// A one-time 'input' listener auto-clears the error as soon as the user starts typing.
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

// ── SESSION PERSISTENCE ──
// Saves form state to sessionStorage so data survives a page refresh or
// navigating away and back within the same browser tab. Not persisted to
// localStorage because quote data should not outlive the session.
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

// Restores form fields and state objects from sessionStorage on page load.
// Object.assign merges into the existing inventory/ynState rather than replacing
// them so any defaults set during initialisation are preserved.
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

// Validates the current step, saves session state, then advances to the next step.
// On the final step, calls submitQuote() instead of incrementing currentStep.
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
// Collects all form state into a flat payload and POSTs it to the Make.com webhook.
// Make.com receives the data, generates the quote email, and sends it to the customer.
// The button is disabled during the request to prevent double-submission.
// On success the form is hidden and the success pane is shown regardless of
// the response body (Make webhooks return 200 on acceptance with no useful body).
function submitQuote() {
    const btn = document.getElementById('btn-next');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    // Collect inventory (only items with qty > 0)
    const itemsList = Object.entries(inventory)
.filter(([, qty]) => qty > 0)
.map(([item, qty]) => `${item} x${qty}`)
.join(', ') || 'None selected';

    // Collect extras — reads the text content of checked .extra-item elements
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

// ── FLATPICKR DATE PICKER ──
// Fetches booked dates from a public Google Sheet (one date per row in column A,
// format YYYY-MM-DD). Those dates are passed to Flatpickr's disable array so they
// appear greyed out and unselectable. Replace SHEET_ID with the real spreadsheet ID.
const BOOKED_DATES_URL = 'https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=Bookings';

async function getBookedDates() {
    try {
        const res = await fetch(BOOKED_DATES_URL);
        const text = await res.text();
        // CSV rows may be quoted; strip quotes and blank lines, keep only YYYY-MM-DD
        return text.split('\n')
            .map(r => r.replace(/"/g, '').trim())
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    } catch(e) {
        return []; // fail silently — all dates remain available if the sheet is unreachable
    }
}

async function initDatePicker() {
    const bookedDates = await getBookedDates();
    flatpickr('#move-date', {
        dateFormat: 'd-m-y',
        minDate: 'today',
        disablemobile: true,  // use the custom calendar on mobile instead of native date picker
        disable: bookedDates,
        // onDayCreate is called for every day cell rendered in the calendar.
        // Booked dates get a red background so customers know at a glance what's available.
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
// Restore any saved session state, build the inventory grid, then render the UI.
loadSession();
buildInventory();
updateUI();

// ── SHOW/HIDE MAP PANEL ──
// The map panel sits to the right of the form shell in a two-column layout,
// but only on step 1 (address entry) and only on viewports wider than 900px.
// On all other steps or narrower screens it is hidden and the form expands to
// its single-column max-width.
function toggleMapPanel() {
    const panel = document.getElementById('map-panel');
    const layout = document.getElementById('step1-layout');
    if (!panel || !layout) return;
    const isMobile = window.innerWidth <= 900;
    if (currentStep === 1 && !isMobile) {
        panel.classList.remove('hidden');
        layout.style.maxWidth = '1100px'; // wide enough to fit form + map side by side
    } else {
        panel.classList.add('hidden');
        layout.style.maxWidth = '640px';  // single-column form width
    }
}

// Re-check on resize
window.addEventListener('resize', toggleMapPanel);

// Patch updateUI to also toggle map — done this way so both concerns stay
// synchronised without merging the two functions.
const _origUpdateUI = updateUI;
updateUI = function() {
    _origUpdateUI();
    toggleMapPanel();
};
toggleMapPanel();


// ── GOOGLE MAPS AUTOCOMPLETE + ROUTE ──
// Called by the Maps JS API as its load callback (see the script tag in quote.html).
// All map variables are scoped inside this function to avoid polluting the global
// namespace and to prevent hoisting issues before the API has loaded.
function initMaps() {
    const mapEl = document.getElementById('route-map');
    if (!mapEl) return;

    // Minimal map style: POI and transit layers hidden to keep the route clear
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
        polylineOptions: { strokeColor: '#1a8a72', strokeWeight: 5 } // teal brand colour
    });

    const placeholder = document.getElementById('map-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    // Both addresses must be resolved before a route can be drawn
    let fromPlace = null;
    let toPlace = null;

    // Requests a driving route and updates the distance/duration info bar below the map.
    // Also stores the result on window so submitQuote() can read leg distance/duration
    // to include in the webhook payload if needed.
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
    // Requesting only formatted_address and geometry keeps the response small
    // and avoids billing for fields we don't use.
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
