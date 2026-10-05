#!/usr/bin/env python3
"""
Patch index.html for E-Bus Connect Uganda sections 11-25.
Handles mixed CRLF/LF line endings safely.
"""
import re

with open('index.html', 'rb') as f:
    raw = f.read()

# Normalize to LF for processing
content = raw.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')

# ============================================================
# PATCH 1: Replace timetable section (Section 14)
# ============================================================
OLD_TIMETABLE = '''    <section id="view-timetable" class="view-panel section" style="display: none;">
      <div class="container">
        <div class="section-header">
          <div class="section-kicker">Schedules &amp; Frequencies</div>
          <h2 class="section-title">Official E-Bus Timetable</h2>
          <p class="section-desc">Reliable departures every 8–15 minutes throughout peak and off-peak hours.</p>
        </div>

        <div class="card card-glass">
          <div style="overflow-x: auto;">
            <table class="demand-heatmap-table" id="timetable-table">
              <thead>
                <tr>
                  <th>Departure</th>
                  <th>Est. Arrival</th>
                  <th>Corridor Line</th>
                  <th>Vehicle Spec</th>
                  <th>Frequency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <!-- Populated by App.renderTimetable() -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>'''

NEW_TIMETABLE = '''    <section id="view-timetable" class="view-panel section" style="display: none;">
      <div class="container">
        <div class="section-header">
          <div class="section-kicker">Schedules &amp; Frequencies</div>
          <h2 class="section-title">E-Bus Timetable</h2>
          <p class="section-desc">Select a route, day, and time period to view scheduled departures. <b>Demo data — Prototype only.</b></p>
        </div>

        <!-- Prototype Notice -->
        <div style="display:flex; align-items:center; gap:0.65rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:var(--radius-md); padding:0.85rem 1rem; margin-bottom:1.5rem;" role="alert">
          <span style="font-size:1.2rem;">⚠️</span>
          <span style="font-size:0.82rem; color:var(--accent-gold);"><b>PROTOTYPE DATA:</b> These schedules are for demonstration purposes only and do not represent official Uganda electric bus timetables.</span>
        </div>

        <!-- Timetable Filters -->
        <div class="card card-glass" style="margin-bottom:1.5rem;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:1rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="tt-route-select">Route</label>
              <select id="tt-route-select" class="form-control" onchange="App.filterTimetable()">
                <option value="all">All Routes</option>
                <option value="R-01">Line 01 — Ntinda → City Centre</option>
                <option value="R-02">Line 02 — Chanja → City Centre</option>
                <option value="R-03">Line 03 — Nakawa → Mukono</option>
                <option value="R-04">Line 04 — Entebbe Express</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="tt-day-select">Day</label>
              <select id="tt-day-select" class="form-control" onchange="App.filterTimetable()">
                <option value="weekday">Weekday (Mon–Fri)</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday / Public Holiday</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="tt-period-select">Time Period</label>
              <select id="tt-period-select" class="form-control" onchange="App.filterTimetable()">
                <option value="all">All Day</option>
                <option value="morning">Morning (05:00–12:00)</option>
                <option value="afternoon">Afternoon (12:00–18:00)</option>
                <option value="evening">Evening (18:00–23:30)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Timetable Table -->
        <div class="card card-glass">
          <div style="overflow-x: auto;">
            <table class="demand-heatmap-table" id="timetable-table" role="table" aria-label="E-Bus Timetable">
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Departure</th>
                  <th scope="col">Est. Arrival</th>
                  <th scope="col">Stop / Corridor</th>
                  <th scope="col">Bus</th>
                  <th scope="col">Frequency</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <!-- Populated by App.renderTimetable() / App.filterTimetable() -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>'''

if OLD_TIMETABLE in content:
    content = content.replace(OLD_TIMETABLE, NEW_TIMETABLE, 1)
    print("✅ PATCH 1: Timetable section replaced.")
else:
    print("❌ PATCH 1: Timetable old content not found!")

# ============================================================
# PATCH 2: Replace notifications section (Section 16)
# ============================================================
OLD_NOTIF = '''    <!-- ==========================================================================
         VIEW 11: NOTIFICATIONS
         ========================================================================== -->
    <section id="view-notifications" class="view-panel section" style="display: none;">
      <div class="container container-narrow">
        <div class="section-header">
          <div class="section-kicker">Live Alerts</div>
          <h2 class="section-title">Transit Advisory &amp; Alerts</h2>
          <p class="section-desc">Stay informed about corridor speed, road notices, and green milestones.</p>
        </div>

        <div id="notifications-list-container" style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Populated by App.renderNotificationsList() -->
        </div>
      </div>
    </section>'''

NEW_NOTIF = '''    <!-- ==========================================================================
         VIEW 11: SERVICE ALERTS & NOTIFICATIONS (SECTION 16)
         ========================================================================== -->
    <section id="view-notifications" class="view-panel section" style="display: none;">
      <div class="container container-narrow">
        <div class="section-header">
          <div class="section-kicker">Live Service Alerts</div>
          <h2 class="section-title">Service Alerts &amp; Notifications</h2>
          <p class="section-desc">Real-time transit advisories, bus status updates, and route disruptions. Colour-coded by urgency level.</p>
        </div>

        <!-- Alert Level Legend -->
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1.25rem;" role="note" aria-label="Alert level legend">
          <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; padding:0.3rem 0.7rem; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); border-radius:999px; color:#38BDF8;">🔵 Information</span>
          <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; padding:0.3rem 0.7rem; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:999px; color:#F59E0B;">🟡 Warning</span>
          <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; padding:0.3rem 0.7rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:999px; color:#EF4444;">🔴 Urgent</span>
        </div>

        <div id="notifications-list-container" style="display: flex; flex-direction: column; gap: 1rem;" role="list" aria-live="polite">
          <!-- Populated by App.renderNotificationsList() -->
        </div>
      </div>
    </section>'''

if OLD_NOTIF in content:
    content = content.replace(OLD_NOTIF, NEW_NOTIF, 1)
    print("✅ PATCH 2: Notifications section replaced.")
else:
    print("❌ PATCH 2: Notifications old content not found!")

# ============================================================
# PATCH 3: Add new views BEFORE </main> — Journey Graph, Bus Rush, ETA Panel
# ============================================================
NEW_VIEWS = '''
    <!-- ==========================================================================
         VIEW 14: JOURNEY PROGRESS GRAPH (SECTION 17)
         ========================================================================== -->
    <section id="view-journey-graph" class="view-panel section" style="display: none;">
      <div class="container container-narrow">
        <div class="section-header">
          <div class="section-kicker">Live Journey Progress</div>
          <h2 class="section-title">Journey Progress Map</h2>
          <p class="section-desc">Visual journey progress bar showing your current position, completed stops, and remaining stops to your destination.</p>
        </div>
        <div id="journey-graph-container">
          <!-- Populated by App.renderJourneyGraph() -->
        </div>
      </div>
    </section>

    <!-- ==========================================================================
         VIEW 15: BUS RUSH MINI-GAME (SECTION 18)
         ========================================================================== -->
    <section id="view-bus-rush" class="view-panel section" style="display: none;">
      <div class="container container-narrow">
        <div class="section-header">
          <div class="section-kicker">Optional Entertainment</div>
          <h2 class="section-title">🎮 Bus Rush — While You Wait</h2>
          <p class="section-desc">
            An optional mini-game to keep you entertained while waiting for your bus.
            <b>The game automatically pauses when your bus is approaching.</b>
          </p>
        </div>

        <!-- Transit info always shown above game -->
        <div id="bus-rush-transit-banner" style="margin-bottom:1.25rem; padding:0.85rem 1rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:var(--radius-md);">
          <div style="font-size:0.8rem; color:var(--text-secondary);">
            🚌 <b>Your bus status:</b> <span id="bus-rush-eta-display">BUS 04 — ETA ~8 minutes</span>
          </div>
        </div>

        <div id="bus-rush-container" style="position:relative;">
          <!-- Game initialized by BusRush.init("bus-rush-container") -->
          <div style="text-align:center; padding:2rem 1rem;">
            <button class="btn btn-primary btn-lg" onclick="BusRush.init('bus-rush-container'); App.updateBusRushEtaBanner();" id="start-busrush-btn">
              🎮 Start Bus Rush
            </button>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.75rem;">
              Collect ⚡ coins, dodge 🚧 barriers. Game pauses automatically when your bus arrives.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ==========================================================================
         VIEW 16: ETA PANEL (SECTION 13)
         ========================================================================== -->
    <section id="view-eta" class="view-panel section" style="display: none;">
      <div class="container container-narrow">
        <div class="section-header">
          <div class="section-kicker">Prototype ETA System</div>
          <h2 class="section-title">Bus ETA Calculator</h2>
          <p class="section-desc">
            Estimated arrival times calculated using bus coordinates, stop coordinates, distance, and estimated speed.
            <b>⚠️ Prototype estimates only.</b>
          </p>
        </div>
        <div id="eta-panel-container">
          <!-- Populated by EtaEngine.renderEtaPanel("eta-panel-container") -->
        </div>
      </div>
    </section>

'''

if '</main>' in content:
    content = content.replace('</main>', NEW_VIEWS + '\n  </main>', 1)
    print("✅ PATCH 3: New views (Journey Graph, Bus Rush, ETA Panel) added.")
else:
    print("❌ PATCH 3: </main> not found!")

# ============================================================
# PATCH 4: Add new nav links to mobile drawer and desktop nav
# ============================================================
OLD_MOBILE_NAV_END = '      <li><a href="#about" class="nav-link" data-target="about">ℹ️ About E-Bus Connect</a></li>\n    </ul>'
NEW_MOBILE_NAV_END = '''      <li><a href="#about" class="nav-link" data-target="about">ℹ️ About E-Bus Connect</a></li>
      <li><a href="#journey-graph" class="nav-link" data-target="journey-graph">📈 Journey Progress</a></li>
      <li><a href="#bus-rush" class="nav-link" data-target="bus-rush">🎮 Bus Rush Game</a></li>
      <li><a href="#eta" class="nav-link" data-target="eta">⏱ ETA Calculator</a></li>
      <li style="border-top:1px solid var(--border-subtle); margin-top:0.75rem; padding-top:0.75rem;">
        <button class="btn btn-outline btn-sm" style="width:100%;" onclick="RoleAccess.showRoleModal(); App.closeMobileDrawer();" aria-label="Switch user role">
          🔐 Switch Role (Demo)
        </button>
      </li>
    </ul>'''

if OLD_MOBILE_NAV_END in content:
    content = content.replace(OLD_MOBILE_NAV_END, NEW_MOBILE_NAV_END, 1)
    print("✅ PATCH 4: Mobile nav links added.")
else:
    print("❌ PATCH 4: Mobile nav end not found!")

# ============================================================
# PATCH 5: Add "Switch Role" button to desktop nav actions
# ============================================================
OLD_NAV_ACTIONS = '        <!-- Mobile Drawer Hamburger Toggle -->'
NEW_NAV_ACTIONS = '''        <!-- Role Switcher (Prototype Demo) -->
        <button class="btn btn-outline btn-sm" onclick="RoleAccess.showRoleModal()" aria-label="Switch demo role" title="Switch Role (Prototype Demo)" style="font-size:0.78rem;">
          🔐 Role
        </button>

        <!-- Mobile Drawer Hamburger Toggle -->'''

if OLD_NAV_ACTIONS in content:
    content = content.replace(OLD_NAV_ACTIONS, NEW_NAV_ACTIONS, 1)
    print("✅ PATCH 5: Role switcher added to nav.")
else:
    print("❌ PATCH 5: Nav actions not found!")

# ============================================================
# WRITE OUTPUT
# ============================================================
with open('index.html', 'wb') as f:
    f.write(content.encode('utf-8'))

print("\n✅ All patches applied. index.html saved.")
