// ==========================================================================
// E-BUS CONNECT UGANDA - DATABASE SCHEMA & SECURITY ARCHITECTURE
// Sections 22, 23, 20: Database Design, Security & Privacy, Role-Based Access
// ==========================================================================
// IMPORTANT: This is a PROTOTYPE schema.
// All data in this prototype is in-memory / localStorage only.
// No real database is connected.
// Future implementation should use: Firebase Firestore / Supabase / PostgreSQL.
// ==========================================================================

/**
 * DATABASE SCHEMA REFERENCE
 * 
 * Collections / Tables (Firebase Firestore notation):
 * 
 * /users/{userId}
 *   - id: string (UID from Firebase Auth)
 *   - name: string
 *   - email: string (hashed/encrypted at rest)
 *   - phone: string (hashed)
 *   - role: 'passenger' | 'driver' | 'admin'
 *   - created_at: timestamp
 *   - last_seen: timestamp
 *   - home_stop_id: string (optional, user preference)
 *   - fcm_token: string (push notification token)
 * 
 * /drivers/{driverId}
 *   - id: string
 *   - user_id: string → /users
 *   - badge_id: string  (e.g. UG-DRV-042)
 *   - name: string
 *   - assigned_bus_id: string → /buses
 *   - license_number: string
 *   - status: 'active' | 'off-duty' | 'suspended'
 *   - joined_at: timestamp
 * 
 * /buses/{busId}
 *   - id: string  (e.g. BUS-004)
 *   - plate_number: string
 *   - model: string
 *   - capacity: number
 *   - assigned_route_id: string → /routes
 *   - assigned_driver_id: string → /drivers
 *   - status: 'in-service' | 'charging' | 'idle' | 'maintenance'
 *   - battery_percent: number
 *   - range_remaining_km: number
 *   - manufactured_year: number
 * 
 * /routes/{routeId}
 *   - id: string  (e.g. R-01)
 *   - name: string
 *   - short_name: string
 *   - color: string (hex)
 *   - fare_ugx: number
 *   - frequency_mins: number
 *   - first_bus: string (HH:MM)
 *   - last_bus: string (HH:MM)
 *   - status: 'active' | 'suspended' | 'modified'
 *   - stop_ids: string[]  (ordered)
 *   - coordinates: [lat, lng][]
 * 
 * /bus_stops/{stopId}
 *   - id: string  (e.g. ST-NTD)
 *   - name: string
 *   - short_name: string
 *   - code: string
 *   - zone: string
 *   - lat: number
 *   - lng: number
 *   - amenities: string[]
 *   - route_ids: string[]
 *   - is_active: boolean
 * 
 * /timetables/{entryId}
 *   - id: string
 *   - route_id: string → /routes
 *   - bus_id: string → /buses
 *   - stop_id: string → /bus_stops
 *   - day_type: 'weekday' | 'saturday' | 'sunday'
 *   - period: 'morning' | 'afternoon' | 'evening'
 *   - departure_time: string (HH:MM)
 *   - arrival_time: string (HH:MM)
 *   - status: 'scheduled' | 'cancelled' | 'modified'
 * 
 * /trips/{tripId}
 *   - id: string
 *   - bus_id: string → /buses
 *   - driver_id: string → /drivers
 *   - route_id: string → /routes
 *   - started_at: timestamp
 *   - ended_at: timestamp
 *   - passenger_count: number
 *   - total_stops: number
 *   - status: 'active' | 'completed' | 'cancelled'
 * 
 * /live_locations/{busId}
 *   - bus_id: string → /buses
 *   - lat: number
 *   - lng: number
 *   - speed_kmh: number
 *   - heading: number (degrees)
 *   - battery_percent: number
 *   - updated_at: timestamp (server timestamp)
 *   - source: 'driver_app' | 'dedicated_gps' | 'simulated'
 * 
 * /waiting_requests/{requestId}
 *   - id: string
 *   - stop_id: string → /bus_stops
 *   - route_id: string → /routes
 *   - created_at: timestamp
 *   - status: 'active' | 'cancelled' | 'boarded'
 *   - (NOTE: NO passenger user_id stored — privacy by design, Section 23)
 * 
 * /notifications/{notifId}
 *   - id: string
 *   - type: 'info' | 'warning' | 'urgent'
 *   - title: string
 *   - message: string
 *   - target_role: 'all' | 'passenger' | 'driver' | 'admin'
 *   - created_at: timestamp
 *   - expires_at: timestamp
 *   - created_by: string → /users (admin only)
 * 
 * /service_alerts/{alertId}
 *   - id: string
 *   - level: 'info' | 'warning' | 'urgent'
 *   - title: string
 *   - message: string
 *   - affected_route_ids: string[]
 *   - affected_stop_ids: string[]
 *   - created_at: timestamp
 *   - expires_at: timestamp
 *   - is_active: boolean
 * 
 * /journey_history/{historyId}
 *   - id: string
 *   - user_id: string → /users
 *   - from_stop_id: string → /bus_stops
 *   - to_stop_id: string → /bus_stops
 *   - route_id: string → /routes
 *   - bus_id: string → /buses
 *   - boarded_at: timestamp
 *   - alighted_at: timestamp
 *   - fare_paid_ugx: number
 *   - payment_method: string
 * 
 * /payments/{paymentId}  [FUTURE — NOT ACTIVE IN PROTOTYPE]
 *   - id: string
 *   - user_id: string → /users
 *   - trip_id: string → /trips
 *   - amount_ugx: number
 *   - method: 'mtn_momo' | 'airtel_money' | 'qr' | 'nfc' | 'card'
 *   - status: 'pending' | 'completed' | 'failed' | 'refunded'
 *   - transaction_ref: string (from payment provider)
 *   - created_at: timestamp
 *   - (NOTE: Raw payment credentials are NEVER stored in the frontend)
 * 
 * /audit_logs/{logId}  [Admin only — Section 23]
 *   - id: string
 *   - actor_id: string → /users
 *   - action: string
 *   - target_collection: string
 *   - target_id: string
 *   - old_value: any
 *   - new_value: any
 *   - timestamp: timestamp
 *   - ip_address: string (hashed)
 */

// ==========================================================================
// ROLE-BASED ACCESS CONTROL — Section 20
// ==========================================================================

const RoleAccess = {
  ROLES: {
    PASSENGER: 'passenger',
    DRIVER: 'driver',
    ADMIN: 'admin'
  },

  // Current session role (prototype: stored in memory + sessionStorage)
  // In production: verified via Firebase Auth JWT / server-side session
  _currentRole: sessionStorage.getItem('ebus_role') || 'passenger',
  _currentUser: JSON.parse(sessionStorage.getItem('ebus_user') || 'null'),

  get currentRole() { return this._currentRole; },
  get currentUser() { return this._currentUser; },

  // -----------------------------------------------------------------------
  // PERMISSIONS MAP — what each role can access
  // -----------------------------------------------------------------------
  permissions: {
    passenger: {
      views: ['home', 'find-bus', 'routes', 'tracking', 'timetable', 'planner', 'booking', 'waiting', 'notifications', 'support', 'about'],
      canAccessDriverPortal: false,
      canAccessAdminDashboard: false,
      canBroadcastAlerts: false,
      canDispatchBus: false,
      canExportData: false,
      canManageRoutes: false,
      canManageUsers: false
    },
    driver: {
      views: ['home', 'find-bus', 'routes', 'tracking', 'timetable', 'driver', 'notifications', 'support', 'about'],
      canAccessDriverPortal: true,
      canAccessAdminDashboard: false,
      canBroadcastAlerts: false,
      canDispatchBus: false,
      canExportData: false,
      canManageRoutes: false,
      canManageUsers: false
    },
    admin: {
      views: ['home', 'find-bus', 'routes', 'tracking', 'timetable', 'planner', 'booking', 'waiting', 'driver', 'admin', 'notifications', 'support', 'about'],
      canAccessDriverPortal: true,
      canAccessAdminDashboard: true,
      canBroadcastAlerts: true,
      canDispatchBus: true,
      canExportData: true,
      canManageRoutes: true,
      canManageUsers: true
    }
  },

  // -----------------------------------------------------------------------
  // CHECK PERMISSION
  // -----------------------------------------------------------------------
  can(permission) {
    const perms = this.permissions[this._currentRole];
    return perms ? !!perms[permission] : false;
  },

  canAccessView(viewId) {
    const perms = this.permissions[this._currentRole];
    return perms ? perms.views.includes(viewId) : false;
  },

  // -----------------------------------------------------------------------
  // DEMO LOGIN — for prototype only
  // In production: handled by Firebase Auth / OAuth / JWT
  // -----------------------------------------------------------------------
  login(role, name = 'Demo User') {
    if (!this.ROLES[role.toUpperCase()]) {
      return { success: false, error: 'Invalid role' };
    }
    const normalizedRole = role.toLowerCase();
    this._currentRole = normalizedRole;
    this._currentUser = { name, role: normalizedRole, isDemo: true };
    sessionStorage.setItem('ebus_role', normalizedRole);
    sessionStorage.setItem('ebus_user', JSON.stringify(this._currentUser));
    return { success: true };
  },

  logout() {
    this._currentRole = 'passenger';
    this._currentUser = null;
    sessionStorage.removeItem('ebus_role');
    sessionStorage.removeItem('ebus_user');
  },

  // -----------------------------------------------------------------------
  // RENDER ROLE SELECTOR MODAL (prototype demo)
  // -----------------------------------------------------------------------
  showRoleModal() {
    const existing = document.getElementById('role-modal');
    if (existing) { existing.style.display = 'flex'; return; }

    const modal = document.createElement('div');
    modal.id = 'role-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 style="font-size:1.25rem;">Switch Role (Prototype Demo)</h3>
          <button class="modal-close-btn" onclick="document.getElementById('role-modal').style.display='none'">✕</button>
        </div>

        <div style="margin-bottom:1rem; padding:0.85rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:var(--radius-md);">
          <div style="font-size:0.78rem; color:var(--accent-gold);">
            PROTOTYPE ONLY — In production, roles are assigned server-side via authenticated user accounts.
            Never place admin credentials in frontend code.
          </div>
        </div>

        <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:1.25rem;">
          Select a role to explore different views of the platform:
        </p>

        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${[
            { role: 'passenger', tag: 'PAX', label: 'Passenger', desc: 'Find buses, plan journeys, book rides' },
            { role: 'driver', tag: 'DRV', label: 'Driver', desc: 'In-cab tablet, trip controls, waiting alerts' },
            { role: 'admin', tag: 'ADM', label: 'Administrator', desc: 'Full fleet oversight, dispatch, reports' }
          ].map(r => `
            <button onclick="RoleAccess.switchRole('${r.role}')" style="
              display:flex; align-items:center; gap:1rem; text-align:left;
              background: ${this._currentRole === r.role ? 'rgba(16,185,129,0.15)' : 'var(--bg-surface-elevated)'};
              border: 2px solid ${this._currentRole === r.role ? 'var(--primary)' : 'var(--border-subtle)'};
              border-radius: var(--radius-md); padding: 0.9rem 1rem;
              cursor:pointer; color:var(--text-main); transition:all 0.2s;
            ">
              <span style="font-size:0.85rem; font-weight:800; padding:0.4rem 0.6rem; border-radius:var(--radius-sm); background:rgba(255,255,255,0.08);">${r.tag}</span>
              <div>
                <div style="font-weight:700;">${r.label} ${this._currentRole === r.role ? '(Active)' : ''}</div>
                <div style="font-size:0.78rem; color:var(--text-muted);">${r.desc}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  switchRole(role) {
    const result = this.login(role, role === 'admin' ? 'Admin User' : role === 'driver' ? 'Kato Denis' : 'Demo Passenger');
    if (result.success) {
      const modal = document.getElementById('role-modal');
      if (modal) modal.style.display = 'none';
      App.showToast(`Role: ${role.toUpperCase()}`, `You are now viewing as ${role}. Refreshing...`, 'info');
      setTimeout(() => App.navigateTo('home'), 800);
    }
  },

  // -----------------------------------------------------------------------
  // GUARD: Block access to restricted views
  // -----------------------------------------------------------------------
  guardView(viewId) {
    if (!this.canAccessView(viewId)) {
      App.showToast('Access Restricted', `The ${viewId} view requires a different role. Switch role to continue.`, 'warning');
      this.showRoleModal();
      return false;
    }
    return true;
  }
};
