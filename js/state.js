// ==========================================================================
// E-BUS CONNECT UGANDA - STATE & REAL-TIME EVENT SIMULATION
// Reactive Local State, Bus Telemetry GPS Loop, and Dispatch Bus
// ==========================================================================

const State = {
  // Subscribers
  listeners: {},

  // Current App State
  currentView: 'home',
  theme: localStorage.getItem('ebus_theme') || 'dark',
  waitingSessions: JSON.parse(localStorage.getItem('ebus_waiting_sessions') || '[]'),
  activeWaitingStopId: localStorage.getItem('ebus_active_wait_stop') || null,
  activeWaitingRouteId: localStorage.getItem('ebus_active_wait_route') || null,
  activeWaitingTimestamp: localStorage.getItem('ebus_active_wait_time') || null,
  bookedTickets: JSON.parse(localStorage.getItem('ebus_booked_tickets') || '[]'),
  
  // Realtime Mutable Data
  fleet: JSON.parse(JSON.stringify(EBUS_DATA.fleet)),
  stops: JSON.parse(JSON.stringify(EBUS_DATA.stops)),
  routes: JSON.parse(JSON.stringify(EBUS_DATA.routes)),
  alerts: JSON.parse(JSON.stringify(EBUS_DATA.alerts)),
  payments: JSON.parse(localStorage.getItem('ebus_payments') || JSON.stringify(EBUS_DATA.payments)),

  // Driver Mode State
  driverModeBusId: 'BUS 04',
  driverIsBroadcasting: true,

  // Passenger Location State
  passengerLocation: {
    lat: 0.4050,
    lng: 32.5950,
    name: "Chanja",
    isEstimated: true
  },
  selectedTrackingBusId: 'BUS 04',

  init() {
    this.applyTheme(this.theme);
    this.setupNetworkListeners();
    this.startSimulationLoop();
    console.log("E-Bus Connect State initialized");
  },

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.emit('networkStatusChange', true);
      if (window.App && App.showToast) {
        App.showToast('Online Connected', 'Live bus telemetry streaming restored.', 'success');
      }
    });
    window.addEventListener('offline', () => {
      this.emit('networkStatusChange', false);
      if (window.App && App.showToast) {
        App.showToast('Offline Mode Active', 'Operating offline. Cached timetable, stops and maps remain available.', 'warning');
      }
    });
  },

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error("State listener error:", e);
        }
      });
    }
  },

  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ebus_theme', theme);
    this.emit('themeChange', theme);
  },

  toggleTheme() {
    const next = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
  },

  // Passenger Location & Geolocation
  setPassengerManualLocation(stopId) {
    const stop = this.stops.find(s => s.id === stopId);
    if (!stop) return;
    this.passengerLocation = {
      lat: stop.lat,
      lng: stop.lng,
      name: stop.shortName || stop.name,
      isEstimated: false
    };
    this.emit('passengerLocationUpdated', this.passengerLocation);
    this.emit('telemetryTick', this.fleet);
  },

  requestBrowserGeolocation(onSuccess, onError) {
    if (!navigator.geolocation) {
      if (onError) onError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.passengerLocation = {
          lat: lat,
          lng: lng,
          name: "My GPS Location",
          isEstimated: false
        };
        this.emit('passengerLocationUpdated', this.passengerLocation);
        this.emit('telemetryTick', this.fleet);
        if (onSuccess) onSuccess(this.passengerLocation);
      },
      (err) => {
        console.warn("Geolocation permission denied or timed out:", err.message);
        if (onError) onError(err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  },

  getDistanceToBus(busId) {
    const bus = this.fleet.find(b => b.id === busId);
    if (!bus || !this.passengerLocation) return null;
    return EBUS_DATA.calculateDistanceKm(
      this.passengerLocation.lat,
      this.passengerLocation.lng,
      bus.lat,
      bus.lng
    );
  },

  // Passenger Waiting ("WAIT") actions
  registerPassengerWaiting(stopId, routeId) {
    const stop = this.stops.find(s => s.id === stopId);
    if (!stop) return false;

    // Increment stop counter
    stop.waitingPassengers += 1;
    this.activeWaitingStopId = stopId;
    this.activeWaitingRouteId = routeId;
    this.activeWaitingTimestamp = Date.now();

    const session = {
      id: 'WAIT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      stopId: stopId,
      stopName: stop.name,
      routeId: routeId,
      timestamp: this.activeWaitingTimestamp,
      status: 'broadcasting'
    };

    this.waitingSessions.unshift(session);
    localStorage.setItem('ebus_active_wait_stop', stopId);
    localStorage.setItem('ebus_active_wait_route', routeId);
    localStorage.setItem('ebus_active_wait_time', this.activeWaitingTimestamp);
    localStorage.setItem('ebus_waiting_sessions', JSON.stringify(this.waitingSessions));

    // Create system alert
    this.addNotification({
      type: 'warning',
      title: 'Waiting Signal Transmitted',
      message: `Your waiting signal at "${stop.name}" was sent to approaching electric buses.`
    });

    this.emit('passengerWaitingUpdated', { stop, session });
    this.emit('stopsUpdated', this.stops);
    return session;
  },

  cancelPassengerWaiting() {
    if (this.activeWaitingStopId) {
      const stop = this.stops.find(s => s.id === this.activeWaitingStopId);
      if (stop && stop.waitingPassengers > 0) {
        stop.waitingPassengers -= 1;
      }
    }
    this.activeWaitingStopId = null;
    this.activeWaitingRouteId = null;
    this.activeWaitingTimestamp = null;
    localStorage.removeItem('ebus_active_wait_stop');
    localStorage.removeItem('ebus_active_wait_route');
    localStorage.removeItem('ebus_active_wait_time');

    this.addNotification({
      type: 'info',
      title: 'Waiting Signal Cancelled',
      message: 'You have cancelled your waiting status.'
    });

    this.emit('passengerWaitingCancelled');
    this.emit('stopsUpdated', this.stops);
  },

  addBookedTicket(ticket) {
    this.bookedTickets.unshift(ticket);
    localStorage.setItem('ebus_booked_tickets', JSON.stringify(this.bookedTickets));
    this.emit('ticketBooked', ticket);
  },

  addNotification(alert) {
    alert.id = 'ALT-' + Date.now();
    alert.timestamp = 'Just now';
    this.alerts.unshift(alert);
    this.emit('newAlert', alert);
  },

  // Driver Cockpit Telemetry Updates
  updateDriverPassengerCount(delta) {
    const bus = this.fleet.find(b => b.id === this.driverModeBusId);
    if (!bus) return;
    const newCount = bus.passengerCount + delta;
    if (newCount >= 0 && newCount <= bus.capacity) {
      bus.passengerCount = newCount;
      this.emit('fleetUpdated', this.fleet);
      this.emit('driverTelemeteryUpdated', bus);
    }
  },

  // Simulation Loop: Moving buses realistically along their routes
  startSimulationLoop() {
    setInterval(() => {
      this.fleet.forEach(bus => {
        if (bus.status !== 'in-service') return;

        const route = this.routes.find(r => r.id === bus.routeId);
        if (!route || !route.coordinates || route.coordinates.length < 2) return;

        // Micro-step GPS coordinates
        const coords = route.coordinates;
        bus.currentStep = (bus.currentStep || 0) + 1;
        const totalSteps = 60; // 60 seconds per leg
        const leg = Math.floor((bus.currentStep % (coords.length * totalSteps)) / totalSteps);
        const nextLeg = (leg + 1) % coords.length;
        const progress = (bus.currentStep % totalSteps) / totalSteps;

        const startPt = coords[leg];
        const endPt = coords[nextLeg];

        bus.lat = startPt[0] + (endPt[0] - startPt[0]) * progress;
        bus.lng = startPt[1] + (endPt[1] - startPt[1]) * progress;

        // Dynamic human-readable leg location & next stop
        if (bus.id === "BUS 01" || bus.id === "BUS 04") {
          // Specific corridor: Ntinda -> Bukoto -> Kisementi -> City Centre
          if (leg === 0) {
            bus.currentLocationName = "Near Ntinda";
            bus.nextStopName = "Bukoto Bus Stop";
          } else if (leg === 1) {
            bus.currentLocationName = "Near Bukoto Market";
            bus.nextStopName = "Kisementi Bus Stop";
          } else if (leg === 2) {
            bus.currentLocationName = "Near Kisementi";
            bus.nextStopName = "City Centre (Pioneer Mall)";
          } else {
            bus.currentLocationName = "City Centre Terminus";
            bus.nextStopName = "Ntinda Bus Stop";
          }
        }

        // Fluctuating realistic speed & regenerative battery
        bus.speedKmH = Math.max(18, Math.min(55, Math.round(bus.speedKmH + (Math.random() * 4 - 2))));
        
        // Random micro battery drain or regen
        if (Math.random() > 0.85) {
          bus.batteryPercent = Math.max(12, Math.min(99, bus.batteryPercent + (Math.random() > 0.7 ? 0.1 : -0.1)));
        }

        // Recalculate ETA and distance
        const remainingFraction = 1 - progress;
        bus.etaMinutes = Math.max(1, Math.round(remainingFraction * 8));
        bus.distanceKm = Math.round(remainingFraction * 3.5 * 10) / 10;
      });

      this.emit('telemetryTick', this.fleet);
    }, 2500);
  }
};
