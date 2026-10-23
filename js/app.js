// ==========================================================================
// E-BUS CONNECT UGANDA - MAIN APPLICATION CONTROLLER
// SPA Router, Navigation, View Handlers, PWA Installer, and Toasts
// ==========================================================================

const App = {
  views: [
    'home',
    'find-bus',
    'routes',
    'tracking',
    'timetable',
    'planner',
    'booking',
    'waiting',
    'driver',
    'admin',
    'payments',
    'notifications',
    'support',
    'about',
    'journey-graph',
    'bus-rush',
    'eta'
  ],
  deferredPrompt: null,

  init() {
    State.init();
    if (window.RoleAccess && typeof window.RoleAccess.init === 'function') {
      window.RoleAccess.init();
    }
    this.setupNavigation();
    this.setupPWA();
    this.setupToasts();
    this.setupHashRouting();

    // Initialize sub-modules
    Booking.init();
    WaitSystem.init();
    DriverPortal.init();
    AdminDashboard.init();

    // Render dynamic static components
    this.renderRoutesList();
    this.renderTimetable();
    this.renderNotificationsList();
    this.renderFindBusDropdowns();

    console.log("E-Bus Connect App ready");
  },

  setupHashRouting() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (this.views.includes(hash)) {
        this.navigateTo(hash, false);
      }
    });

    const initialHash = window.location.hash.replace('#', '');
    if (this.views.includes(initialHash)) {
      this.navigateTo(initialHash, false);
    } else {
      this.navigateTo('home', false);
    }
  },

  navigateTo(viewId, updateHash = true) {
    if (!this.views.includes(viewId)) return;

    // Server-verified permission guard
    if (window.RoleAccess && typeof window.RoleAccess.guardView === 'function') {
      if (!window.RoleAccess.guardView(viewId)) {
        return;
      }
    }

    // Toggle active view sections
    this.views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewId) {
          el.style.display = 'block';
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          el.style.display = 'none';
        }
      }
    });

    // Update nav links active class
    document.querySelectorAll('.nav-link, .dock-btn').forEach(btn => {
      const target = btn.getAttribute('data-target');
      if (target === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (updateHash) {
      window.location.hash = viewId;
    }

    State.currentView = viewId;

    // View specific initializers
    if (viewId === 'tracking') {
      setTimeout(() => {
        EbusMap.init('tracking-map');
      }, 100);
    } else if (viewId === 'waiting') {
      WaitSystem.renderWaitingView();
    } else if (viewId === 'driver') {
      DriverPortal.renderCockpit();
    } else if (viewId === 'admin') {
      AdminDashboard.renderDashboard();
    } else if (viewId === 'payments') {
      this.renderPayments();
    } else if (viewId === 'journey-graph') {
      this.renderJourneyGraph();
    } else if (viewId === 'eta') {
      EtaEngine.renderEtaPanel('eta-panel-container');
    } else if (viewId === 'bus-rush') {
      this.updateBusRushEtaBanner();
    }

    this.closeMobileDrawer();
  },

  setupNavigation() {
    // Nav link click events
    document.querySelectorAll('[data-target]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.getAttribute('data-target');
        this.navigateTo(target);
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        State.toggleTheme();
      });
    }

    // Mobile Drawer
    const mobileBtn = document.getElementById('mobile-toggle-btn');
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');

    if (mobileBtn && drawer && backdrop) {
      mobileBtn.addEventListener('click', () => {
        drawer.classList.add('open');
        backdrop.classList.add('active');
      });

      backdrop.addEventListener('click', () => this.closeMobileDrawer());
      if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => this.closeMobileDrawer());
    }

    // Prototype disclaimer close button
    const closeProtoBtn = document.getElementById('close-proto-btn');
    const protoBanner = document.getElementById('prototype-banner');
    if (closeProtoBtn && protoBanner) {
      closeProtoBtn.addEventListener('click', () => {
        protoBanner.style.display = 'none';
      });
    }
  },

  closeMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  },

  setupPWA() {
    // Service worker registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then((reg) => {
          console.log('E-Bus PWA Service Worker Registered', reg);
        }).catch((err) => {
          console.log('SW registration error:', err);
        });
      });
    }

    // PWA Install Prompt
    const installBtn = document.getElementById('pwa-install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log(`User response to install: ${outcome}`);
          this.deferredPrompt = null;
          installBtn.style.display = 'none';
        }
      });
    }
  },

  setupToasts() {
    // Toast container exists in DOM
  },

  showToast(title, desc, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" style="color: #10B981" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-icon" style="color: #F59E0B" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" style="color: #06B6D4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${desc}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  openWaitingSystemForStop(stopId) {
    State.activeWaitingStopId = stopId;
    this.navigateTo('waiting');
  },

  // ==========================================
  // Render Dynamic Sections
  // ==========================================
  renderFindBusDropdowns() {
    const origin = document.getElementById('search-origin');
    const dest = document.getElementById('search-dest');
    const routeFilter = document.getElementById('search-route-filter');
    const heroOrigin = document.getElementById('hero-search-origin') || document.getElementById('hero-from');
    const heroDest = document.getElementById('hero-search-dest') || document.getElementById('hero-to');
    const manualLocSelect = document.getElementById('manual-location-select');
    const plannerFrom = document.getElementById('planner-from-select');
    const plannerTo = document.getElementById('planner-to-select');

    const stopOptions = State.stops.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
    const routeOptions = State.routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    
    if (origin) origin.innerHTML = `<option value="">-- Select Origin / Stop --</option>` + stopOptions;
    if (dest) dest.innerHTML = `<option value="">-- Select Destination Stop --</option>` + stopOptions;
    if (routeFilter) routeFilter.innerHTML = `<option value="all">All Corridors & Routes</option>` + routeOptions;
    if (heroOrigin) heroOrigin.innerHTML = `<option value="">-- Boarding Stage --</option>` + stopOptions;
    if (heroDest) heroDest.innerHTML = `<option value="">-- Destination Stage --</option>` + stopOptions;
    if (manualLocSelect) manualLocSelect.innerHTML = `<option value="">-- Choose Your Location --</option>` + stopOptions;
    if (plannerFrom) plannerFrom.innerHTML = `<option value="">-- From (Location/Stop) --</option>` + stopOptions;
    if (plannerTo) plannerTo.innerHTML = `<option value="">-- To (Destination) --</option>` + stopOptions;

    // Set defaults
    if (manualLocSelect) manualLocSelect.value = 'ST-CHJ'; // Default Chanja
    if (plannerFrom) plannerFrom.value = 'ST-CHJ';
    if (plannerTo) plannerTo.value = 'ST-CBD';
    if (heroOrigin) heroOrigin.value = 'ST-CHJ';
    if (heroDest) heroDest.value = 'ST-CBD';

    this.renderPassengerBuses();
    this.renderNearbyStops();
  },

  renderNearbyStops() {
    const container = document.getElementById('nearby-stops-container');
    if (!container) return;

    const paxLat = State.passengerLocation.lat;
    const paxLng = State.passengerLocation.lng;

    // Calculate distance to each stop and sort
    const stopsWithDistance = State.stops.map(s => {
      const dist = EBUS_DATA.calculateDistanceKm(paxLat, paxLng, s.lat, s.lng);
      return { ...s, dist };
    }).sort((a, b) => a.dist - b.dist);

    container.innerHTML = stopsWithDistance.slice(0, 4).map(s => `
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${s.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${s.zone} • ${s.amenities.slice(0, 2).join(', ')}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; color: var(--primary); font-size: 0.9rem;">${s.dist} km away</div>
          <button class="btn btn-outline btn-sm" style="margin-top: 0.25rem; font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="App.openWaitingSystemForStop('${s.id}')">
            Wait Here
          </button>
        </div>
      </div>
    `).join('');
  },

  renderPassengerBuses(filterQuery = '') {
    const resultsContainer = document.getElementById('find-bus-results') || document.getElementById('passenger-buses-container');
    if (!resultsContainer) return;

    let buses = State.fleet;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      buses = buses.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.routeName.toLowerCase().includes(q) || 
        b.nextStopName.toLowerCase().includes(q) ||
        b.startLocation.toLowerCase().includes(q)
      );
    }

    resultsContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${buses.map(bus => {
          const distToPax = State.getDistanceToBus(bus.id);
          const statusClass = bus.scheduleStatus.includes('On Time') 
            ? 'badge-electric' 
            : (bus.scheduleStatus.includes('Delayed') ? 'badge-warning' : 'badge-danger');

          return `
            <div class="card card-glass" style="border-left: 4px solid ${bus.scheduleStatus.includes('On Time') ? 'var(--primary)' : (bus.scheduleStatus.includes('Delayed') ? 'var(--accent-gold)' : 'var(--accent-red)')};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.85rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <span style="font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--primary);">
                      ${bus.displayNumber || bus.id}
                    </span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">
                      ${bus.routeName}
                    </span>
                  </div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                    ${bus.model} • Registration: <b>${bus.plateNumber}</b>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="badge ${statusClass}">
                    ${bus.scheduleStatus}
                  </span>
                  <span class="badge badge-info">
                    ${Math.round(bus.batteryPercent)}% Battery
                  </span>
                </div>
              </div>

              <!-- Simple Clean Attribute Grid as Requested -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 1rem;">
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Current location:</div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${bus.currentLocationName || 'Near ' + bus.startLocation}</div>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Next stop:</div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: #38BDF8;">${bus.nextStopName}</div>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">ETA:</div>
                  <div style="font-weight: 800; font-size: 0.95rem; color: var(--primary);">${bus.etaMinutes} minutes</div>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Status:</div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: ${bus.status === 'in-service' ? '#34D399' : '#F59E0B'};">
                    ${bus.status === 'in-service' ? 'On Route' : 'At Charging Hub'}
                  </div>
                </div>
              </div>

              <!-- Distance to Passenger Notice -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                  Approx. <b>${distToPax !== null ? distToPax + ' km' : '~' + bus.distanceKm + ' km'}</b> from your location (${State.passengerLocation.name})
                </div>

                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('tracking'); EbusMap.focusBus('${bus.id}');">
                    View on Live Map
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="App.navigateTo('waiting'); App.openWaitingSystemForStop('${bus.nextStopId}');">
                    Wait for Bus
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="App.navigateTo('booking')">
                    Book Seat
                  </button>
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  handleFindBusSearch(e) {
    if (e) e.preventDefault();
    const query = (document.getElementById('search-filter-input')?.value || '').trim();
    const routeId = document.getElementById('search-route-filter')?.value || 'all';

    const resultsContainer = document.getElementById('find-bus-results') || document.getElementById('passenger-buses-container');
    if (!resultsContainer) return;

    let buses = State.fleet;
    if (routeId && routeId !== 'all') {
      buses = buses.filter(b => b.routeId === routeId);
    }
    if (query) {
      const q = query.toLowerCase();
      buses = buses.filter(b => 
        b.name.toLowerCase().includes(q) || 
        (b.displayNumber && b.displayNumber.toLowerCase().includes(q)) ||
        b.routeName.toLowerCase().includes(q) || 
        b.nextStopName.toLowerCase().includes(q) ||
        b.startLocation.toLowerCase().includes(q)
      );
    }

    if (buses.length === 0) {
      resultsContainer.innerHTML = `
        <div class="card card-glass" style="text-align: center; padding: 2.5rem 1rem;">
          <div style="margin-bottom: 0.5rem; display:flex; justify-content:center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">No Electric Buses Found</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 400px; margin: 0 auto 1rem auto;">
            No simulated buses matched "${query}". Try searching for <b>Ntinda</b>, <b>Kisementi</b>, <b>BUS 04</b>, or select <b>All Corridors</b>.
          </p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('search-filter-input').value=''; document.getElementById('search-route-filter').value='all'; App.renderPassengerBuses();">
            Reset Search Filters
          </button>
        </div>
      `;
      return;
    }

    // Render filtered list
    resultsContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${buses.map(bus => {
          const distToPax = State.getDistanceToBus(bus.id);
          const statusClass = bus.scheduleStatus.includes('On Time') 
            ? 'badge-electric' 
            : (bus.scheduleStatus.includes('Delayed') ? 'badge-warning' : 'badge-danger');

          return `
            <div class="card card-glass" style="border-left: 4px solid ${bus.scheduleStatus.includes('On Time') ? 'var(--primary)' : (bus.scheduleStatus.includes('Delayed') ? 'var(--accent-gold)' : 'var(--accent-red)')};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.85rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <span style="font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--primary);">
                      ${bus.displayNumber || bus.id}
                    </span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">
                      ${bus.routeName}
                    </span>
                  </div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                    ${bus.model} • Registration: <b>${bus.plateNumber}</b>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="badge ${statusClass}">
                    ${bus.scheduleStatus}
                  </span>
                  <span class="badge badge-info">
                    ${Math.round(bus.batteryPercent)}% Battery
                  </span>
                </div>
              </div>

              <!-- Simple Clean Attribute Grid as Requested -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 1rem;">
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Current location:</div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${bus.currentLocationName || 'Near ' + bus.startLocation}</div>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Next stop:</div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: #38BDF8;">${bus.nextStopName}</div>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">ETA:</div>
                  <div style="font-weight: 800; font-size: 0.95rem; color: var(--primary);">${bus.etaMinutes} minutes</div>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Status:</div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: ${bus.status === 'in-service' ? '#34D399' : '#F59E0B'};">
                    ${bus.status === 'in-service' ? 'On Route' : 'At Charging Hub'}
                  </div>
                </div>
              </div>

              <!-- Distance to Passenger Notice -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                  Approx. <b>${distToPax !== null ? distToPax + ' km' : '~' + bus.distanceKm + ' km'}</b> from your location (${State.passengerLocation.name})
                </div>

                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('tracking'); EbusMap.focusBus('${bus.id}');">
                    View on Live Map
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="App.navigateTo('waiting'); App.openWaitingSystemForStop('${bus.nextStopId}');">
                    Wait for Bus
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="App.navigateTo('booking')">
                    Book Seat
                  </button>
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  handleGeolocationRequest() {
    const statusEl = document.getElementById('geo-status-indicator');
    if (statusEl) statusEl.innerHTML = `Requesting browser location...`;

    State.requestBrowserGeolocation(
      (loc) => {
        if (statusEl) statusEl.innerHTML = `Location detected: <b>${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</b>`;
        App.showToast('Location Enabled', 'Distances to approaching electric buses recalculated.', 'success');
        this.renderPassengerBuses();
        this.renderNearbyStops();
      },
      (err) => {
        if (statusEl) statusEl.innerHTML = `Permission denied or unavailable. Using manual location.`;
        App.showToast('Location Permission', 'Using manual location selection. Your location is private.', 'info');
      }
    );
  },

  handleManualLocationChange() {
    const stopId = document.getElementById('manual-location-select').value;
    if (stopId) {
      State.setPassengerManualLocation(stopId);
      const statusEl = document.getElementById('geo-status-indicator');
      if (statusEl) statusEl.innerHTML = `Manual location set to: <b>${State.passengerLocation.name}</b>`;
      App.showToast('Location Updated', `Set passenger location to ${State.passengerLocation.name}`, 'info');
      this.renderPassengerBuses();
      this.renderNearbyStops();
    }
  },

  renderRoutesList() {
    const container = document.getElementById('routes-list-container');
    if (!container) return;

    container.innerHTML = State.routes.map(route => {
      const routeStops = route.stops.map(sid => State.stops.find(s => s.id === sid)).filter(Boolean);
      return `
        <div class="card card-glass" style="border-left: 5px solid ${route.color};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span class="badge" style="background:${route.color}22; color:${route.color}; border:1px solid ${route.color}55;">
                ${route.badge}
              </span>
              <h3 style="font-size:1.35rem; margin-top:0.4rem;">${route.name}</h3>
              <p style="font-size:0.88rem; color:var(--text-secondary);">${route.description}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.4rem; font-weight:800; color:var(--primary); font-family:var(--font-heading);">
                UGX ${route.fare.toLocaleString()}
              </div>
              <div style="font-size:0.75rem; color:var(--text-dim);">${route.frequency} • ~${route.estimatedMinutes} mins</div>
            </div>
          </div>

          <div style="margin-top:1.25rem;">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; font-weight:700;">
              Key Bus Stops (${routeStops.length} Stages)
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
              ${routeStops.map(s => `
                <span style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:0.35rem 0.65rem; border-radius:var(--radius-sm); font-size:0.8rem; display:inline-flex; align-items:center; gap:0.35rem;">
                  <b>${s.name}</b> <span style="color:var(--text-dim); font-size:0.7rem;">(${s.code})</span>
                </span>
              `).join('')}
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-subtle);">
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('timetable')">View Timetable</button>
            <button class="btn btn-primary btn-sm" onclick="App.navigateTo('tracking')">Track Route on Map</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // DEMO Timetable data: morning / afternoon / evening (Section 14)
  _timetableData: [
    // Morning
    { period:'morning', routeId:'R-01', dep:'05:30', arr:'05:54', stop:'Ntinda → City Centre', bus:'BUS 01 (Kayoola EVS)', freq:'Every 8 min', day:'weekday', status:'On Time' },
    { period:'morning', routeId:'R-01', dep:'05:38', arr:'06:02', stop:'Ntinda → City Centre', bus:'BUS 04 (Kayoola EVS)', freq:'Every 8 min', day:'weekday', status:'On Time' },
    { period:'morning', routeId:'R-02', dep:'05:45', arr:'06:17', stop:'Chanja → City Centre', bus:'BUS 02 (Kayoola EVS)', freq:'Every 12 min', day:'weekday', status:'On Time' },
    { period:'morning', routeId:'R-03', dep:'05:30', arr:'06:10', stop:'Nakawa → Mukono', bus:'BUS 07 (Kayoola Coach)', freq:'Every 10 min', day:'weekday', status:'On Time' },
    { period:'morning', routeId:'R-04', dep:'05:00', arr:'05:35', stop:'CBD → Entebbe Airport', bus:'EB-012 (Kayoola EVS)', freq:'Every 15 min', day:'weekday', status:'On Time' },
    { period:'morning', routeId:'R-01', dep:'06:00', arr:'06:24', stop:'Ntinda → City Centre', bus:'BUS 01 (Kayoola EVS)', freq:'Every 8 min', day:'weekday', status:'Boarding' },
    { period:'morning', routeId:'R-02', dep:'06:00', arr:'06:32', stop:'Chanja → City Centre', bus:'BUS 02 (Kayoola EVS)', freq:'Every 12 min', day:'saturday', status:'On Time' },
    { period:'morning', routeId:'R-01', dep:'06:30', arr:'06:54', stop:'Ntinda → City Centre', bus:'BUS 09 (Kayoola EVS)', freq:'Every 15 min', day:'saturday', status:'On Time' },
    { period:'morning', routeId:'R-03', dep:'07:00', arr:'07:40', stop:'Nakawa → Mukono', bus:'BUS 07 (Kayoola Coach)', freq:'Every 20 min', day:'sunday', status:'On Time' },
    // Afternoon
    { period:'afternoon', routeId:'R-01', dep:'12:00', arr:'12:24', stop:'Ntinda → City Centre', bus:'BUS 04 (Kayoola EVS)', freq:'Every 8 min', day:'weekday', status:'On Time' },
    { period:'afternoon', routeId:'R-02', dep:'12:30', arr:'13:02', stop:'Chanja → City Centre', bus:'BUS 02 (Kayoola EVS)', freq:'Every 12 min', day:'weekday', status:'Delayed' },
    { period:'afternoon', routeId:'R-03', dep:'13:00', arr:'13:40', stop:'Nakawa → Mukono', bus:'BUS 07 (Kayoola Coach)', freq:'Every 10 min', day:'weekday', status:'On Time' },
    { period:'afternoon', routeId:'R-04', dep:'14:00', arr:'14:35', stop:'CBD → Entebbe Airport', bus:'EB-015 (Kayoola EVS)', freq:'Every 15 min', day:'weekday', status:'On Time' },
    { period:'afternoon', routeId:'R-01', dep:'15:00', arr:'15:24', stop:'Ntinda → City Centre', bus:'BUS 01 (Kayoola EVS)', freq:'Every 8 min', day:'saturday', status:'On Time' },
    { period:'afternoon', routeId:'R-02', dep:'15:30', arr:'16:02', stop:'Chanja → City Centre', bus:'BUS 02 (Kayoola EVS)', freq:'Every 12 min', day:'saturday', status:'On Time' },
    { period:'afternoon', routeId:'R-01', dep:'14:00', arr:'14:24', stop:'Ntinda → City Centre', bus:'BUS 04 (Kayoola EVS)', freq:'Every 15 min', day:'sunday', status:'On Time' },
    // Evening
    { period:'evening', routeId:'R-01', dep:'18:00', arr:'18:24', stop:'Ntinda → City Centre', bus:'BUS 01 (Kayoola EVS)', freq:'Every 8 min', day:'weekday', status:'On Time' },
    { period:'evening', routeId:'R-02', dep:'18:30', arr:'19:02', stop:'Chanja → City Centre', bus:'BUS 02 (Kayoola EVS)', freq:'Every 12 min', day:'weekday', status:'On Time' },
    { period:'evening', routeId:'R-03', dep:'19:00', arr:'19:40', stop:'Nakawa → Mukono', bus:'BUS 07 (Kayoola Coach)', freq:'Every 10 min', day:'weekday', status:'On Time' },
    { period:'evening', routeId:'R-04', dep:'20:00', arr:'20:35', stop:'CBD → Entebbe Airport', bus:'EB-012 (Kayoola EVS)', freq:'Every 15 min', day:'weekday', status:'On Time' },
    { period:'evening', routeId:'R-01', dep:'21:00', arr:'21:24', stop:'Ntinda → City Centre', bus:'BUS 04 (Kayoola EVS)', freq:'Every 15 min', day:'weekday', status:'On Time' },
    { period:'evening', routeId:'R-01', dep:'22:00', arr:'22:24', stop:'Ntinda → City Centre', bus:'BUS 01 (Kayoola EVS)', freq:'Every 15 min', day:'saturday', status:'On Time' },
    { period:'evening', routeId:'R-04', dep:'23:00', arr:'23:35', stop:'CBD → Entebbe Airport', bus:'EB-015 (Kayoola EVS)', freq:'Every 30 min', day:'saturday', status:'Last Bus' },
    { period:'evening', routeId:'R-01', dep:'20:00', arr:'20:24', stop:'Ntinda → City Centre', bus:'BUS 04 (Kayoola EVS)', freq:'Every 30 min', day:'sunday', status:'Last Bus' },
  ],

  renderTimetable() {
    this.filterTimetable();
  },

  filterTimetable() {
    const tbody = document.querySelector('#timetable-table tbody');
    if (!tbody) return;
    const routeFilter = document.getElementById('tt-route-select')?.value || 'all';
    const dayFilter = document.getElementById('tt-day-select')?.value || 'weekday';
    const periodFilter = document.getElementById('tt-period-select')?.value || 'all';
    let rows = this._timetableData.filter(t => {
      if (routeFilter !== 'all' && t.routeId !== routeFilter) return false;
      if (t.day !== dayFilter) return false;
      if (periodFilter !== 'all' && t.period !== periodFilter) return false;
      return true;
    });
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">No scheduled services match these filters for the selected day and time.</td></tr>`;
      return;
    }
    const periodColors = { morning: '#F59E0B', afternoon: '#38BDF8', evening: '#8B5CF6' };
    const statusBadge = (s) => {
      const map = { 'On Time': 'badge-electric', 'Delayed': 'badge-warning', 'Boarding': 'badge-warning', 'Last Bus': 'badge-danger', 'Cancelled': 'badge-danger' };
      return `<span class="badge ${map[s] || 'badge-info'}" style="font-size:0.72rem;">${s}</span>`;
    };
    tbody.innerHTML = rows.map(t => `
      <tr>
        <td><span style="text-transform:capitalize; font-weight:700; color:${periodColors[t.period] || '#94A3B8'}; font-size:0.78rem;">${t.period}</span></td>
        <td style="font-weight:800; color:var(--primary); font-size:1rem;">${t.dep}</td>
        <td style="font-weight:700;">${t.arr}</td>
        <td style="font-size:0.82rem; color:var(--text-secondary);">${t.stop}</td>
        <td style="font-size:0.8rem;">${t.bus}</td>
        <td style="font-size:0.78rem; color:var(--text-muted);">${t.freq}</td>
        <td>${statusBadge(t.status)}</td>
      </tr>
    `).join('');
  },

  renderNotificationsList() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    // Level-aware rendering (Section 16)
    const levelConfig = {
      urgent:  { border: '#EF4444', bg: 'rgba(239,68,68,0.07)',  label: 'Urgent',      badge: 'badge-danger' },
      warning: { border: '#F59E0B', bg: 'rgba(245,158,11,0.07)', label: 'Warning',     badge: 'badge-warning' },
      info:    { border: '#38BDF8', bg: 'rgba(56,189,248,0.07)', label: 'Information', badge: 'badge-info' },
      service: { border: '#10B981', bg: 'rgba(16,185,129,0.07)', label: 'Service',     badge: 'badge-electric' },
      traffic: { border: '#F59E0B', bg: 'rgba(245,158,11,0.07)', label: 'Traffic',     badge: 'badge-warning' },
      update:  { border: '#38BDF8', bg: 'rgba(56,189,248,0.07)', label: 'Update',      badge: 'badge-info' },
    };

    container.innerHTML = State.alerts.map(a => {
      const lvl = levelConfig[a.level || a.type] || levelConfig.info;
      return `
      <div class="card card-glass" style="display:flex; align-items:flex-start; gap:1rem; border-left:4px solid ${lvl.border}; background:${lvl.bg};" role="listitem" aria-label="${lvl.label} alert: ${a.title}">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem; flex-wrap:wrap; gap:0.35rem;">
            <h4 style="font-size:1rem; color:var(--text-main); margin:0;">${a.title}</h4>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span class="badge ${lvl.badge}" style="font-size:0.68rem;">${lvl.label}</span>
              <span style="font-size:0.72rem; color:var(--text-dim); white-space:nowrap;">${a.timestamp}</span>
            </div>
          </div>
          <p style="font-size:0.88rem; color:var(--text-secondary); line-height:1.5; margin:0;">${a.message}</p>
        </div>
      </div>`;
    }).join('');
  },

  // Journey Progress Graph (Section 17)
  renderJourneyGraph() {
    const container = document.getElementById('journey-graph-container');
    if (!container) return;

    const bus = State.fleet.find(b => b.id === State.selectedTrackingBusId) || State.fleet[0];
    const route = State.routes.find(r => r.id === bus.routeId);
    if (!route) return;

    const stops = route.stops.map(sid => State.stops.find(s => s.id === sid)).filter(Boolean);
    const currentIdx = Math.max(0, stops.findIndex(s => s.id === bus.nextStopId) - 1);
    const progressPct = stops.length > 1 ? Math.round((currentIdx / (stops.length - 1)) * 100) : 0;

    container.innerHTML = `
      <!-- Header -->
      <div class="card card-glass" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.25rem;">
          <div>
            <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Tracking Bus</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${bus.displayNumber}</div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">${bus.routeName}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">Prototype ETA</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--accent-gold);">~${bus.etaMinutes} min</div>
            <div style="font-size:0.72rem; color:var(--text-dim);">Simulated estimate</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div style="margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-bottom:0.4rem;">
            <span>Start: ${stops[0]?.shortName}</span>
            <span>${progressPct}% complete</span>
            <span>End: ${stops[stops.length-1]?.shortName}</span>
          </div>
          <div style="background:var(--bg-surface-elevated); border-radius:999px; height:10px; overflow:hidden;">
            <div style="background:linear-gradient(90deg,#10B981,#38BDF8); height:100%; width:${progressPct}%; border-radius:999px; transition:width 0.4s ease;"></div>
          </div>
        </div>

        <!-- Stop Nodes -->
        <div style="position:relative; padding:1.5rem 0 0.5rem;">
          <!-- Connector line -->
          <div style="position:absolute; top:2.2rem; left:calc(100%/${stops.length*2}); right:calc(100%/${stops.length*2}); height:4px; background:var(--bg-surface-elevated); border-radius:2px; z-index:0;"></div>
          <div style="position:absolute; top:2.2rem; left:calc(100%/${stops.length*2}); width:${progressPct}%; height:4px; background:linear-gradient(90deg,#10B981,#38BDF8); border-radius:2px; z-index:1; transition:width 0.4s;"></div>

          <div style="display:flex; justify-content:space-between; position:relative; z-index:2;">
            ${stops.map((stop, i) => {
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isFuture = i > currentIdx;
              return `
                <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem; flex:1;">
                  <div style="
                    width:${isCurrent ? '36px' : '24px'};
                    height:${isCurrent ? '36px' : '24px'};
                    border-radius:50%;
                    display:flex; align-items:center; justify-content:center;
                    background:${isPast ? '#10B981' : isCurrent ? '#F59E0B' : 'var(--bg-surface-elevated)'};
                    border:3px solid ${isPast ? '#10B981' : isCurrent ? '#F59E0B' : 'var(--border-subtle)'};
                    font-size:${isCurrent ? '14px' : '10px'};
                    font-weight:800;
                    color:${isPast || isCurrent ? '#fff' : 'var(--text-muted)'};
                    box-shadow:${isCurrent ? '0 0 0 4px rgba(245,158,11,0.25)' : 'none'};
                    transition:all 0.3s;
                  " title="${stop.name}">
                    ${isPast ? '✓' : isCurrent ? '▶' : (i+1)}
                  </div>
                  <div style="font-size:0.68rem; font-weight:${isCurrent ? '800' : '500'}; color:${isCurrent ? 'var(--accent-gold)' : isPast ? 'var(--primary)' : 'var(--text-dim)'}; text-align:center; max-width:70px;">
                    ${stop.shortName}
                    ${isCurrent ? '<br><span style="font-size:0.6rem; color:var(--accent-gold);">▲ YOU ARE HERE</span>' : ''}
                  </div>
                  ${stop.waitingPassengers > 0 ? `<div style="font-size:0.6rem; color:var(--accent-gold); font-weight:700;">${stop.waitingPassengers} waiting</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Journey Summary -->
      <div class="card card-glass">
        <h3 style="font-size:1.1rem; margin-bottom:1rem;">Journey Summary</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:1rem;">
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Stops Completed</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${currentIdx} / ${stops.length - 1}</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Current Location</div>
            <div style="font-size:1rem; font-weight:700;">${bus.currentLocationName || stops[currentIdx]?.shortName}</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Next Stop</div>
            <div style="font-size:1rem; font-weight:700; color:#38BDF8;">${bus.nextStopName}</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Stops Remaining</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--accent-gold);">${stops.length - 1 - currentIdx}</div>
          </div>
        </div>
        <div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border-subtle); font-size:0.72rem; color:var(--text-dim);">
          Journey progress uses prototype simulated GPS data. ETA is an estimate only.
        </div>
      </div>
    `;
  },

  // Update Bus Rush ETA banner
  updateBusRushEtaBanner() {
    const el = document.getElementById('bus-rush-eta-display');
    if (!el) return;
    const bus = State.fleet.find(b => b.status === 'in-service') || State.fleet[0];
    el.textContent = `${bus.displayNumber} (${bus.routeName}) — ETA ~${bus.etaMinutes} minutes`;
  },

  handleJourneyPlanner(e) {
    if (e) e.preventDefault();
    const plannerResults = document.getElementById('planner-results');
    if (!plannerResults) return;

    const fromId = document.getElementById('planner-from-select')?.value || 'ST-CHJ';
    const toId = document.getElementById('planner-to-select')?.value || 'ST-CBD';

    const fromStop = State.stops.find(s => s.id === fromId) || State.stops.find(s => s.code === 'CHJ') || State.stops[0];
    const toStop = State.stops.find(s => s.id === toId) || State.stops.find(s => s.code === 'CBD') || State.stops[3];

    plannerResults.innerHTML = `
      <div class="card card-glass" style="border-left: 5px solid var(--primary); margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="badge badge-electric">Recommended Route</span>
            <h3 style="font-size: 1.3rem; margin-top: 0.35rem; color: var(--text-main);">
              ${fromStop.shortName || fromStop.name} → ${toStop.shortName || toStop.name}
            </h3>
            <div style="font-size: 0.82rem; color: var(--text-muted);">
              Zero emissions electric transit connection
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--primary);">UGX 3,000</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Pay via MTN MoMo / Airtel Money / Card</div>
          </div>
        </div>

        <!-- Exact Requested Step-by-Step Flow -->
        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; flex-direction: column; gap: 0.6rem; font-family: var(--font-heading); font-size: 1.05rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="badge badge-electric" style="font-size:0.7rem;">START</span>
              <span style="font-weight: 800; color: var(--text-main);">${fromStop.name}</span>
            </div>

            <div style="color: var(--primary); font-size: 1.2rem; padding-left: 1.2rem;">↓</div>

            <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.92rem; color: var(--text-secondary); padding-left: 0.4rem;">
              <span class="badge badge-info" style="font-size:0.65rem;">WALK</span>
              <span>Walk to nearest stop (approx. 250m, ~4 mins)</span>
            </div>

            <div style="color: var(--primary); font-size: 1.2rem; padding-left: 1.2rem;">↓</div>

            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="badge badge-warning" style="font-size:0.65rem;">STAGE</span>
              <span style="font-weight: 700; color: var(--text-main);">${fromStop.name.includes('Chanja') ? 'Kyanja Bus Stop (ST-KYJ)' : fromStop.name}</span>
            </div>

            <div style="color: var(--primary); font-size: 1.2rem; padding-left: 1.2rem;">↓</div>

            <div style="display: flex; align-items: center; gap: 0.6rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 0.65rem 0.85rem;">
              <span class="badge badge-electric" style="font-size:0.65rem;">TRANSIT</span>
              <span style="font-weight: 800; color: var(--primary-light);">E-Bus Route 02 (Chanja ⇄ City Centre • BUS 04)</span>
            </div>

            <div style="color: var(--primary); font-size: 1.2rem; padding-left: 1.2rem;">↓</div>

            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="badge badge-warning" style="font-size:0.65rem;">STAGE</span>
              <span style="font-weight: 700; color: var(--text-main);">Kisementi Bus Stop (Kamwokya Hub)</span>
            </div>

            <div style="color: var(--primary); font-size: 1.2rem; padding-left: 1.2rem;">↓</div>

            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="badge badge-primary" style="font-size:0.7rem;">DESTINATION</span>
              <span style="font-weight: 800; color: var(--text-main);">${toStop.name}</span>
            </div>
          </div>
        </div>

        <!-- Journey Summary Metric Grid -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
          <div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Walking Distance</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">250 metres</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Bus Route</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--primary);">Route 02</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Number of Stops</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">4 Stops</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Est. Journey Time</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #38BDF8;">32 minutes</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Est. Bus Arrival</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #F59E0B;">6 minutes</div>
          </div>
        </div>

        <!-- Action CTAs -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="App.navigateTo('waiting'); App.openWaitingSystemForStop('${fromStop.id}');">
            Signal Waiting at This Stop
          </button>
          <button class="btn btn-secondary" onclick="App.navigateTo('tracking'); EbusMap.focusBus('BUS 04');">
            Track Approaching Bus
          </button>
          <button class="btn btn-outline" onclick="App.navigateTo('booking')">
            Book Seat
          </button>
        </div>
      </div>
    `;
  },

  // ==========================================
  // Payments & Transit Fare Ledger (Task 5)
  // ==========================================
  renderPayments() {
    this.filterPaymentsList();
  },

  filterPaymentsList() {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;

    const query = (document.getElementById('payments-search-input')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('payments-status-filter')?.value || 'all';
    const methodFilter = document.getElementById('payments-method-filter')?.value || 'all';

    let list = State.payments || (EBUS_DATA && EBUS_DATA.payments) || [];

    if (query) {
      list = list.filter(p => 
        p.id.toLowerCase().includes(query) ||
        p.reference.toLowerCase().includes(query) ||
        p.route.toLowerCase().includes(query) ||
        p.stop.toLowerCase().includes(query) ||
        p.method.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter(p => p.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (methodFilter !== 'all') {
      list = list.filter(p => p.method.toLowerCase() === methodFilter.toLowerCase());
    }

    const badgeEl = document.getElementById('payments-count-badge');
    if (badgeEl) badgeEl.innerText = `${list.length} Records`;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
            No payment records matched the filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const statusClass = p.status === 'Completed' ? 'badge-electric' : (p.status === 'Refunded' ? 'badge-danger' : 'badge-warning');
      return `
        <tr>
          <td>
            <div style="font-family: var(--font-mono); font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${p.id}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${p.reference}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${p.route}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.stop} (${p.busId})</div>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary);">${p.date}</td>
          <td style="font-weight: 600; font-size: 0.88rem;">${p.method}</td>
          <td style="font-weight: 800; color: var(--primary); font-size: 1rem;">${p.currency} ${p.amount.toLocaleString()}</td>
          <td>
            <span class="badge ${statusClass}">
              ${p.status}
            </span>
          </td>
          <td>
            <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="App.showReceiptModal('${p.id}')">
              View Receipt
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  showReceiptModal(paymentId) {
    const list = State.payments || (EBUS_DATA && EBUS_DATA.payments) || [];
    const p = list.find(item => item.id === paymentId) || list[0];
    if (!p) return;

    const modalContent = document.getElementById('ticket-modal-content');
    const modal = document.getElementById('ticket-modal');
    if (!modalContent || !modal) return;

    modalContent.innerHTML = `
      <div class="ticket-card" style="margin: 0; box-shadow: none;">
        <div class="ticket-header">
          <div class="brand">E-BUS CONNECT UGANDA</div>
          <div style="font-size: 0.8rem; background: rgba(255,255,255,0.15); padding: 0.2rem 0.6rem; border-radius: 999px;">
            Digital Receipt (Demo)
          </div>
        </div>

        <div class="ticket-body">
          <div style="text-align: center; margin-bottom: 1.25rem;">
            <div style="font-size: 0.75rem; color: #64748B; text-transform: uppercase; font-weight: 700;">Payment Amount</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #0F172A; margin: 0.25rem 0;">${p.currency} ${p.amount.toLocaleString()}</div>
            <span class="badge badge-electric" style="font-size: 0.8rem;">Status: ${p.status}</span>
          </div>

          <div class="ticket-divider"></div>

          <div class="ticket-details-grid">
            <div class="ticket-detail-item">
              <span class="ticket-label">Receipt ID</span>
              <span class="ticket-value">${p.id}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Payment Ref</span>
              <span class="ticket-value">${p.reference}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Corridor Route</span>
              <span class="ticket-value">${p.route}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Date &amp; Time</span>
              <span class="ticket-value">${p.date}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Payment Method</span>
              <span class="ticket-value">${p.method}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Boarding Vehicle</span>
              <span class="ticket-value">${p.busId} (Zero Emission)</span>
            </div>
          </div>
        </div>

        <div class="ticket-qr-section">
          <div style="font-size: 0.78rem; color: #64748B; text-align: center;">
            Demo Receipt • E-Bus Transit Authority Uganda
          </div>
          <button class="btn btn-primary btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="Booking.closeTicketModal()">
            Close Receipt
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
