// ==========================================================================
// E-BUS CONNECT UGANDA - ADMIN & FLEET OPERATIONS CONTROL
// Professional Desktop Transport Management System (Section 26 & 30)
// Fleet Analytics, Real-time Waiting Heatmap, Hourly Charts & Standby Dispatch
// ==========================================================================

const AdminDashboard = {
  activeTab: 'overview', // 'overview', 'telematics', 'heatmap', 'charging', 'incidents'
  incidentLog: [
    { time: '18:28', bus: 'BUS 04', type: 'Traffic Delay', stage: 'Nakawa Junction', note: '7 min delay near Spear Motors roadworks' },
    { time: '18:15', bus: 'BUS 02', type: 'High Congestion', stage: 'Kyanja Stage', note: '18 commuters signaled waiting; standby requested' },
    { time: '17:40', bus: 'BUS 09', type: 'Charging Complete', stage: 'Bweyogerere Hub', note: '150kW DC Fast Charge complete (35% → 98%)' }
  ],

  init() {
    this.renderDashboard();

    State.on('stopsUpdated', () => this.refreshDynamicContent());
    State.on('fleetUpdated', () => this.refreshDynamicContent());
    State.on('telemetryTick', () => this.updateAdminMetrics());
  },

  switchTab(tabKey) {
    this.activeTab = tabKey;
    this.renderDashboard();
  },

  renderDashboard() {
    const container = document.getElementById('admin-dashboard-container');
    if (!container) return;

    const inServiceCount = State.fleet.filter(b => b.status === 'in-service').length;
    const chargingCount = State.fleet.filter(b => b.status === 'charging').length;
    const totalWaiting = State.stops.reduce((sum, s) => sum + s.waitingPassengers, 0);

    container.innerHTML = `
      <div class="admin-workspace-grid">
        
        <!-- Desktop Sidebar Navigation -->
        <aside class="admin-sidebar" role="navigation" aria-label="Admin console navigation">
          <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:0.35rem; padding:0 0.5rem;">
            Control Center
          </div>
          
          <button class="admin-sidebar-link ${this.activeTab === 'overview' ? 'active' : ''}" onclick="AdminDashboard.switchTab('overview')">
            <span>Overview &amp; Stats</span>
          </button>
          
          <button class="admin-sidebar-link ${this.activeTab === 'telematics' ? 'active' : ''}" onclick="AdminDashboard.switchTab('telematics')">
            <span>Fleet Telematics</span>
          </button>

          <button class="admin-sidebar-link ${this.activeTab === 'heatmap' ? 'active' : ''}" onclick="AdminDashboard.switchTab('heatmap')">
            <span>Passenger Heatmap</span>
          </button>

          <button class="admin-sidebar-link ${this.activeTab === 'charging' ? 'active' : ''}" onclick="AdminDashboard.switchTab('charging')">
            <span>Charging Hubs</span>
          </button>

          <button class="admin-sidebar-link ${this.activeTab === 'incidents' ? 'active' : ''}" onclick="AdminDashboard.switchTab('incidents')">
            <span>Incidents &amp; Delays</span>
          </button>

          <div style="margin-top:auto; padding-top:1rem; border-top:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:0.5rem;">
            <button class="btn btn-secondary btn-sm" style="width:100%; font-size:0.8rem;" onclick="AdminDashboard.exportReport()">
              Export CSV
            </button>
            <button class="btn btn-primary btn-sm" style="width:100%; font-size:0.8rem;" onclick="AdminDashboard.openBroadcastModal()">
              Broadcast Alert
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          
          <!-- Top KPI Metrics Ribbon -->
          <div class="admin-metrics-grid">
            <div class="admin-metric-card">
              <span class="popup-label">Active Electric Fleet</span>
              <div class="num" style="color: var(--primary);" id="admin-active-buses">${inServiceCount}</div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${chargingCount} charging at Bweyogerere hub</span>
            </div>

            <div class="admin-metric-card">
              <span class="popup-label">Live Waiting Commuters</span>
              <div class="num" style="color: var(--accent-gold);" id="admin-waiting-commuters">${totalWaiting}</div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Across 18 designated Kampala stages</span>
            </div>

            <div class="admin-metric-card">
              <span class="popup-label">Clean Energy Consumed</span>
              <div class="num" style="color: var(--accent-cyan);">1,840 <span style="font-size: 1rem;">kWh</span></div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Powered by Nalubaale Hydro &amp; Solar</span>
            </div>

            <div class="admin-metric-card">
              <span class="popup-label">Estimated CO2 Saved</span>
              <div class="num" style="color: #34D399;">2.95 <span style="font-size: 1rem;">Tonnes</span></div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Vs fossil fuel commuter taxis</span>
            </div>
          </div>

          <!-- Dynamic Panel Content depending on active tab -->
          ${this.renderTabContent()}

        </div>

      </div>
    `;
  },

  renderTabContent() {
    switch(this.activeTab) {
      case 'overview':
        return this.renderOverviewTab();
      case 'telematics':
        return this.renderTelematicsTab();
      case 'heatmap':
        return this.renderHeatmapTab();
      case 'charging':
        return this.renderChargingTab();
      case 'incidents':
        return this.renderIncidentsTab();
      default:
        return this.renderOverviewTab();
    }
  },

  renderOverviewTab() {
    return `
      <!-- Hourly Demand Visual Chart (Section 26: Charts) -->
      <div class="demand-chart-container">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-main);">Kampala Metropolitan Passenger Demand Curve</h3>
            <p style="font-size:0.78rem; color:var(--text-muted);">Hourly passenger queue load across all corridors (06:00 to 22:00 peak analysis)</p>
          </div>
          <div style="display:flex; gap:0.75rem; font-size:0.75rem;">
            <span style="display:flex; align-items:center; gap:0.3rem;"><span style="width:10px; height:10px; background:#F59E0B; border-radius:2px;"></span> Peak Hours (Morning / Evening)</span>
            <span style="display:flex; align-items:center; gap:0.3rem;"><span style="width:10px; height:10px; background:#10B981; border-radius:2px;"></span> Normal Hours</span>
          </div>
        </div>

        <div class="chart-bars-wrap">
          <div class="chart-bar-item">
            <div class="chart-bar" style="height: 35%;"></div>
            <span class="chart-label">06:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar peak" style="height: 85%;"></div>
            <span class="chart-label">07:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar peak" style="height: 98%;"></div>
            <span class="chart-label">08:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar" style="height: 60%;"></div>
            <span class="chart-label">09:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar" style="height: 45%;"></div>
            <span class="chart-label">12:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar" style="height: 52%;"></div>
            <span class="chart-label">15:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar peak" style="height: 94%;"></div>
            <span class="chart-label">17:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar peak" style="height: 90%;"></div>
            <span class="chart-label">18:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar" style="height: 65%;"></div>
            <span class="chart-label">20:00</span>
          </div>
          <div class="chart-bar-item">
            <div class="chart-bar" style="height: 30%;"></div>
            <span class="chart-label">22:00</span>
          </div>
        </div>
      </div>

      <!-- Two Column View: Stop Demand Heatmap & Active Fleet Table -->
      <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.5rem;">
        
        <!-- Stop Waiting Demand Heatmap -->
        <div class="card card-glass">
          <div class="card-header">
            <h3 class="card-title">Stage Queue Heatmap</h3>
            <span class="badge badge-warning">Live Waiting Signals</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
            Stages sorted by highest passenger waiting load. Dispatch relief buses dynamically.
          </p>
          <div id="heatmap-table-container">
            ${this.getHeatmapTableHTML()}
          </div>
        </div>

        <!-- Active Fleet Telemetry Table -->
        <div class="card card-glass">
          <div class="card-header">
            <h3 class="card-title">Electric Fleet Telematics</h3>
            <span class="badge badge-electric">Kiira Kayoola EVS</span>
          </div>
          <div style="overflow-x: auto;">
            <table class="demand-heatmap-table" id="fleet-telemetry-table">
              <thead>
                <tr>
                  <th>Bus ID</th>
                  <th>Model / Plate</th>
                  <th>Route</th>
                  <th>Battery</th>
                  <th>Occupancy</th>
                </tr>
              </thead>
              <tbody>
                ${this.getFleetTableHTML()}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  renderTelematicsTab() {
    return `
      <div class="card card-glass">
        <div class="card-header">
          <h3 class="card-title">Full Vehicle Fleet Telematics (Kiira Kayoola EVS)</h3>
          <button class="btn btn-outline btn-sm" onclick="AdminDashboard.exportReport()">Export Fleet Report</button>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">
          Real-time IoT telemetry streaming battery SoC, GPS coordinates, motor speed, and onboard passenger count.
        </p>
        <div style="overflow-x:auto;">
          <table class="demand-heatmap-table">
            <thead>
              <tr>
                <th>Bus Identifier</th>
                <th>Model &amp; Plate</th>
                <th>Assigned Driver</th>
                <th>Current Speed</th>
                <th>Battery SoC</th>
                <th>Est. Range</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${State.fleet.map(b => `
                <tr>
                  <td><b>${b.id}</b></td>
                  <td>${b.model}<br><span style="font-size:0.75rem; color:var(--text-muted);">${b.plateNumber}</span></td>
                  <td>${b.driverName}<br><span style="font-size:0.75rem; color:var(--text-muted);">${b.driverBadge}</span></td>
                  <td><b>${b.speedKmH} km/h</b></td>
                  <td><span style="color:#38BDF8; font-weight:800;">${Math.round(b.batteryPercent)}%</span></td>
                  <td>${b.rangeRemainingKm} km</td>
                  <td>${b.passengerCount}/${b.capacity}</td>
                  <td><span class="badge ${b.status === 'in-service' ? 'badge-electric' : 'badge-warning'}">${b.scheduleStatus}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderHeatmapTab() {
    const sortedStops = [...State.stops].sort((a, b) => b.waitingPassengers - a.waitingPassengers);
    return `
      <div class="card card-glass">
        <div class="card-header">
          <h3 class="card-title">All 18 Designated Kampala Smart Stages</h3>
          <span class="badge badge-warning">Live Wait Beacon Feed</span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">
          Passenger crowd signals aggregated in real time. Use the Dispatch button to deploy standby coaches to high-density stages.
        </p>
        <div style="overflow-x:auto;">
          <table class="demand-heatmap-table">
            <thead>
              <tr>
                <th>Stage Name</th>
                <th>Corridors Served</th>
                <th>Live Waiting Commuters</th>
                <th>Congestion Severity</th>
                <th>Stage Amenities</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${sortedStops.map(s => {
                const isHigh = s.waitingPassengers >= 12;
                return `
                  <tr>
                    <td><b>${s.name}</b> (${s.code})<br><span style="font-size:0.75rem; color:var(--text-muted);">${s.zone}</span></td>
                    <td>${s.routes.join(', ')}</td>
                    <td style="font-size:1.15rem; font-weight:800; color:${isHigh ? '#EF4444' : '#10B981'};">${s.waitingPassengers}</td>
                    <td><span class="${isHigh ? 'demand-badge-high' : 'demand-badge-med'}">${isHigh ? 'HIGH CONGESTION' : 'MODERATE'}</span></td>
                    <td><span style="font-size:0.75rem; color:var(--text-muted);">${s.amenities.join(', ')}</span></td>
                    <td>
                      <button class="btn btn-primary btn-sm" onclick="AdminDashboard.dispatchReliefBus('${s.id}')">
                        Dispatch Relief Bus
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderChargingTab() {
    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem;">
        <div class="card card-glass">
          <div class="card-header">
            <h3 class="card-title">Bweyogerere Mega Depot Hub</h3>
            <span class="badge badge-electric">Operational</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1rem; font-size:0.88rem;">
            <div style="display:flex; justify-content:space-between;"><span>Capacity:</span> <b>6 x 150kW DC Fast Bays</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Currently Charging:</span> <b style="color:var(--primary);">BUS 09 (Kayoola EVS)</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Grid Power Source:</span> <b>Nalubaale Hydro + Solar Rooftop</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Average Turnaround:</span> <b>38 minutes (20% to 90%)</b></div>
          </div>
        </div>

        <div class="card card-glass">
          <div class="card-header">
            <h3 class="card-title">City Centre Central Depot</h3>
            <span class="badge badge-electric">Operational</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1rem; font-size:0.88rem;">
            <div style="display:flex; justify-content:space-between;"><span>Capacity:</span> <b>4 x 80kW Overnight Bays</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Currently Charging:</span> <b>0 buses (Standby ready)</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Maintenance Bay:</span> <b style="color:#10B981;">100% Operational</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Fleet Readiness:</span> <b>5/6 Buses In Service</b></div>
          </div>
        </div>
      </div>
    `;
  },

  renderIncidentsTab() {
    return `
      <div class="card card-glass">
        <div class="card-header">
          <h3 class="card-title">Driver Delay &amp; Incident Dispatch Log</h3>
          <button class="btn btn-primary btn-sm" onclick="AdminDashboard.openBroadcastModal()">Publish Advisory</button>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">
          Real-time incident reports submitted from driver cockpit tablets and KCCA traffic advisories.
        </p>
        <div style="overflow-x:auto;">
          <table class="demand-heatmap-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Bus ID</th>
                <th>Incident Type</th>
                <th>Location / Stage</th>
                <th>Details &amp; Action Taken</th>
              </tr>
            </thead>
            <tbody>
              ${this.incidentLog.map(inc => `
                <tr>
                  <td><b>${inc.time}</b></td>
                  <td><span class="badge badge-info">${inc.bus}</span></td>
                  <td><span class="badge badge-warning">${inc.type}</span></td>
                  <td>${inc.stage}</td>
                  <td>${inc.note}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  getHeatmapTableHTML() {
    // Sort stops descending by waiting passengers
    const sortedStops = [...State.stops].sort((a, b) => b.waitingPassengers - a.waitingPassengers);

    return `
      <table class="demand-heatmap-table">
        <thead>
          <tr>
            <th>Bus Stop / Stage</th>
            <th>Waiting</th>
            <th>Level</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${sortedStops.slice(0, 6).map(s => {
            const isHigh = s.waitingPassengers >= 15;
            return `
              <tr>
                <td>
                  <div style="font-weight: 700; color: var(--text-main);">${s.name}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${s.zone}</div>
                </td>
                <td style="font-weight: 800; font-size: 1.1rem; color: ${isHigh ? '#EF4444' : '#F59E0B'}">
                  ${s.waitingPassengers}
                </td>
                <td>
                  <span class="${isHigh ? 'demand-badge-high' : 'demand-badge-med'}">
                    ${isHigh ? 'HIGH CONGESTION' : 'MODERATE'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="AdminDashboard.dispatchReliefBus('${s.id}')">
                    Dispatch
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  getFleetTableHTML() {
    return State.fleet.map(bus => {
      const pct = Math.round((bus.passengerCount / bus.capacity) * 100);
      return `
        <tr>
          <td>
            <div style="font-weight: 800; color: var(--primary);">${bus.id}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${bus.status}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${bus.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${bus.plateNumber}</div>
          </td>
          <td>
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${bus.routeId}</span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; color: #38BDF8;">
              ${Math.round(bus.batteryPercent)}%
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
              <div style="font-size: 0.78rem; font-weight: 700;">${bus.passengerCount}/${bus.capacity} (${pct}%)</div>
              <div style="background: rgba(255,255,255,0.1); height: 4px; border-radius: 2px; width: 60px;">
                <div style="background: ${pct > 85 ? '#EF4444' : '#10B981'}; width: ${pct}%; height: 100%; border-radius: 2px;"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  refreshDynamicContent() {
    const el = document.getElementById('heatmap-table-container');
    if (el) el.innerHTML = this.getHeatmapTableHTML();
    const tbody = document.querySelector('#fleet-telemetry-table tbody');
    if (tbody) tbody.innerHTML = this.getFleetTableHTML();
  },

  updateAdminMetrics() {
    const totalWaitingEl = document.getElementById('admin-waiting-commuters');
    if (totalWaitingEl) {
      totalWaitingEl.innerText = State.stops.reduce((sum, s) => sum + s.waitingPassengers, 0);
    }
    this.refreshDynamicContent();
  },

  dispatchReliefBus(stopId) {
    const stop = State.stops.find(s => s.id === stopId);
    if (!stop) return;

    App.showToast(
      'Relief Bus Dispatched',
      `Backup Kayoola Electric bus dispatched to relieve queue at "${stop.name}".`,
      'success'
    );

    // Reduce waiting count simulated
    if (stop.waitingPassengers > 8) {
      stop.waitingPassengers = Math.max(2, stop.waitingPassengers - 10);
      State.emit('stopsUpdated', State.stops);
    }
  },

  openBroadcastModal() {
    const msg = prompt("Enter public transit announcement for all E-Bus passengers:", "KCCA Transport Advisory: Express electric bus lanes active on Jinja Road.");
    if (msg) {
      State.addNotification({
        type: 'info',
        level: 'info',
        title: 'KCCA Dispatch Advisory',
        message: msg
      });
      App.showToast('Broadcast Published', 'Announcement broadcasted across passenger mobile portals.', 'info');
    }
  },

  exportReport() {
    let csv = "BusID,Name,Plate,Route,Battery%,Passengers,Capacity,Status\n";
    State.fleet.forEach(b => {
      csv += `${b.id},"${b.name}","${b.plateNumber}",${b.routeId},${Math.round(b.batteryPercent)},${b.passengerCount},${b.capacity},${b.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebus_uganda_fleet_report_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    App.showToast('Report Downloaded', 'Fleet CSV generated successfully', 'success');
  }
};
