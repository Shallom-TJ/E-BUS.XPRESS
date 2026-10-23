// ==========================================================================
// E-BUS CONNECT UGANDA - DRIVER PORTAL (SECTION 11)
// Simple, distraction-minimised in-cab tablet interface
// GPS Architecture: Simulated prototype — real GPS will plug in via backend API
// ==========================================================================

const DriverPortal = {
  currentBus: null,
  tripActive: false,
  loginVerified: false,

  init() {
    this.currentBus = State.fleet.find(b => b.id === State.driverModeBusId) || State.fleet[0];
    this.renderLoginGate();

    State.on('driverTelemeteryUpdated', (bus) => {
      this.currentBus = bus;
      this.refreshTripStatus();
    });
    State.on('passengerWaitingUpdated', () => this.refreshWaitingTable());
    State.on('stopsUpdated', () => this.refreshWaitingTable());
    State.on('telemetryTick', () => this.refreshTelemetryBadge());
  },

  renderCockpit() {
    // Called from App.navigateTo('driver') — verify authenticated driver role
    if (RoleAccess && RoleAccess.isAuthenticated && (RoleAccess.currentRole === 'driver' || RoleAccess.currentRole === 'admin')) {
      this.loginVerified = true;
      if (RoleAccess.currentUser?.badgeId) {
        const matched = State.fleet.find(b => b.driverBadge === RoleAccess.currentUser.badgeId);
        if (matched) {
          this.currentBus = matched;
          State.driverModeBusId = matched.id;
        }
      }
      this.renderMainInterface();
      return;
    }

    this.loginVerified = false;
    this.renderLoginGate();
  },

  // -----------------------------------------------------------------------
  // DRIVER LOGIN GATE (role-based access per Section 20)
  // -----------------------------------------------------------------------
  renderLoginGate() {
    const container = document.getElementById('driver-portal-container');
    if (!container) return;

    if (RoleAccess && RoleAccess.isAuthenticated && (RoleAccess.currentRole === 'driver' || RoleAccess.currentRole === 'admin')) {
      this.loginVerified = true;
      this.renderMainInterface();
      return;
    }

    const isPassenger = RoleAccess && RoleAccess.isAuthenticated && RoleAccess.currentRole === 'passenger';
    const userName = RoleAccess?.currentUser?.fullName || '';

    container.innerHTML = `
      <div style="max-width: 480px; margin: 3rem auto;">
        <div class="card card-glass" style="text-align: center; padding: 2.5rem 2rem;">
          
          <!-- Driver icon -->
          <div style="width:72px; height:72px; border-radius:50%; background: rgba(16,185,129,0.15); border: 2px solid var(--primary); display:flex; align-items:center; justify-content:center; margin: 0 auto 1.25rem auto;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>

          <h2 style="font-size: 1.6rem; margin-bottom: 0.35rem;">Driver Portal</h2>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 2rem;">
            Authorised electric bus operators only. In-cab telematics and passenger waiting terminal.
          </p>

          ${isPassenger ? `
            <div style="padding: 1rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-md); margin-bottom: 1.5rem; text-align: left;">
              <div style="font-weight: 700; color: #EF4444; margin-bottom: 0.35rem;">Driver Role Required</div>
              <div style="font-size: 0.82rem; color: var(--text-muted);">
                You are currently signed in as <strong>${userName}</strong> (Passenger). Only accounts assigned the <strong>Driver</strong> or <strong>Admin</strong> role in Supabase can operate this cockpit.
              </div>
            </div>
            <button class="btn btn-outline" style="width:100%; margin-bottom:0.75rem;" onclick="RoleAccess.showAccountModal()">
              Switch / Sign Out
            </button>
          ` : `
            <div style="padding: 1rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: var(--radius-md); margin-bottom: 1.5rem; text-align: left;">
              <div style="font-size: 0.82rem; color: var(--text-muted);">
                Drivers sign in using their registered operational email and secure password. Access permissions are verified directly against the Supabase database.
              </div>
            </div>
            <button class="btn btn-primary" style="width:100%; font-size:1.05rem; padding: 0.85rem;"
              onclick="RoleAccess.showAuthModal('login', 'driver')"
              id="driver-login-btn">
              Sign In as Driver
            </button>
          `}

          <div style="margin-top: 1.25rem; padding: 0.75rem; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: var(--radius-md);">
            <span style="font-size: 0.77rem; color: var(--accent-gold);">
              Security Notice: Client-side badge bypasses are disabled. Roles are enforced via Row Level Security.
            </span>
          </div>
        </div>
      </div>
    `;
  },

  attemptLogin() {
    RoleAccess.showAuthModal('login', 'driver');
  },

  // -----------------------------------------------------------------------
  // MAIN DRIVER INTERFACE — Simple, large-text, minimal distraction
  // -----------------------------------------------------------------------
  renderMainInterface() {
    const container = document.getElementById('driver-portal-container');
    if (!container) return;

    const bus = this.currentBus;
    const routeStops = this.getRouteStops(bus.routeId);
    const waitingStops = this.getWaitingStopsSummary(bus.routeId);
    const currentStop = State.stops.find(s => s.id === bus.nextStopId) || State.stops[0];
    const currentStopName = bus.currentLocationName?.replace('Near ', '') || 'Ntinda';
    const nextStopName = bus.nextStopName || 'Bukoto';

    container.innerHTML = `
      <!-- ============================================================
           DRIVER PORTAL — SECTION 11 EXACT SPECIFICATION
           ============================================================ -->
      <div class="driver-main-layout">

        <!-- TOP BAR: GPS Status + Driver Info -->
        <div class="driver-topbar">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="driver-avatar-small">${bus.driverName.charAt(0)}</div>
            <div>
              <div style="font-weight: 800; color: #fff; font-size: 1rem;">${bus.driverName}</div>
              <div style="font-size: 0.73rem; color: #94A3B8;">${bus.driverBadge}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
            <span class="badge ${State.driverIsBroadcasting ? 'badge-electric' : 'badge-danger'}" id="gps-status-badge">
              <span class="badge-dot"></span>
              ${State.driverIsBroadcasting ? 'GPS SIMULATED (LIVE)' : 'GPS OFFLINE'}
            </span>
            <button class="btn btn-secondary btn-sm" onclick="DriverPortal.toggleGpsBroadcast()" aria-label="Toggle GPS broadcast">
              ${State.driverIsBroadcasting ? 'Pause GPS' : 'Activate GPS'}
            </button>
            <button class="btn btn-outline btn-sm" onclick="DriverPortal.logOut()" aria-label="Sign out of driver portal">
              Sign Out
            </button>
          </div>
        </div>

        <!-- ============================================================
             MAIN INFO PANEL: BUS / ROUTE / STOPS
             ============================================================ -->
        <div class="driver-info-grid">

          <!-- BUS Identifier -->
          <div class="driver-info-cell" id="driver-bus-cell">
            <div class="driver-info-label">BUS</div>
            <div class="driver-info-value primary" id="driver-bus-id">EB-${bus.id.replace('BUS ', '0')}</div>
            <div class="driver-info-sub">${bus.plateNumber} • ${bus.model}</div>
          </div>

          <!-- ROUTE -->
          <div class="driver-info-cell">
            <div class="driver-info-label">ROUTE</div>
            <div class="driver-info-value" id="driver-route-name" style="font-size: 1.25rem;">
              ${bus.routeName.split('→')[0].trim()} → ${bus.routeName.split('→').pop().trim()}
            </div>
            <div class="driver-info-sub">Line ${bus.routeId?.replace('R-', '0') || '01'}</div>
          </div>

          <!-- CURRENT STOP -->
          <div class="driver-info-cell">
            <div class="driver-info-label">CURRENT STOP</div>
            <div class="driver-info-value gold" id="driver-current-stop">${currentStopName}</div>
            <div class="driver-info-sub" id="driver-speed">Speed: ${bus.speedKmH} km/h</div>
          </div>

          <!-- NEXT STOP -->
          <div class="driver-info-cell">
            <div class="driver-info-label">NEXT STOP</div>
            <div class="driver-info-value cyan" id="driver-next-stop">${nextStopName}</div>
            <div class="driver-info-sub" id="driver-eta">ETA: ${bus.etaMinutes} min</div>
          </div>

          <!-- BATTERY -->
          <div class="driver-info-cell">
            <div class="driver-info-label">BATTERY</div>
            <div class="driver-info-value" id="driver-battery" style="color: ${bus.batteryPercent > 30 ? '#38BDF8' : '#EF4444'};">
              ${Math.round(bus.batteryPercent)}%
            </div>
            <div class="driver-info-sub">${bus.rangeRemainingKm} km range</div>
          </div>

          <!-- PASSENGERS ONBOARD -->
          <div class="driver-info-cell">
            <div class="driver-info-label">PASSENGERS ONBOARD</div>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-top:0.25rem;">
              <button class="driver-counter-btn minus" onclick="State.updateDriverPassengerCount(-1)" aria-label="Passenger alighted">−</button>
              <div class="driver-info-value" id="driver-pax-count" style="font-size: 2rem; min-width: 2.5rem; text-align:center;">
                ${bus.passengerCount}
              </div>
              <button class="driver-counter-btn plus" onclick="State.updateDriverPassengerCount(1)" aria-label="Passenger boarded">+</button>
            </div>
            <div class="driver-info-sub">${bus.capacity - bus.passengerCount} seats free</div>
          </div>

        </div>

        <!-- ============================================================
             WAITING PASSENGERS — BY STOP AHEAD ON ROUTE
             Section 11 exact specification
             ============================================================ -->
        <!-- ============================================================
             WAITING PASSENGERS — BY STOP AHEAD ON ROUTE
             Section 11 exact specification
             ============================================================ -->
        <div class="driver-waiting-panel">
          <div class="driver-section-header">
            <span>WAITING PASSENGERS</span>
            <span class="badge badge-warning" style="margin-left:auto;" id="driver-waiting-total-badge">
              Loading...
            </span>
          </div>
          <div id="driver-waiting-table">
            ${this.buildWaitingTableHTML(waitingStops)}
          </div>
        </div>

        <!-- ============================================================
             ROUTE PROGRESS — STOP SEQUENCE
             ============================================================ -->
        <div class="driver-route-panel">
          <div class="driver-section-header">
            <span>ROUTE PROGRESS — ${bus.routeName}</span>
          </div>
          <div class="driver-stop-sequence">
            ${routeStops.map((stop, i) => {
              const isCurrentApprox = stop.shortName === currentStopName || i === 0;
              const isPast = i === 0;
              return `<div class="driver-stop-step ${isPast ? 'past' : ''} ${isCurrentApprox && i > 0 ? 'current' : ''}">
                <div class="driver-stop-dot ${isPast ? 'past-dot' : (isCurrentApprox && i > 0 ? 'current-dot' : '')}"></div>
                <span class="driver-stop-name">${i + 1}. ${stop.shortName || stop.name}</span>
                ${stop.waitingPassengers > 0 ? `<span class="driver-stop-waiting">${stop.waitingPassengers} waiting</span>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- ============================================================
             TRIP CONTROL BUTTONS — Section 11 exact specification
             ============================================================ -->
        <div class="driver-action-grid">

          <button class="driver-btn driver-btn-start ${this.tripActive ? 'disabled' : ''}"
            onclick="DriverPortal.startTrip()"
            id="btn-start-trip"
            aria-label="Start Trip"
            ${this.tripActive ? 'disabled' : ''}>
            Start Trip
          </button>

          <button class="driver-btn driver-btn-end ${!this.tripActive ? 'disabled' : ''}"
            onclick="DriverPortal.endTrip()"
            id="btn-end-trip"
            aria-label="End Trip"
            ${!this.tripActive ? 'disabled' : ''}>
            End Trip
          </button>

          <button class="driver-btn driver-btn-status"
            onclick="DriverPortal.updateStatus()"
            aria-label="Update Status">
            Update Status
          </button>

          <button class="driver-btn driver-btn-delay"
            onclick="DriverPortal.reportDelay()"
            aria-label="Report Delay">
            Report Delay
          </button>

          <button class="driver-btn driver-btn-emergency"
            onclick="DriverPortal.emergencyIncident()"
            aria-label="Emergency / Incident">
            Emergency / Incident
          </button>

          <button class="driver-btn driver-btn-route"
            onclick="DriverPortal.viewRoute()"
            aria-label="View Route">
            View Route
          </button>

        </div>

        <!-- ============================================================
             GPS ARCHITECTURE NOTE — Section 12
             ============================================================ -->
        <div class="driver-gps-arch-panel">
          <div class="driver-section-header">
            <span>GPS LOCATION ARCHITECTURE (PROTOTYPE)</span>
          </div>
          <div class="gps-arch-flow">
            <div class="gps-arch-node active">
              Driver Device / Bus GPS
              <span class="gps-node-sub">Currently: Simulated coordinates</span>
            </div>
            <div class="gps-arch-arrow">↓</div>
            <div class="gps-arch-node future">
              Mobile Internet / Cellular
              <span class="gps-node-sub">Future: HTTPS POST to backend</span>
            </div>
            <div class="gps-arch-arrow">↓</div>
            <div class="gps-arch-node future">
              Backend API Server
              <span class="gps-node-sub">Future: Node.js / REST API</span>
            </div>
            <div class="gps-arch-arrow">↓</div>
            <div class="gps-arch-node future">
              Database
              <span class="gps-node-sub">Future: PostgreSQL / Redis</span>
            </div>
            <div class="gps-arch-arrow">↓</div>
            <div class="gps-arch-node future">
              Passenger App
              <span class="gps-node-sub">Future: WebSocket live updates</span>
            </div>
            <div class="gps-arch-arrow">↓</div>
            <div class="gps-arch-node future">
              Live Map + ETA
              <span class="gps-node-sub">Future: Real-time Leaflet markers</span>
            </div>
          </div>
          <div style="font-size:0.75rem; color: var(--text-dim); margin-top:0.75rem; text-align:center;">
            PROTOTYPE ONLY — This system simulates GPS coordinates. No real buses are connected.
            Real GPS can be accepted from: driver smartphone, dedicated GPS tracker, or authorised vehicle tracking system.
          </div>
        </div>

      </div>
    `;

    // Initialize trip button states
    this.refreshTripStatus();
    this.refreshWaitingTable();
  },

  // -----------------------------------------------------------------------
  // DATA HELPERS
  // -----------------------------------------------------------------------
  getRouteStops(routeId) {
    const route = State.routes.find(r => r.id === routeId);
    if (!route) return State.stops.slice(0, 4);
    return route.stops.map(sid => State.stops.find(s => s.id === sid)).filter(Boolean);
  },

  getWaitingStopsSummary(routeId) {
    const route = State.routes.find(r => r.id === routeId);
    if (!route) return [];
    return route.stops
      .map(sid => State.stops.find(s => s.id === sid))
      .filter(Boolean)
      .filter(s => s.waitingPassengers > 0);
  },

  buildWaitingTableHTML(waitingStops) {
    const totalWaiting = waitingStops.reduce((sum, s) => sum + s.waitingPassengers, 0);

    // Update badge
    const badge = document.getElementById('driver-waiting-total-badge');
    if (badge) badge.textContent = totalWaiting + ' total';

    if (waitingStops.length === 0) {
      return `<div style="text-align:center; color: var(--primary); font-size:1rem; font-weight:700; padding:1.25rem 0;">
        No passengers currently waiting ahead on this route.
      </div>`;
    }

    return waitingStops.map(stop => `
      <div class="driver-waiting-row">
        <div class="driver-waiting-stop-name">${stop.shortName || stop.name}</div>
        <div class="driver-waiting-count ${stop.waitingPassengers >= 5 ? 'high' : stop.waitingPassengers >= 3 ? 'medium' : 'low'}">
          ${stop.waitingPassengers}
        </div>
        <div class="driver-waiting-label">
          ${stop.waitingPassengers === 1 ? 'passenger' : 'passengers'} waiting
        </div>
      </div>
    `).join('');
  },

  // -----------------------------------------------------------------------
  // LIVE UPDATE HELPERS (called by State events)
  // -----------------------------------------------------------------------
  refreshTelemetryBadge() {
    if (!this.loginVerified || !this.currentBus) return;
    const bus = this.currentBus;
    const speedEl = document.getElementById('driver-speed');
    const etaEl = document.getElementById('driver-eta');
    const battEl = document.getElementById('driver-battery');
    const paxEl = document.getElementById('driver-pax-count');
    const nextStopEl = document.getElementById('driver-next-stop');

    if (speedEl) speedEl.textContent = `Speed: ${bus.speedKmH} km/h`;
    if (etaEl) etaEl.textContent = `ETA: ${bus.etaMinutes} min`;
    if (battEl) battEl.textContent = `${Math.round(bus.batteryPercent)}%`;
    if (paxEl) paxEl.textContent = bus.passengerCount;
    if (nextStopEl) nextStopEl.textContent = bus.nextStopName || 'Bukoto';
  },

  refreshWaitingTable() {
    if (!this.loginVerified || !this.currentBus) return;
    const waitingEl = document.getElementById('driver-waiting-table');
    if (!waitingEl) return;
    const waitingStops = this.getWaitingStopsSummary(this.currentBus.routeId);
    waitingEl.innerHTML = this.buildWaitingTableHTML(waitingStops);

    const totalWaiting = waitingStops.reduce((sum, s) => sum + s.waitingPassengers, 0);
    const badge = document.getElementById('driver-waiting-total-badge');
    if (badge) badge.textContent = totalWaiting + ' total';
  },

  refreshTripStatus() {
    const startBtn = document.getElementById('btn-start-trip');
    const endBtn = document.getElementById('btn-end-trip');
    if (startBtn) {
      startBtn.disabled = this.tripActive;
      startBtn.classList.toggle('disabled', this.tripActive);
    }
    if (endBtn) {
      endBtn.disabled = !this.tripActive;
      endBtn.classList.toggle('disabled', !this.tripActive);
    }
  },

  // -----------------------------------------------------------------------
  // BUTTON ACTIONS — Section 11 specification
  // -----------------------------------------------------------------------
  startTrip() {
    if (this.tripActive) return;
    this.tripActive = true;
    this.refreshTripStatus();
    State.addNotification({
      type: 'info',
      title: `Trip Started — ${this.currentBus.id}`,
      message: `Bus ${this.currentBus.id} has commenced route service on ${this.currentBus.routeName}.`,
      level: 'info'
    });
    App.showToast('Trip Started', `Route service active for ${this.currentBus.id}`, 'success');
  },

  endTrip() {
    if (!this.tripActive) return;
    this.tripActive = false;
    this.refreshTripStatus();
    State.addNotification({
      type: 'info',
      title: `Trip Ended — ${this.currentBus.id}`,
      message: `Bus ${this.currentBus.id} has completed its route cycle. Returning to depot.`,
      level: 'info'
    });
    App.showToast('Trip Ended', `${this.currentBus.id} route cycle completed.`, 'info');
  },

  updateStatus() {
    const statuses = ['On Time', 'Delayed', 'Out of Service'];
    const current = this.currentBus.scheduleStatus;
    const nextStatus = statuses[(statuses.indexOf(current) + 1) % statuses.length];
    this.currentBus.scheduleStatus = nextStatus;
    State.addNotification({
      type: nextStatus.includes('Delayed') ? 'warning' : 'info',
      title: `Status Update — ${this.currentBus.id}`,
      message: `Bus ${this.currentBus.id} status updated to: ${nextStatus}`,
      level: nextStatus.includes('Delayed') ? 'warning' : 'info'
    });
    App.showToast('Status Updated', `Bus ${this.currentBus.id}: ${nextStatus}`, 'info');
    this.renderMainInterface();
  },

  reportDelay() {
    const reasons = [
      'Heavy traffic at Nakawa junction (+5 min)',
      'Road works near Bukoto Market (+8 min)',
      'Passenger loading delay at Ntinda (+3 min)',
      'Traffic signal fault at Kisementi (+4 min)'
    ];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    this.currentBus.scheduleStatus = 'Delayed';
    State.addNotification({
      type: 'warning',
      title: `Delay Report — Bus ${this.currentBus.id}`,
      message: `Bus ${this.currentBus.id} reports delay: ${reason}`,
      level: 'warning'
    });
    App.showToast('Delay Reported', `Passengers notified: ${reason}`, 'warning');
    this.renderMainInterface();
  },

  emergencyIncident() {
    const confirmed = confirm('EMERGENCY DISPATCH — Are you reporting an incident or emergency?\n\nThis will immediately alert central dispatch and notify passengers.');
    if (confirmed) {
      State.addNotification({
        type: 'urgent',
        title: `EMERGENCY ALERT — Bus ${this.currentBus.id}`,
        message: `Driver ${this.currentBus.driverName} (${this.currentBus.driverBadge}) has raised an emergency alert on Route ${this.currentBus.routeName}. Dispatch notified.`,
        level: 'urgent'
      });
      App.showToast('Emergency Broadcast Sent', 'Dispatch and passengers have been notified', 'error');
    }
  },

  viewRoute() {
    App.showToast('Viewing Route', 'Opening live route map...', 'info');
    setTimeout(() => App.navigateTo('tracking'), 400);
  },

  toggleGpsBroadcast() {
    State.driverIsBroadcasting = !State.driverIsBroadcasting;
    const badge = document.getElementById('gps-status-badge');
    if (badge) {
      badge.className = `badge ${State.driverIsBroadcasting ? 'badge-electric' : 'badge-danger'}`;
      badge.innerHTML = `<span class="badge-dot"></span> ${State.driverIsBroadcasting ? 'GPS SIMULATED (LIVE)' : 'GPS OFFLINE'}`;
    }
    App.showToast(
      State.driverIsBroadcasting ? 'GPS Simulation Active' : 'GPS Paused',
      State.driverIsBroadcasting ? 'Location broadcast resumed (prototype simulation)' : 'Location broadcast paused',
      State.driverIsBroadcasting ? 'success' : 'warning'
    );
  },

  logOut() {
    this.loginVerified = false;
    this.tripActive = false;
    App.showToast('Signed Out', 'Driver session ended. Goodbye!', 'info');
    this.renderLoginGate();
  }
};
