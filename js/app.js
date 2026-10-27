// ====================== FIREBASE CONFIG ======================
const firebaseConfig = {
  apiKey: "AIzaSyBNdtBbS_iNCQ_KqrgUC61Px5JxkXJm4AA",
  authDomain: "ticket-b3b87.firebaseapp.com",
  projectId: "ticket-b3b87",
  storageBucket: "ticket-b3b87.firebasestorage.app",
  messagingSenderId: "444383773854",
  appId: "1:444383773854:web:a449d727bae32a0047a78f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====================== STATE ======================
let currentUser = null;
let activeEventId = null;
let selectedSeats = [];
let activeBookingId = null;
let activeRef = null;

// ====================== HELPERS ======================
function uid() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}
function refNo() {
  return "REF-" + Math.random().toString(16).slice(2, 10).toUpperCase();
}
function money(n) {
  return "₱" + Number(n).toFixed(2);
}
function $(sel) { return document.querySelector(sel); }
function clearApp() { $("#app").innerHTML = ""; }

// ====================== BOOTSTRAP DEFAULT ACCOUNTS ======================
async function bootstrapDefaultAccounts() {
  try {
    const defaults = [
      { username: "admin", password: "admin", role: "ADMIN" },
      { username: "staff", password: "staff", role: "STAFF" },
      { username: "customer", password: "123", role: "CUSTOMER" }
    ];

    for (const user of defaults) {
      const doc = await db.collection("users").doc(user.username).get();
      if (!doc.exists) {
        await db.collection("users").doc(user.username).set({
          password: user.password,
          role: user.role
        });
        console.log(`Created default account: ${user.username}`);
      }
    }
  } catch (err) {
    console.error("Bootstrap error:", err);
  }
}

// ====================== RENDER FUNCTIONS ======================
function renderRoleSelector() {
  clearApp();
  $("#app").innerHTML = `
    <div class="center-wrap">
      <div class="card" style="text-align:center;">
        <div class="title-accent"><i class="fa-solid fa-ticket"></i> TICKET PORTAL</div>
        <div class="subtitle">Select authentication gate to proceed</div>
        <div class="role-grid">
          <button class="btn" onclick="renderLogin('CUSTOMER')"><i class="fa-solid fa-user"></i> CUSTOMER ACCESS</button>
          <button class="btn" onclick="renderLogin('STAFF')"><i class="fa-solid fa-clipboard-check"></i> STAFF ACCESS</button>
          <button class="btn" onclick="renderLogin('ADMIN')"><i class="fa-solid fa-user-shield"></i> ADMIN ACCESS</button>
          <hr style="border:none;border-top:1px solid var(--bg-input);margin:12px 0;">
          <button class="btn btn-secondary" onclick="renderRegister()"><i class="fa-solid fa-user-plus"></i> NEW ACCOUNT</button>
        </div>
      </div>
    </div>
  `;
}

function renderLogin(role) {
  clearApp();
  $("#app").innerHTML = `
    <div class="center-wrap">
      <div class="card" style="width:380px;">
        <h2 style="color:var(--accent);margin-bottom:20px;"><i class="fa-solid fa-lock"></i> ${role} AUTHENTICATION</h2>
        <label>Username</label>
        <input id="login-user" type="text" placeholder="Enter username">
        <label>Password</label>
        <input id="login-pass" type="password" placeholder="Enter password">
        <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px;">
          <button class="btn" onclick="handleLogin('${role}')"><i class="fa-solid fa-right-to-bracket"></i> LOG IN</button>
          <button class="btn btn-secondary" onclick="renderRoleSelector()"><i class="fa-solid fa-arrow-left"></i> Back</button>
        </div>
      </div>
    </div>
  `;
}

async function handleLogin(targetRole) {
  const u = $("#login-user").value.trim();
  const p = $("#login-pass").value.trim();
  try {
    const doc = await db.collection("users").doc(u).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.password === p && data.role === targetRole) {
        currentUser = { username: u, role: targetRole };
        routeDashboard();
        return;
      }
    }
    alert("Access Denied: Invalid login details or insufficient permissions.");
  } catch (err) {
    alert("Authentication error: " + err.message);
  }
}

function renderRegister() {
  clearApp();
  $("#app").innerHTML = `
    <div class="center-wrap">
      <div class="card" style="width:400px;">
        <h2 style="margin-bottom:16px;"><i class="fa-solid fa-user-plus"></i> ACCOUNT REGISTRATION</h2>
        <label>Username</label>
        <input id="reg-user" type="text" placeholder="Enter username">
        
        <label>Password</label>
        <input id="reg-pass" type="password" placeholder="Enter password">
        
        <label>Confirm Password</label>
        <input id="reg-pass2" type="password" placeholder="Confirm password">
        
        <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px;">
          <button class="btn" onclick="handleRegister()">
            <i class="fa-solid fa-check"></i> REGISTER ACCOUNT
          </button>
          <button class="btn btn-secondary" onclick="renderRoleSelector()">Cancel</button>
        </div>
        <p style="margin-top:16px;font-size:12px;color:var(--text-muted);text-align:center;">
          Only Customer accounts can be created here.<br>
          Staff & Admin accounts are created by Administrator only.
        </p>
      </div>
    </div>
  `;
}

async function handleRegister() {
  const u = $("#reg-user").value.trim();
  const p = $("#reg-pass").value.trim();
  const p2 = $("#reg-pass2").value.trim();

  if (!u || !p) return alert("Required fields cannot be empty.");
  if (p !== p2) return alert("Password confirmation mismatch.");

  try {
    const doc = await db.collection("users").doc(u).get();
    if (doc.exists) return alert("Username is already registered.");

    await db.collection("users").doc(u).set({
      password: p,
      role: "CUSTOMER"
    });

    currentUser = { username: u, role: "CUSTOMER" };
    alert(`Account created successfully for ${u}.`);
    routeDashboard();
  } catch (err) {
    alert("Failed to complete registration: " + err.message);
  }
}

function routeDashboard() {
  if (currentUser.role === "CUSTOMER") renderCustomerView();
  else if (currentUser.role === "STAFF") renderStaffView();
  else if (currentUser.role === "ADMIN") renderAdminView();
}

function logout() {
  currentUser = null;
  activeEventId = null;
  selectedSeats = [];
  activeBookingId = null;
  activeRef = null;
  renderRoleSelector();
}

// ====================== CUSTOMER ======================
function renderCustomerView() {
  clearApp();
  $("#app").innerHTML = `
    <div class="header">
      <h1><i class="fa-solid fa-user"></i> Active User: ${currentUser.username}</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="renderSavedTickets()"><i class="fa-solid fa-ticket"></i> My Tickets</button>
        <button class="btn btn-danger" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
      </div>
    </div>
    <div class="layout">
      <div class="panel">
        <h3 style="color:var(--accent);margin-bottom:12px;"><i class="fa-solid fa-calendar-days"></i> Upcoming Events</h3>
        <input class="search-box" id="event-search" placeholder="Search events..." oninput="renderEventTable()">
        <div id="event-table"></div>
      </div>
      <div class="panel">
        <h3 style="color:var(--accent);margin-bottom:8px;"><i class="fa-solid fa-chair"></i> Seat Selection Map</h3>
        <div class="legend">
          <span><div class="dot" style="background:var(--vip-gold)"></div> VIP (Gold)</span>
          <span><div class="dot" style="background:var(--bg-panel)"></div> Normal</span>
          <span><div class="dot" style="background:var(--accent)"></div> Selected</span>
        </div>
        <div class="seat-map" id="seat-map"></div>
        <div class="summary" id="summary">Selected Seats: None<br>Total: ₱0.00</div>
        <button class="btn" style="margin-top:16px;width:100%;" onclick="submitBooking()">
          <i class="fa-solid fa-credit-card"></i> Proceed to Payment
        </button>
      </div>
    </div>
  `;
  renderEventTable();
}

async function renderEventTable() {
  const term = ($("#event-search")?.value || "").toLowerCase();
  let html = `<table><thead><tr>
    <th>ID</th><th>Event Name</th><th>Schedule</th><th>Normal</th><th>VIP</th>
  </tr></thead><tbody>`;

  try {
    const snap = await db.collection("events").get();
    snap.forEach(doc => {
      const ev = doc.data();
      if (term && !ev.name.toLowerCase().includes(term)) return;
      html += `<tr onclick="selectEvent('${doc.id}')" data-id="${doc.id}">
        <td>${doc.id}</td>
        <td>${ev.name}</td>
        <td>${ev.date_time || "N/A"}</td>
        <td>${money(ev.normal_price || 0)}</td>
        <td>${money(ev.vip_price || 0)}</td>
      </tr>`;
    });
  } catch (err) {
    console.error(err);
  }
  html += `</tbody></table>`;
  $("#event-table").innerHTML = html;
}

async function selectEvent(id) {
  activeEventId = id;
  selectedSeats = [];
  document.querySelectorAll("#event-table tr").forEach(tr => {
    tr.classList.toggle("selected", tr.dataset.id === id);
  });
  await renderSeatMap();
  updateSummary();
}

async function renderSeatMap() {
  const map = $("#seat-map");
  if (!activeEventId) {
    map.innerHTML = "<p style='color:var(--text-muted)'>Select an event first</p>";
    return;
  }
  try {
    const doc = await db.collection("events").doc(activeEventId).get();
    if (!doc.exists) {
      map.innerHTML = "<p style='color:var(--danger)'>Event not found</p>";
      return;
    }
    const seats = doc.data().seats || {};
    let html = "";
    const codes = Object.keys(seats).sort();
    for (const code of codes) {
      const s = seats[code];
      const status = s.status || "available";
      const type = s.type || "Normal";
      const cls = status === "booked" ? "booked" : (selectedSeats.includes(code) ? "selected" : `available ${type.toLowerCase()}`);
      const disabled = status === "booked" ? "disabled" : "";
      html += `<button class="seat ${cls}" ${disabled} onclick="toggleSeat('${code}')">${code}</button>`;
    }
    map.innerHTML = html || "<p style='color:var(--text-muted)'>No seats available</p>";
  } catch (err) {
    map.innerHTML = "<p style='color:var(--danger)'>Failed to load seats</p>";
  }
}

function toggleSeat(code) {
  if (!activeEventId) return;
  if (selectedSeats.includes(code)) {
    selectedSeats = selectedSeats.filter(s => s !== code);
  } else {
    selectedSeats.push(code);
  }
  renderSeatMap();
  updateSummary();
}

async function updateSummary() {
  if (!activeEventId) {
    $("#summary").innerHTML = "Selected Seats: None<br>Total: ₱0.00";
    return;
  }
  try {
    const doc = await db.collection("events").doc(activeEventId).get();
    const ev = doc.data();
    let total = 0;
    selectedSeats.forEach(code => {
      const type = ev.seats[code]?.type || "Normal";
      total += type === "VIP" ? (ev.vip_price || 0) : (ev.normal_price || 0);
    });
    const txt = selectedSeats.length ? selectedSeats.join(", ") : "None";
    $("#summary").innerHTML = `Selected Seats: ${txt} (${selectedSeats.length} tickets)<br>Total: ${money(total)}`;
  } catch (err) {
    console.error(err);
  }
}

async function submitBooking() {
  if (!activeEventId || selectedSeats.length === 0) {
    return alert("Please pick an event and select at least one seat before proceeding.");
  }
  try {
    const doc = await db.collection("events").doc(activeEventId).get();
    if (!doc.exists) return alert("This event has been deleted.");

    const ev = doc.data();
    let total = 0;
    selectedSeats.forEach(code => {
      total += (ev.seats[code]?.type === "VIP" ? ev.vip_price : ev.normal_price) || 0;
    });

    activeBookingId = uid();
    activeRef = refNo();

    await db.collection("bookings").doc(activeBookingId).set({
      ref_no: activeRef,
      customer: currentUser.username,
      event_id: activeEventId,
      event_name: ev.name,
      date_time: ev.date_time || "N/A",
      seats: [...selectedSeats],
      seats_count: selectedSeats.length,
      amount: total,
      payment_method: "Pending",
      status: "Pending Payment",
      verified: false
    });
    renderCheckout();
  } catch (err) {
    alert("Failed to generate transaction: " + err.message);
  }
}

function renderCheckout() {
  clearApp();
  $("#app").innerHTML = `
    <div class="center-wrap">
      <div class="card" style="width:420px;">
        <h2 style="margin-bottom:8px;"><i class="fa-solid fa-receipt"></i> CHECKOUT CONFIRMATION</h2>
        <p style="color:var(--text-muted);margin-bottom:4px;">Reference: <strong>${activeRef}</strong></p>
        <p style="color:var(--text-muted);margin-bottom:4px;">Seats: ${selectedSeats.join(", ")}</p>
        <p style="font-size:18px;font-weight:700;margin:16px 0;" id="checkout-total">Total Payable: calculating...</p>
        <label>Payment Method</label>
        <select id="pay-method">
          <option>Bank Transfer</option>
          <option>E-Wallet (GCash/Maya)</option>
          <option>Cash</option>
        </select>
        <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px;">
          <button class="btn" onclick="confirmPayment()"><i class="fa-solid fa-check-circle"></i> Confirm Payment</button>
          <button class="btn btn-secondary" onclick="renderCustomerView()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  db.collection("bookings").doc(activeBookingId).get().then(doc => {
    if (doc.exists) {
      $("#checkout-total").innerHTML = `Total Payable: ${money(doc.data().amount)}`;
    }
  });
}

async function confirmPayment() {
  const method = $("#pay-method").value;
  try {
    const bookingRef = db.collection("bookings").doc(activeBookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return alert("Booking not found.");

    const booking = bookingSnap.data();

    await bookingRef.update({
      payment_method: method,
      status: "Paid"
    });

    // Mark seats as booked
    const eventRef = db.collection("events").doc(booking.event_id);
    const eventSnap = await eventRef.get();
    if (eventSnap.exists) {
      const seats = eventSnap.data().seats || {};
      booking.seats.forEach(code => {
        if (seats[code]) seats[code].status = "booked";
      });
      await eventRef.update({ seats });
    }

    alert(`Payment successful!\nReference: ${booking.ref_no}`);
    selectedSeats = [];
    activeEventId = null;
    renderCustomerView();
  } catch (err) {
    alert("Payment failed: " + err.message);
  }
}

async function renderSavedTickets() {
  clearApp();
  let rows = "";
  try {
    const snap = await db.collection("bookings")
      .where("customer", "==", currentUser.username)
      .get();

    for (const doc of snap.docs) {
      const b = doc.data();
      let status = b.status;
      if (status === "Cancelled by Staff") status = "Cancelled by Staff";
      else {
        const ev = await db.collection("events").doc(b.event_id).get();
        if (!ev.exists) status = "Event Cancelled";
      }
      rows += `<tr>
        <td>${b.ref_no || doc.id}</td>
        <td>${b.event_name}</td>
        <td>${b.date_time || "N/A"}</td>
        <td>${(b.seats || []).join(", ")}</td>
        <td>${b.payment_method || "N/A"}</td>
        <td>${money(b.amount || 0)}</td>
        <td class="${status.includes("Paid") ? "status-paid" : status.includes("Cancel") ? "status-cancelled" : "status-pending"}">${status}</td>
      </tr>`;
    }
  } catch (err) {
    console.error(err);
  }

  $("#app").innerHTML = `
    <div class="header">
      <h1><i class="fa-solid fa-ticket"></i> Purchased E-Tickets</h1>
      <button class="btn btn-secondary" onclick="renderCustomerView()"><i class="fa-solid fa-arrow-left"></i> Back to Dashboard</button>
    </div>
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <div class="panel">
        <table>
          <thead><tr>
            <th>Reference</th><th>Event</th><th>Date & Time</th><th>Seats</th><th>Payment</th><th>Paid</th><th>Status</th>
          </tr></thead>
          <tbody>${rows || "<tr><td colspan='7' style='text-align:center;color:var(--text-muted)'>No tickets yet</td></tr>"}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ====================== STAFF ======================
function renderStaffView() {
  clearApp();
  $("#app").innerHTML = `
    <div class="header">
      <h1><i class="fa-solid fa-clipboard-check"></i> Staff Operations (${currentUser.username})</h1>
      <button class="btn btn-danger" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    </div>
    <div style="padding:20px;max-width:1100px;margin:0 auto;">
      <div class="panel" style="margin-bottom:16px;">
        <h3 style="color:var(--accent);margin-bottom:12px;"><i class="fa-solid fa-qrcode"></i> Ticket Check-in System</h3>
        <div style="display:flex;gap:10px;">
          <input id="verify-code" placeholder="Enter Reference code..." style="flex:1;">
          <button class="btn" onclick="runVerification()"><i class="fa-solid fa-check"></i> Verify Ticket</button>
        </div>
        <div id="verify-msg" class="msg"></div>
      </div>
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3><i class="fa-solid fa-list"></i> Transaction Audit Log</h3>
          <button class="btn btn-danger" onclick="handleDeleteOrCancel()"><i class="fa-solid fa-trash"></i> Delete/Cancel Ticket</button>
        </div>
        <div id="staff-logs"></div>
      </div>
    </div>
  `;
  reloadStaffLogs();
}

async function runVerification() {
  const val = $("#verify-code").value.trim();
  if (!val) return alert("Please input a valid Reference code.");

  const msg = $("#verify-msg");
  try {
    let snap = await db.collection("bookings").where("ref_no", "==", val).get();
    let doc = snap.empty ? null : snap.docs[0];

    if (!doc) {
      const byId = await db.collection("bookings").doc(val).get();
      if (byId.exists) doc = byId;
    }

    if (!doc) {
      msg.className = "msg err";
      msg.textContent = "REJECTED: Booking reference not found.";
      return;
    }

    const payload = doc.data();
    if (payload.status === "Cancelled by Staff") {
      msg.className = "msg err";
      msg.textContent = "REJECTED: This ticket has been cancelled by staff.";
      return;
    }

    const eventExists = (await db.collection("events").doc(payload.event_id).get()).exists;
    if (!eventExists) {
      msg.className = "msg err";
      msg.textContent = "REJECTED: Associated event has been deleted by admin.";
      return;
    }

    await db.collection("bookings").doc(doc.id).update({ verified: true });
    msg.className = "msg ok";
    msg.textContent = `VALIDATED — Ref: ${payload.ref_no} | Holder: ${payload.customer} | Seats: ${(payload.seats || []).join(", ")}`;
    reloadStaffLogs();
  } catch (err) {
    alert("Verification exception: " + err.message);
  }
}

async function reloadStaffLogs() {
  let html = `<table><thead><tr>
    <th>Reference</th><th>User</th><th>Event</th><th>Seats</th><th>Payment</th><th>Status</th><th>Checked-In</th>
  </tr></thead><tbody>`;

  try {
    const snap = await db.collection("bookings").get();
    for (const doc of snap.docs) {
      const b = doc.data();
      let status = b.status;
      if (status !== "Cancelled by Staff") {
        const ev = await db.collection("events").doc(b.event_id).get();
        if (!ev.exists) status = "Event Deleted";
      }
      html += `<tr data-id="${doc.id}" onclick="selectLog(this)">
        <td>${b.ref_no || doc.id}</td>
        <td>${b.customer}</td>
        <td>${b.event_name}</td>
        <td>${(b.seats || []).join(", ")}</td>
        <td>${b.payment_method || "N/A"}</td>
        <td>${status}</td>
        <td>${b.verified ? "Yes" : "No"}</td>
      </tr>`;
    }
  } catch (err) {
    console.error(err);
  }
  html += `</tbody></table>`;
  $("#staff-logs").innerHTML = html;
}

let selectedLogId = null;
function selectLog(tr) {
  document.querySelectorAll("#staff-logs tr").forEach(r => r.classList.remove("selected"));
  tr.classList.add("selected");
  selectedLogId = tr.dataset.id;
  const cell = tr.querySelector("td");
  if (cell) $("#verify-code").value = cell.textContent;
}

async function handleDeleteOrCancel() {
  if (!selectedLogId) return alert("Please select a ticket/booking row first.");

  try {
    const docRef = db.collection("bookings").doc(selectedLogId);
    const snap = await docRef.get();
    if (!snap.exists) return alert("Booking not found.");

    const b = snap.data();
    const status = b.status;

    if (status === "Cancelled by Staff" || !(await db.collection("events").doc(b.event_id).get()).exists) {
      if (confirm("Do you want to permanently remove this ticket entry?")) {
        await docRef.delete();
        alert("Ticket permanently deleted.");
        reloadStaffLogs();
      }
    } else {
      if (confirm(`Do you want to cancel ticket ${b.ref_no}?`)) {
        await docRef.update({ status: "Cancelled by Staff" });

        const eventRef = db.collection("events").doc(b.event_id);
        const eventSnap = await eventRef.get();
        if (eventSnap.exists) {
          const seats = eventSnap.data().seats || {};
          (b.seats || []).forEach(code => {
            if (seats[code]) seats[code].status = "available";
          });
          await eventRef.update({ seats });
        }
        alert("Ticket has been cancelled.");
        reloadStaffLogs();
      }
    }
  } catch (err) {
    alert("Failed to process ticket: " + err.message);
  }
}

// ====================== ADMIN ======================
function renderAdminView() {
  clearApp();
  $("#app").innerHTML = `
    <div class="header">
      <h1><i class="fa-solid fa-user-shield"></i> Administrator Operations Center (${currentUser.username})</h1>
      <button class="btn btn-danger" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    </div>
    <div class="admin-grid">
      <button class="btn" onclick="modalAddEvent()"><i class="fa-solid fa-calendar-plus"></i> Publish Events</button>
      <button class="btn btn-danger" onclick="modalDeleteEvent()"><i class="fa-solid fa-calendar-xmark"></i> Delete Events</button>
      <button class="btn" onclick="modalAddUser()"><i class="fa-solid fa-user-plus"></i> User Provisioning</button>
      <button class="btn" onclick="modalManageUsers()"><i class="fa-solid fa-users-gear"></i> Manage Users</button>
      <button class="btn" onclick="showAnalytics()"><i class="fa-solid fa-chart-line"></i> Financial Analytics</button>
      <button class="btn btn-secondary" onclick="renderStaffView()"><i class="fa-solid fa-clipboard-list"></i> Open Audit View</button>
    </div>
  `;
}

function modalAddEvent() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="color:var(--accent);margin-bottom:16px;"><i class="fa-solid fa-calendar-plus"></i> EVENT CONFIGURATION</h3>
      <label>Event ID</label><input id="ev-id">
      <label>Event Name</label><input id="ev-name">
      <label>Date (e.g. November 20, 2026)</label><input id="ev-date" value="November 20, 2026">
      <label>Time (e.g. 08:00 PM)</label><input id="ev-time" value="08:00 PM">
      <label>Normal Price (₱)</label><input id="ev-normal" type="number" step="0.01">
      <label>VIP Price (₱)</label><input id="ev-vip" type="number" step="0.01">
      <label>Total Seat Capacity</label><input id="ev-limit" type="number" value="30">
      <div style="margin-top:20px;display:flex;gap:10px;">
        <button class="btn" onclick="commitEvent()"><i class="fa-solid fa-upload"></i> Publish & Generate Seats</button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function commitEvent() {
  const eid = $("#ev-id").value.trim();
  const name = $("#ev-name").value.trim();
  const date = $("#ev-date").value.trim();
  const time = $("#ev-time").value.trim();
  const np = parseFloat($("#ev-normal").value);
  const vp = parseFloat($("#ev-vip").value);
  const limit = parseInt($("#ev-limit").value);

  if (!eid || !name || isNaN(np) || isNaN(vp) || isNaN(limit)) {
    return alert("All parameters are required and must be valid.");
  }

  const seats = {};
  const rows = Math.ceil(limit / 10);
  let counter = 0;
  for (let r = 0; r < rows; r++) {
    const rowLet = String.fromCharCode(65 + r);
    for (let c = 1; c <= 10; c++) {
      if (counter >= limit) break;
      const code = rowLet + c;
      seats[code] = { status: "available", type: r < 2 ? "VIP" : "Normal" };
      counter++;
    }
  }

  try {
    await db.collection("events").doc(eid).set({
      name,
      date_time: `${date} - ${time}`,
      normal_price: np,
      vip_price: vp,
      ticket_limit: limit,
      seats
    });
    alert(`Published event '${name}' with ${limit} generated seats.`);
    document.querySelector(".modal-overlay").remove();
  } catch (err) {
    alert("Failed to publish: " + err.message);
  }
}

async function modalDeleteEvent() {
  let options = "";
  const snap = await db.collection("events").get();
  snap.forEach(doc => {
    const ev = doc.data();
    options += `<tr data-id="${doc.id}"><td>${doc.id}</td><td>${ev.name}</td><td>${ev.date_time}</td></tr>`;
  });

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px;">
      <h3 style="color:var(--danger);margin-bottom:16px;"><i class="fa-solid fa-trash"></i> MANAGE & DELETE EVENTS</h3>
      <table><thead><tr><th>ID</th><th>Name</th><th>Schedule</th></tr></thead>
      <tbody id="del-event-list">${options}</tbody></table>
      <div style="margin-top:16px;display:flex;gap:10px;">
        <button class="btn btn-danger" onclick="deleteSelectedEvent()"><i class="fa-solid fa-trash"></i> Delete Selected</button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.querySelectorAll("#del-event-list tr").forEach(tr => {
    tr.onclick = () => {
      document.querySelectorAll("#del-event-list tr").forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
    };
  });
}

async function deleteSelectedEvent() {
  const sel = document.querySelector("#del-event-list tr.selected");
  if (!sel) return alert("Please select an event to delete.");
  const eid = sel.dataset.id;
  if (confirm(`Delete event "${eid}"?`)) {
    try {
      await db.collection("events").doc(eid).delete();
      alert("Event deleted.");
      document.querySelector(".modal-overlay").remove();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }
}

function modalAddUser() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="color:var(--accent);margin-bottom:16px;"><i class="fa-solid fa-user-plus"></i> USER PROVISIONING</h3>
      <label>Username</label><input id="new-user">
      <label>Password</label><input id="new-pass" type="password">
      <label>Role Level</label>
      <select id="new-role">
        <option>CUSTOMER</option>
        <option>STAFF</option>
        <option>ADMIN</option>
      </select>
      <div style="margin-top:20px;display:flex;gap:10px;">
        <button class="btn" onclick="commitUser()"><i class="fa-solid fa-save"></i> Save User</button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function commitUser() {
  const u = $("#new-user").value.trim();
  const p = $("#new-pass").value.trim();
  const r = $("#new-role").value;
  if (!u || !p) return alert("Username and Password cannot be empty.");
  try {
    const exists = await db.collection("users").doc(u).get();
    if (exists.exists) return alert("Username already exists.");
    
    await db.collection("users").doc(u).set({ password: p, role: r });
    alert(`Provisioned user '${u}'.`);
    document.querySelector(".modal-overlay").remove();
  } catch (err) {
    alert("Failed user save: " + err.message);
  }
}

// ====================== MANAGE USERS (Edit Username / Password / Role) ======================
async function modalManageUsers() {
  let rows = "";
  try {
    const snap = await db.collection("users").get();
    snap.forEach(doc => {
      const u = doc.data();
      rows += `
        <tr data-id="${doc.id}">
          <td>${doc.id}</td>
          <td>${u.role}</td>
          <td>
            <button class="btn" style="padding:6px 12px;font-size:12px;" onclick="openEditUser('${doc.id}', '${u.role}')">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
          </td>
        </tr>`;
    });
  } catch (err) {
    console.error(err);
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <h3 style="color:var(--accent);margin-bottom:16px;"><i class="fa-solid fa-users-gear"></i> MANAGE USERS</h3>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='3'>No users found</td></tr>"}</tbody>
      </table>
      <div style="margin-top:20px;">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function openEditUser(oldUsername, currentRole) {
  // Close previous modal
  document.querySelector(".modal-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="color:var(--accent);margin-bottom:16px;"><i class="fa-solid fa-user-pen"></i> EDIT USER</h3>
      
      <label>Current Username</label>
      <input id="edit-old-username" value="${oldUsername}" disabled style="opacity:0.7;">

      <label>New Username</label>
      <input id="edit-new-username" value="${oldUsername}" placeholder="Leave same if no change">

      <label>New Password</label>
      <input id="edit-new-password" type="password" placeholder="Leave blank to keep current password">

      <label>Role</label>
      <select id="edit-role">
        <option value="CUSTOMER" ${currentRole === "CUSTOMER" ? "selected" : ""}>CUSTOMER</option>
        <option value="STAFF" ${currentRole === "STAFF" ? "selected" : ""}>STAFF</option>
        <option value="ADMIN" ${currentRole === "ADMIN" ? "selected" : ""}>ADMIN</option>
      </select>

      <div style="margin-top:24px;display:flex;gap:10px;">
        <button class="btn" onclick="saveEditUser('${oldUsername}')">
          <i class="fa-solid fa-save"></i> Save Changes
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function saveEditUser(oldUsername) {
  const newUsername = $("#edit-new-username").value.trim();
  const newPassword = $("#edit-new-password").value.trim();
  const newRole = $("#edit-role").value;

  if (!newUsername) return alert("Username cannot be empty.");

  try {
    const oldDoc = await db.collection("users").doc(oldUsername).get();
    if (!oldDoc.exists) return alert("User not found.");

    const oldData = oldDoc.data();

    // If username is changed
    if (newUsername !== oldUsername) {
      // Check if new username already exists
      const check = await db.collection("users").doc(newUsername).get();
      if (check.exists) return alert("New username already exists.");

      // Create new document
      await db.collection("users").doc(newUsername).set({
        password: newPassword || oldData.password,
        role: newRole
      });

      // Delete old document
      await db.collection("users").doc(oldUsername).delete();

      // If the currently logged-in admin changed their own username
      if (currentUser.username === oldUsername) {
        currentUser.username = newUsername;
      }

      alert(`User updated successfully!\nUsername changed: ${oldUsername} → ${newUsername}`);
    } else {
      // Only update password and/or role
      const updateData = { role: newRole };
      if (newPassword) updateData.password = newPassword;

      await db.collection("users").doc(oldUsername).update(updateData);
      alert("User updated successfully!");
    }

    document.querySelector(".modal-overlay")?.remove();
  } catch (err) {
    alert("Failed to update user: " + err.message);
  }
}

async function showAnalytics() {
  let totalRev = 0, totalTickets = 0;
  const map = {};

  const eventsSnap = await db.collection("events").get();
  eventsSnap.forEach(doc => {
    const d = doc.data();
    map[doc.id] = {
      name: d.name,
      normal: d.normal_price || 0,
      vip: d.vip_price || 0,
      sold: 0,
      revenue: 0
    };
  });

  const bookingsSnap = await db.collection("bookings").get();
  bookingsSnap.forEach(doc => {
    const b = doc.data();
    if (b.status === "Paid" && map[b.event_id]) {
      map[b.event_id].sold += b.seats_count || 1;
      map[b.event_id].revenue += b.amount || 0;
      totalRev += b.amount || 0;
      totalTickets += b.seats_count || 1;
    }
  });

  let rows = "";
  for (const [id, d] of Object.entries(map)) {
    rows += `<tr>
      <td>${id}</td><td>${d.name}</td>
      <td>${money(d.normal)}</td><td>${money(d.vip)}</td>
      <td>${d.sold}</td><td>${money(d.revenue)}</td>
    </tr>`;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:800px;">
      <h3 style="color:var(--accent);margin-bottom:16px;"><i class="fa-solid fa-chart-line"></i> FINANCIAL ANALYTICS & REVENUE REPORT</h3>
      <table>
        <thead><tr>
          <th>Event ID</th><th>Event Name</th><th>Normal (₱)</th><th>VIP (₱)</th><th>Tickets Sold</th><th>Gross Revenue</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;padding:12px;background:var(--bg-panel);display:flex;justify-content:space-between;">
        <strong>Total Sold Tickets: ${totalTickets}</strong>
        <strong style="color:var(--success)">Total Gross Revenue: ${money(totalRev)}</strong>
      </div>
      <button class="btn btn-secondary" style="margin-top:16px;" onclick="this.closest('.modal-overlay').remove()">Close Report</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ====================== BOOT ======================
(async function () {
  await bootstrapDefaultAccounts();
  renderRoleSelector();
})();
