// ==========================================================================
// E-BUS CONNECT UGANDA - PASSENGER WAITING SYSTEM (WAIT PILLAR)
// Interactive Stop Beacon, Driver Dispatch Alert, & Real-time Demand Engine
// ==========================================================================

const WaitSystem = {
  timerInterval: null,

  init() {
    this.renderWaitingView();
    
    // Listen for state changes
    State.on('passengerWaitingUpdated', () => this.renderWaitingView());
    State.on('passengerWaitingCancelled', () => this.renderWaitingView());
    State.on('telemetryTick', () => this.updateApproachingBuses());
  },

  renderWaitingView() {
    const container = document.getElementById('waiting-system-container');
    if (!container) return;

    const hasActiveSession = !!State.activeWaitingStopId;
    const activeStop = hasActiveSession ? State.stops.find(s => s.id === State.activeWaitingStopId) : null;
    const activeRoute = hasActiveSession ? State.routes.find(r => r.id === State.activeWaitingRouteId) : null;

    if (hasActiveSession && activeStop) {
      // Active Waiting Radar State
      container.innerHTML = `
        <div class="card card-glass" style="border-color: rgba(245, 158, 11, 0.4); max-width: 800px; margin: 0 auto;">
          <div class="wait-dashboard-grid">
            
            <div class="wait-radar-display">
              <div class="radar-pulse-ring"></div>
              <div class="radar-pulse-ring" style="animation-delay: 0.8s;"></div>
              
              <div class="radar-sweep-center">
                <svg class="radar-beacon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                  <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 8a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/>
                </svg>
              </div>

              <div class="badge badge-warning" style="margin-bottom: 0.5rem;">
                <span class="badge-dot"></span> LIVE SIGNAL TRANSMITTING
              </div>
              
              <!-- Prominent Aggregated Display -->
              <div style="background: rgba(16, 185, 129, 0.12); border: 2px solid var(--primary); border-radius: var(--radius-lg); padding: 1.25rem; margin: 1rem 0; width: 100%;">
                <div style="font-size: 1.1rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.05em;">
                  ${activeStop.name.toUpperCase()}
                </div>
                <div class="waiting-live-counter" style="color: var(--primary); font-size: 3rem; line-height: 1.1; margin: 0.25rem 0;">
                  ${activeStop.waitingPassengers}
                </div>
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-light);">
                  passengers waiting
                </div>
              </div>

              <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">
                Selected Route: <b style="color: var(--primary)">${activeRoute ? activeRoute.name : 'All Incoming Lines'}</b>
              </p>
              <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 1.25rem;">
                Request Sent at: <b>${new Date(Number(State.activeWaitingTimestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
              </div>

              <div style="font-size: 0.75rem; color: #94A3B8; background: rgba(0,0,0,0.35); padding: 0.6rem 0.85rem; border-radius: 6px; text-align: left;">
                <b>Privacy Protected:</b> This appears in the driver console as an aggregated count (e.g. "${activeStop.name.toUpperCase()}: ${activeStop.waitingPassengers} waiting"). Individual passenger identities or exact locations are never disclosed.
              </div>
            </div>

            <div style="display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h4 style="font-size: 1.15rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                  <span class="pulse-indicator"></span> Approaching Electric Buses
                </h4>
                <div id="approaching-buses-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                  ${this.getApproachingBusesHTML(activeStop)}
                </div>
              </div>

              <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <button class="btn btn-primary" onclick="WaitSystem.boardBus()">
                  I Have Boarded the Bus
                </button>
                <button class="btn btn-outline" onclick="State.cancelPassengerWaiting()">
                  Cancel Waiting Signal
                </button>
              </div>
            </div>

          </div>
        </div>
      `;
    } else {
      // Idle / Request Waiting State
      container.innerHTML = `
        <div class="wait-dashboard-grid" style="max-width: 900px; margin: 0 auto;">
          
          <div class="wait-action-card">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
              <div class="pillar-icon-box" style="margin-bottom: 0; width: 44px; height: 44px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div>
                <h3 style="font-size: 1.25rem;">I'm Waiting Feature</h3>
                <p style="font-size: 0.82rem; color: var(--text-muted);">Signal incoming drivers that you are waiting at a bus stage</p>
              </div>
            </div>

            <form id="wait-signal-form" onsubmit="WaitSystem.handleSubmit(event)">
              <div class="form-group">
                <label class="form-label" for="wait-stop-select">Select Your Bus Stop</label>
                <select id="wait-stop-select" class="form-control" required>
                  <option value="">-- Choose Bus Stop --</option>
                  ${State.stops.map(s => `
                    <option value="${s.id}">
                      ${s.name.toUpperCase()} - ${s.waitingPassengers} passengers waiting
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="wait-route-select">Select Desired Route / Line</label>
                <select id="wait-route-select" class="form-control">
                  <option value="any">Any Approaching Bus</option>
                  ${State.routes.map(r => `
                    <option value="${r.id}">${r.name}</option>
                  `).join('')}
                </select>
              </div>

              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 1.5rem; font-size: 0.82rem; color: var(--text-secondary);">
                <b>How it works:</b> Tapping <b>"I'm Waiting Here"</b> transmits an aggregated count to approaching bus consoles so operators prepare deceleration.
              </div>

              <button type="submit" class="btn btn-accent btn-lg" style="width: 100%; font-weight: 800;">
                I'm Waiting Here
              </button>
            </form>
          </div>

          <div class="card card-glass" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--primary);">
                Why the "WAIT" System Matters in Uganda
              </h3>
              <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; line-height: 1.6;">
                Traditional Matatus (taxis) frequently stop randomly or rush past waiting passengers when full. E-Bus Connect's waiting signal provides <b>transparent demand forecasting</b>:
              </p>
              
              <ul style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.88rem; color: var(--text-secondary); list-style: none;">
                <li style="display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="color: var(--primary); font-weight: 800;">✓</span>
                  <span><b>Driver In-Cab Alerts:</b> Drivers receive early audible & visual notifications to prepare deceleration.</span>
                </li>
                <li style="display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="color: var(--primary); font-weight: 800;">✓</span>
                  <span><b>Dynamic Dispatching:</b> If 20+ commuters signal at Kyambogo or Nakawa, dispatch can release a standby bus.</span>
                </li>
                <li style="display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="color: var(--primary); font-weight: 800;">✓</span>
                  <span><b>Accurate ETA:</b> You get realistic countdowns and can see open seats before boarding.</span>
                </li>
              </ul>
            </div>

            <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); margin-top: 1.5rem; border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Metropolitan Total</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-main);">
                ${State.stops.reduce((acc, s) => acc + s.waitingPassengers, 0)} Commuters Waiting Live
              </div>
            </div>
          </div>

        </div>
      `;
    }
  },

  getApproachingBusesHTML(stop) {
    const relevantBuses = State.fleet.filter(b => b.status === 'in-service');
    if (relevantBuses.length === 0) {
      return `<p style="font-size: 0.85rem; color: var(--text-muted);">No buses currently on this corridor.</p>`;
    }

    return relevantBuses.slice(0, 3).map(bus => {
      const seatsOpen = bus.capacity - bus.passengerCount;
      return `
        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${bus.name} (${bus.id})</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${bus.routeName}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; color: var(--primary); font-size: 1.05rem;">~${bus.etaMinutes} min</div>
            <div style="font-size: 0.72rem; color: ${seatsOpen > 5 ? '#34D399' : '#EF4444'}">
              ${seatsOpen} seats open
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  updateApproachingBuses() {
    if (!State.activeWaitingStopId) return;
    const listEl = document.getElementById('approaching-buses-list');
    const stop = State.stops.find(s => s.id === State.activeWaitingStopId);
    if (listEl && stop) {
      listEl.innerHTML = this.getApproachingBusesHTML(stop);
    }
  },

  handleSubmit(e) {
    e.preventDefault();
    const stopId = document.getElementById('wait-stop-select').value;
    const routeId = document.getElementById('wait-route-select').value;

    if (!stopId) {
      App.showToast('Select Stop', 'Please pick your current bus stop', 'warning');
      return;
    }

    State.registerPassengerWaiting(stopId, routeId);
    App.showToast('Signal Active!', 'Electric bus drivers have been notified.', 'success');
  },

  boardBus() {
    State.cancelPassengerWaiting();
    App.showToast('Journey Started!', 'Welcome aboard E-Bus Connect. Enjoy your clean electric ride!', 'success');
    App.navigateTo('tracking');
  }
};
