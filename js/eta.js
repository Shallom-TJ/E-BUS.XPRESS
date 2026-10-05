// ==========================================================================
// E-BUS CONNECT UGANDA - ETA CALCULATION ENGINE (SECTION 13)
// Prototype estimate using Haversine distance + speed heuristic
// ==========================================================================
// IMPORTANT: This is a PROTOTYPE ETA estimate.
// It uses: Bus GPS coordinates + Stop coordinates + Speed + Distance.
// It does NOT account for: traffic, road conditions, signals, delays, real GPS.
// Future versions should integrate: real GPS feed, historical travel times,
// traffic APIs, road condition data, and machine-learning delay predictions.
// ==========================================================================

const EtaEngine = {

  // -----------------------------------------------------------------------
  // CORE ETA CALCULATION
  // Inputs: busLat/Lng (current bus position), targetLat/Lng (stop or passenger),
  //         speedKmH (current reported speed)
  // Returns: { distanceKm, etaMinutes, confidence, note }
  // -----------------------------------------------------------------------
  calculate({ busLat, busLng, targetLat, targetLng, speedKmH = 30 }) {
    // Step 1 — Straight-line geodesic distance (Haversine)
    const straightLineKm = EBUS_DATA.calculateDistanceKm(busLat, busLng, targetLat, targetLng);

    // Step 2 — Road distance correction factor (urban grid ~1.35x)
    // Real implementation: use OSRM / Google Distance Matrix API
    const ROAD_CORRECTION = 1.35;
    const roadDistanceKm = Math.round(straightLineKm * ROAD_CORRECTION * 10) / 10;

    // Step 3 — Effective speed heuristic (urban buses average ~20-25 km/h with stops)
    const effectiveSpeedKmH = Math.max(15, Math.min(speedKmH * 0.72, 40));

    // Step 4 — Raw ETA in minutes
    const rawEtaMin = (roadDistanceKm / effectiveSpeedKmH) * 60;

    // Step 5 — Round to nearest minute, clamp to min 1 min
    const etaMinutes = Math.max(1, Math.round(rawEtaMin));

    // Step 6 — Confidence indicator (lower for large distances)
    let confidence, confidenceColor;
    if (straightLineKm < 1.0) {
      confidence = 'High';
      confidenceColor = '#10B981';
    } else if (straightLineKm < 3.0) {
      confidence = 'Medium';
      confidenceColor = '#F59E0B';
    } else {
      confidence = 'Low';
      confidenceColor = '#EF4444';
    }

    return {
      straightLineKm,
      roadDistanceKm,
      etaMinutes,
      confidence,
      confidenceColor,
      note: `Prototype estimate. Straight-line: ${straightLineKm} km → Road estimate: ${roadDistanceKm} km at ~${Math.round(effectiveSpeedKmH)} km/h effective speed.`
    };
  },

  // -----------------------------------------------------------------------
  // Calculate ETA from a bus to a specific stop
  // -----------------------------------------------------------------------
  busToStop(busId, stopId) {
    const bus = State.fleet.find(b => b.id === busId);
    const stop = State.stops.find(s => s.id === stopId);
    if (!bus || !stop) return null;

    return this.calculate({
      busLat: bus.lat,
      busLng: bus.lng,
      targetLat: stop.lat,
      targetLng: stop.lng,
      speedKmH: bus.speedKmH
    });
  },

  // -----------------------------------------------------------------------
  // Calculate ETA from a bus to the passenger's current location
  // -----------------------------------------------------------------------
  busToPassenger(busId) {
    const bus = State.fleet.find(b => b.id === busId);
    if (!bus || !State.passengerLocation) return null;

    return this.calculate({
      busLat: bus.lat,
      busLng: bus.lng,
      targetLat: State.passengerLocation.lat,
      targetLng: State.passengerLocation.lng,
      speedKmH: bus.speedKmH
    });
  },

  // -----------------------------------------------------------------------
  // Get full ETA breakdown for all buses relative to a stop
  // -----------------------------------------------------------------------
  allBusesToStop(stopId) {
    return State.fleet
      .filter(b => b.status === 'in-service')
      .map(bus => {
        const eta = this.busToStop(bus.id, stopId);
        return { bus, eta };
      })
      .filter(item => item.eta !== null)
      .sort((a, b) => a.eta.etaMinutes - b.eta.etaMinutes);
  },

  // -----------------------------------------------------------------------
  // Render ETA Card HTML — compact, for embedding in passenger cards
  // -----------------------------------------------------------------------
  renderEtaCardHTML(busId, stopId) {
    const eta = this.busToStop(busId, stopId);
    if (!eta) return '';

    return `
      <div class="eta-card-proto" role="region" aria-label="ETA Information" style="
        background: rgba(16,185,129,0.07);
        border: 1px solid rgba(16,185,129,0.2);
        border-radius: 0.75rem;
        padding: 0.85rem 1rem;
        margin-top: 0.5rem;
      ">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; margin-bottom:0.2rem;">
              Prototype ETA Estimate
            </div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--primary); font-family:var(--font-heading);">
              ~${eta.etaMinutes} min
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.15rem;">
              Road dist: ~${eta.roadDistanceKm} km
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.2rem;">Confidence</div>
            <span style="
              display:inline-block;
              padding: 0.3rem 0.65rem;
              border-radius: 999px;
              font-size: 0.75rem;
              font-weight: 700;
              background: ${eta.confidenceColor}22;
              color: ${eta.confidenceColor};
              border: 1px solid ${eta.confidenceColor}44;
            ">${eta.confidence}</span>
            <div style="font-size:0.68rem; color:var(--text-dim); margin-top:0.3rem;">
              Est. speed: ~${Math.round(eta.roadDistanceKm / eta.etaMinutes * 60)} km/h
            </div>
          </div>
        </div>
        <div style="
          font-size: 0.67rem;
          color: var(--text-dim);
          margin-top: 0.6rem;
          padding-top: 0.6rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          line-height: 1.4;
        ">
          <b>Prototype estimate only:</b> Does not account for traffic, road conditions, signals, or delays.
          Future versions will use real GPS data, historical travel times, and live traffic feeds.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Render full ETA breakdown panel — for the dedicated ETA section
  // -----------------------------------------------------------------------
  renderEtaPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const bus = State.fleet.find(b => b.id === State.selectedTrackingBusId) || State.fleet[0];
    const paxEta = this.busToPassenger(bus.id);

    container.innerHTML = `
      <div class="card card-glass" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title">ETA System — How It Works</h3>
        </div>

        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin: 1rem 0;
          padding: 1rem;
          background: var(--bg-surface-elevated);
          border-radius: var(--radius-md);
        ">
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Bus Position</div>
            <div style="font-weight:700; font-size:0.9rem;">${bus.currentLocationName || 'Simulated'}</div>
            <div style="font-size:0.72rem; color:var(--text-dim);">${bus.lat.toFixed(4)}, ${bus.lng.toFixed(4)} (simulated)</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Your Position</div>
            <div style="font-weight:700; font-size:0.9rem;">${State.passengerLocation.name}</div>
            <div style="font-size:0.72rem; color:var(--text-dim);">${State.passengerLocation.lat?.toFixed(4) || '0.4050'}, ${State.passengerLocation.lng?.toFixed(4) || '32.5950'}</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Bus Speed</div>
            <div style="font-weight:700; font-size:0.9rem;">${bus.speedKmH} km/h</div>
            <div style="font-size:0.72rem; color:var(--text-dim);">Effective: ~${Math.round(bus.speedKmH * 0.72)} km/h (urban)</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Estimated ETA</div>
            <div style="font-weight:800; font-size:1.5rem; color:var(--primary);">~${paxEta?.etaMinutes || bus.etaMinutes} min</div>
          </div>
        </div>

        <!-- ETA Formula Breakdown -->
        <div style="
          background: rgba(0,0,0,0.25);
          border-radius: var(--radius-md);
          padding: 1rem;
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.7;
          font-family: monospace;
        ">
          <div style="color:var(--primary); font-weight:700; margin-bottom:0.5rem;">ETA Formula (Prototype):</div>
          1. Straight-line distance = Haversine formula (lat/lng) → ${paxEta?.straightLineKm || '~2.4'} km<br>
          2. Road distance = straight-line × 1.35 (urban grid factor) → ${paxEta?.roadDistanceKm || '~3.2'} km<br>
          3. Effective speed = bus speed × 0.72 (stops + congestion) → ~${Math.round(bus.speedKmH * 0.72)} km/h<br>
          4. ETA = road distance ÷ effective speed × 60 → ~${paxEta?.etaMinutes || bus.etaMinutes} minutes
        </div>

        <!-- Future improvements list -->
        <div style="margin-top: 1.25rem; padding: 1rem; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius-md);">
          <div style="font-size:0.8rem; font-weight:700; color:var(--accent-gold); margin-bottom:0.5rem;">
            Future ETA System Integrations:
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
            ${['Real GPS data (live)', 'Traffic conditions', 'Historical travel times',
               'Road conditions', 'Delay patterns', 'Signal timing data',
               'Weather factors', 'Machine-learning predictions'].map(item =>
              `<span style="font-size:0.75rem; background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius: 999px; padding:0.25rem 0.6rem; color:var(--text-secondary);">${item}</span>`
            ).join('')}
          </div>
        </div>
      </div>

      <!-- Per-Bus ETA Table -->
      <div class="card card-glass">
        <div class="card-header">
          <h3 class="card-title">All Buses — Distance &amp; ETA to Your Location</h3>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <th style="padding:0.65rem; text-align:left; color:var(--text-muted); font-weight:600;">Bus</th>
                <th style="padding:0.65rem; text-align:left; color:var(--text-muted); font-weight:600;">Route</th>
                <th style="padding:0.65rem; text-align:right; color:var(--text-muted); font-weight:600;">Distance</th>
                <th style="padding:0.65rem; text-align:right; color:var(--text-muted); font-weight:600;">ETA</th>
                <th style="padding:0.65rem; text-align:center; color:var(--text-muted); font-weight:600;">Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${State.fleet.map(b => {
                const eta = this.busToPassenger(b.id);
                if (!eta) return '';
                return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                    <td style="padding:0.65rem;">
                      <span style="font-weight:700; color:var(--primary);">${b.displayNumber}</span><br>
                      <span style="font-size:0.72rem; color:var(--text-dim);">${b.status}</span>
                    </td>
                    <td style="padding:0.65rem; color:var(--text-secondary); font-size:0.82rem;">${b.routeName}</td>
                    <td style="padding:0.65rem; text-align:right; font-weight:700;">${eta.roadDistanceKm} km</td>
                    <td style="padding:0.65rem; text-align:right; font-weight:800; color:var(--primary);">~${eta.etaMinutes} min</td>
                    <td style="padding:0.65rem; text-align:center;">
                      <span style="font-size:0.72rem; font-weight:700; color:${eta.confidenceColor};">${eta.confidence}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="font-size:0.7rem; color:var(--text-dim); margin-top:0.75rem; text-align:center;">
          Prototype estimates only.
        </div>
      </div>
    `;
  }
};
