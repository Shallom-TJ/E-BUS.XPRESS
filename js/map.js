// ==========================================================================
// E-BUS CONNECT UGANDA - INTERACTIVE LEAFLET MAP MODULE
// Live Vehicle Telemetry, Route Polylines, and Bus Stop Waiting Markers
// ==========================================================================

const EbusMap = {
  mapInstance: null,
  busMarkers: {},
  stopMarkers: {},
  routeLines: {},
  passengerMarker: null,
  activeRouteFilter: 'all',
  isInitialized: false,

  init(containerId = 'tracking-map') {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (this.mapInstance) {
      this.mapInstance.invalidateSize();
      this.updatePassengerLocationMarker();
      return;
    }

    // Centered around Kampala metropolitan area (covering Ntinda, Kisementi, Bukoto, City Centre)
    const kampalaCenter = [0.3450, 32.5950];
    this.mapInstance = L.map(containerId, {
      center: kampalaCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    // Custom dark/clean tile layer suitable for modern transit telemetry
    const isDark = State.theme === 'dark';
    const tileUrl = isDark 
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    this.tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.mapInstance);

    // Zoom controls bottom right
    if (L.control && typeof L.control.zoom === 'function') {
      L.control.zoom({ position: 'bottomright' }).addTo(this.mapInstance);
    }

    // Render layers
    this.renderRouteLines();
    this.renderStopMarkers();
    this.renderBusMarkers();
    this.updatePassengerLocationMarker();

    // Hook to telemetry tick for continuous live tracking
    State.on('telemetryTick', (fleet) => {
      this.updateBusPositions(fleet);
      this.updateProximityHUD();
    });

    State.on('passengerLocationUpdated', () => {
      this.updatePassengerLocationMarker();
      this.updateProximityHUD();
    });

    State.on('stopsUpdated', (stops) => {
      this.refreshStopMarkers(stops);
    });

    State.on('themeChange', (theme) => {
      if (this.mapInstance) {
        setTimeout(() => this.mapInstance.invalidateSize(), 200);
      }
    });

    this.isInitialized = true;
    console.log("Leaflet transit map initialized with passenger tracking");
  },

  updatePassengerLocationMarker() {
    if (!this.mapInstance || !State.passengerLocation) return;
    const { lat, lng, name } = State.passengerLocation;

    if (this.passengerMarker) {
      this.passengerMarker.setLatLng([lat, lng]);
    } else {
      const passengerIcon = L.divIcon({
        className: 'custom-passenger-icon-wrapper',
        html: `
          <div class="passenger-loc-pin" title="Your Location">
            <div class="passenger-loc-pulse"></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      this.passengerMarker = L.marker([lat, lng], { icon: passengerIcon }).addTo(this.mapInstance);
      this.passengerMarker.bindPopup(`
        <div class="popup-custom-card">
          <div class="popup-custom-header">
            <span class="popup-title" style="color: #38BDF8;">Your Location</span>
            <span class="badge badge-info">${name}</span>
          </div>
          <p style="font-size: 0.8rem; color: #CBD5E1; margin-bottom: 0.5rem;">
            Estimated location for calculating nearby electric buses.
          </p>
          <div style="font-size: 0.72rem; color: #94A3B8; background: rgba(0,0,0,0.3); padding: 0.4rem; border-radius: 4px;">
            <b>Privacy Protected:</b> Your exact coordinates are never shared with drivers or other passengers.
          </div>
        </div>
      `);
    }
  },

  updateProximityHUD() {
    const hudEl = document.getElementById('proximity-distance-banner');
    if (!hudEl) return;

    const bus = State.fleet.find(b => b.id === State.selectedTrackingBusId) || State.fleet[0];
    const dist = State.getDistanceToBus(bus.id);
    const eta = bus.etaMinutes;

    hudEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div>
            <b>Passenger: ${State.passengerLocation.name}</b> &rarr; <b>Selected: ${bus.name} (${bus.routeName})</b>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <span style="color: var(--primary); font-weight: 800; font-size: 0.95rem;">
            You are approximately ${dist !== null ? dist : '2.4'} km from the selected bus.
          </span>
          <span class="badge badge-electric" style="font-size: 0.9rem;">
            Estimated arrival: ${eta} minutes.
          </span>
        </div>
      </div>
    `;
  },

  renderRouteLines() {
    State.routes.forEach(route => {
      if (!route.coordinates) return;
      const poly = L.polyline(route.coordinates, {
        color: route.color,
        weight: 5,
        opacity: 0.85,
        dashArray: '10, 6',
        lineCap: 'round'
      }).addTo(this.mapInstance);

      poly.bindTooltip(`<b>${route.name}</b><br>Fare: UGX ${route.fare.toLocaleString()} • ${route.frequency}`, {
        sticky: true,
        className: 'route-map-tooltip'
      });

      this.routeLines[route.id] = poly;
    });
  },

  renderStopMarkers() {
    State.stops.forEach(stop => {
      const isWaiting = stop.waitingPassengers > 0;
      const icon = L.divIcon({
        className: 'custom-stop-icon-wrapper',
        html: `
          <div class="custom-stop-marker ${isWaiting ? 'has-waiting' : ''}">
            <span>${stop.code}</span>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(this.mapInstance);

      marker.bindPopup(`
        <div class="popup-custom-card">
          <div class="popup-custom-header">
            <span class="popup-title">${stop.name}</span>
            <span class="badge ${isWaiting ? 'badge-warning' : 'badge-electric'}">${stop.code}</span>
          </div>
          <div class="popup-metrics">
            <div class="popup-metric-item">
              <span class="popup-label">Waiting Passengers</span>
              <span class="popup-val" style="color: ${isWaiting ? '#F59E0B' : '#10B981'}">
                ${stop.waitingPassengers} passenger${stop.waitingPassengers !== 1 ? 's' : ''}
              </span>
            </div>
            <div class="popup-metric-item">
              <span class="popup-label">Zone</span>
              <span class="popup-val">${stop.zone}</span>
            </div>
          </div>
          <div style="font-size:0.75rem; color:#94A3B8; margin-bottom:0.75rem;">
            Amenities: ${stop.amenities.join(', ')}
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%" onclick="App.openWaitingSystemForStop('${stop.id}')">
            I'm Waiting at This Stop
          </button>
        </div>
      `);

      this.stopMarkers[stop.id] = marker;
    });
  },

  refreshStopMarkers(stops) {
    stops.forEach(stop => {
      const marker = this.stopMarkers[stop.id];
      if (marker) {
        const isWaiting = stop.waitingPassengers > 0;
        const icon = L.divIcon({
          className: 'custom-stop-icon-wrapper',
          html: `
            <div class="custom-stop-marker ${isWaiting ? 'has-waiting' : ''}">
              <span>${stop.code}</span>
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        marker.setIcon(icon);
      }
    });
  },

  renderBusMarkers() {
    State.fleet.forEach(bus => {
      const icon = this.createBusIcon(bus);
      const marker = L.marker([bus.lat, bus.lng], { icon }).addTo(this.mapInstance);
      this.attachBusPopup(marker, bus);
      this.busMarkers[bus.id] = marker;
    });
  },

  createBusIcon(bus) {
    const isCharging = bus.status === 'charging';
    return L.divIcon({
      className: 'custom-bus-icon-container',
      html: `
        <div class="custom-bus-marker" id="marker-${bus.id}">
          <div class="bus-marker-pin ${isCharging ? 'charging' : 'pulse'}">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
            <div class="bus-marker-badge">${bus.id}</div>
            <div class="bus-marker-battery">${Math.round(bus.batteryPercent)}%</div>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  },

  attachBusPopup(marker, bus) {
    const distToPax = State.getDistanceToBus(bus.id);
    marker.bindPopup(`
      <div class="popup-custom-card">
        <div class="popup-custom-header">
          <div>
            <span class="popup-title">${bus.name}</span>
            <div style="font-size:0.75rem; color:#94A3B8;">${bus.plateNumber} • ${bus.model}</div>
          </div>
          <span class="badge ${bus.scheduleStatus.includes('On Time') ? 'badge-electric' : (bus.scheduleStatus.includes('Delayed') ? 'badge-warning' : 'badge-danger')}">
            ${bus.scheduleStatus}
          </span>
        </div>
        <div class="popup-metrics">
          <div class="popup-metric-item">
            <span class="popup-label">Route</span>
            <span class="popup-val" style="color:#10B981">${bus.routeName}</span>
          </div>
          <div class="popup-metric-item">
            <span class="popup-label">Current Location</span>
            <span class="popup-val">${bus.currentLocationName || 'On Route'}</span>
          </div>
          <div class="popup-metric-item">
            <span class="popup-label">Next Stop</span>
            <span class="popup-val" style="color:#38BDF8">${bus.nextStopName}</span>
          </div>
          <div class="popup-metric-item">
            <span class="popup-label">Estimated Arrival</span>
            <span class="popup-val" style="color:#F59E0B">${bus.etaMinutes} minutes</span>
          </div>
          <div class="popup-metric-item">
            <span class="popup-label">Speed / Battery</span>
            <span class="popup-val">${bus.speedKmH} km/h • ${Math.round(bus.batteryPercent)}%</span>
          </div>
          <div class="popup-metric-item">
            <span class="popup-label">Distance to You</span>
            <span class="popup-val">${distToPax !== null ? distToPax + ' km' : '~' + bus.distanceKm + ' km'}</span>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="App.navigateTo('booking')">
            Book Seat
          </button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="EbusMap.focusBus('${bus.id}')">
            Follow Live
          </button>
        </div>
      </div>
    `);
  },

  updateBusPositions(fleet) {
    fleet.forEach(bus => {
      const marker = this.busMarkers[bus.id];
      if (marker) {
        marker.setLatLng([bus.lat, bus.lng]);
        
        // Update popup info if open
        const popup = marker.getPopup();
        if (popup && popup.isOpen()) {
          this.attachBusPopup(marker, bus);
        }

        // Update live battery badge text
        const el = document.getElementById(`marker-${bus.id}`);
        if (el) {
          const batt = el.querySelector('.bus-marker-battery');
          if (batt) batt.innerHTML = `${Math.round(bus.batteryPercent)}%`;
        }
      }
    });
  },

  focusBus(busId) {
    const bus = State.fleet.find(b => b.id === busId);
    if (bus && this.mapInstance) {
      this.mapInstance.flyTo([bus.lat, bus.lng], 15, { duration: 1.2 });
      if (this.busMarkers[busId]) {
        this.busMarkers[busId].openPopup();
      }
    }
  },

  centerKampala() {
    if (this.mapInstance) {
      this.mapInstance.flyTo([0.3236, 32.5950], 12, { duration: 1 });
    }
  }
};
