// ==========================================================================
// E-BUS CONNECT UGANDA - AUTHENTICATION & ROLE-BASED ACCESS CONTROL
// Section 20: Verified Server-Side Identity via Supabase Auth & PostgreSQL RLS
// ==========================================================================
// In Step B, roles are verified from the "profiles" table in Supabase.
// Client-side tampering (sessionStorage or console edits) CANNOT grant access.
// ==========================================================================

const RoleAccess = {
  ROLES: {
    PASSENGER: 'passenger',
    DRIVER: 'driver',
    ADMIN: 'admin'
  },

  // State verified against Supabase
  _session: null,
  _user: null,
  _profile: null,
  _driverInfo: null,
  _initialized: false,

  get currentRole() {
    return this._profile?.role || (this._user ? 'passenger' : 'passenger');
  },

  get currentUser() {
    if (!this._user) return null;
    return {
      id: this._user.id,
      email: this._user.email,
      fullName: this._profile?.full_name || this._user.user_metadata?.full_name || 'Passenger',
      phone: this._profile?.phone || this._user.user_metadata?.phone || '',
      role: this.currentRole,
      badgeId: this._driverInfo?.badge_id || null,
      busId: this._driverInfo?.bus_id || null
    };
  },

  get isAuthenticated() {
    return !!this._user;
  },

  // -----------------------------------------------------------------------
  // PERMISSIONS MAP
  // -----------------------------------------------------------------------
  permissions: {
    passenger: {
      views: ['home', 'find-bus', 'routes', 'tracking', 'timetable', 'planner', 'booking', 'waiting', 'notifications', 'support', 'about', 'payments', 'journey-graph', 'eta', 'bus-rush'],
      canAccessDriverPortal: false,
      canAccessAdminDashboard: false,
      canBroadcastAlerts: false,
      canDispatchBus: false,
      canExportData: false,
      canManageRoutes: false,
      canManageUsers: false
    },
    driver: {
      views: ['home', 'find-bus', 'routes', 'tracking', 'timetable', 'driver', 'notifications', 'support', 'about', 'eta', 'bus-rush'],
      canAccessDriverPortal: true,
      canAccessAdminDashboard: false,
      canBroadcastAlerts: false,
      canDispatchBus: false,
      canExportData: false,
      canManageRoutes: false,
      canManageUsers: false
    },
    admin: {
      views: ['home', 'find-bus', 'routes', 'tracking', 'timetable', 'planner', 'booking', 'waiting', 'driver', 'admin', 'notifications', 'support', 'about', 'payments', 'journey-graph', 'eta', 'bus-rush'],
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
  // INITIALIZATION
  // -----------------------------------------------------------------------
  async init() {
    if (!window.supabaseClient) {
      if (window.supabase && typeof window.supabase.createClient === 'function' && window.SUPABASE_CONFIG) {
        window.supabaseClient = window.supabase.createClient(
          window.SUPABASE_CONFIG.url,
          window.SUPABASE_CONFIG.anonKey
        );
      }
    }

    const client = window.supabaseClient;
    if (!client) {
      console.warn('[RoleAccess] Supabase client unavailable. Running in guest passenger mode.');
      this.updateAuthUI();
      return;
    }

    try {
      // 1. Get initial active session
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.warn('[RoleAccess] Error getting session:', error.message);
      }

      if (session) {
        this._session = session;
        this._user = session.user;
        await this.loadUserProfile(session.user.id);
      }

      // 2. Listen to real-time auth state changes
      client.auth.onAuthStateChange(async (event, session) => {
        console.log(`[RoleAccess] Auth state change event: ${event}`);
        this._session = session;
        this._user = session ? session.user : null;

        if (this._user) {
          await this.loadUserProfile(this._user.id);
        } else {
          this._profile = null;
          this._driverInfo = null;
        }

        this.updateAuthUI();

        // If currently in a protected view that user lost permission for, redirect
        const currentView = State?.currentView || 'home';
        if (currentView === 'admin' && this.currentRole !== 'admin') {
          App?.navigateTo('home');
        } else if (currentView === 'driver' && this.currentRole !== 'driver' && this.currentRole !== 'admin') {
          if (window.DriverPortal) window.DriverPortal.loginVerified = false;
          App?.navigateTo('home');
        } else if (currentView === 'driver' && (this.currentRole === 'driver' || this.currentRole === 'admin')) {
          if (window.DriverPortal) {
            window.DriverPortal.loginVerified = true;
            window.DriverPortal.renderCockpit();
          }
        }
      });
    } catch (err) {
      console.error('[RoleAccess] Auth initialization failed:', err);
    }

    this._initialized = true;
    this.updateAuthUI();
  },

  // -----------------------------------------------------------------------
  // LOAD PROFILE FROM DATABASE (Single source of truth)
  // -----------------------------------------------------------------------
  async loadUserProfile(userId) {
    const client = window.supabaseClient;
    if (!client || !userId) return;

    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, phone, role, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[RoleAccess] Profile fetch failed:', error.message);
        // Fallback default
        this._profile = { id: userId, role: 'passenger' };
      } else {
        this._profile = data;
      }

      // If driver, load assigned badge & bus
      if (this._profile?.role === 'driver') {
        const { data: driverData } = await client
          .from('drivers')
          .select('badge_id, bus_id, active')
          .eq('user_id', userId)
          .maybeSingle();

        this._driverInfo = driverData || null;
      } else {
        this._driverInfo = null;
      }
    } catch (err) {
      console.error('[RoleAccess] Could not load profile:', err);
      this._profile = { id: userId, role: 'passenger' };
    }
  },

  // -----------------------------------------------------------------------
  // AUTH ACTIONS
  // -----------------------------------------------------------------------
  async signUp(email, password, fullName = '', phone = '') {
    const client = window.supabaseClient;
    if (!client) throw new Error('Database client not initialized');

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim()
        }
      }
    });

    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const client = window.supabaseClient;
    if (!client) throw new Error('Database client not initialized');

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) throw error;

    if (data?.user) {
      await this.loadUserProfile(data.user.id);
      this.updateAuthUI();
    }
    return data;
  },

  async signOut() {
    const client = window.supabaseClient;
    if (client) {
      await client.auth.signOut();
    }
    this._session = null;
    this._user = null;
    this._profile = null;
    this._driverInfo = null;
    if (window.DriverPortal) window.DriverPortal.loginVerified = false;
    this.updateAuthUI();
    App.showToast('Signed Out', 'You have been safely signed out.', 'info');
    App.navigateTo('home');
  },

  // -----------------------------------------------------------------------
  // PERMISSIONS CHECK
  // -----------------------------------------------------------------------
  can(permission) {
    const perms = this.permissions[this.currentRole];
    return perms ? !!perms[permission] : false;
  },

  canAccessView(viewId) {
    const perms = this.permissions[this.currentRole];
    return perms ? perms.views.includes(viewId) : false;
  },

  // -----------------------------------------------------------------------
  // GUARD: Block unauthorized access to views
  // -----------------------------------------------------------------------
  guardView(viewId) {
    // Admin Dashboard guard
    if (viewId === 'admin') {
      if (!this.isAuthenticated) {
        App.showToast('Admin Access Required', 'Please sign in with an Administrator account.', 'warning');
        this.showAuthModal('login', 'admin');
        return false;
      }
      if (this.currentRole !== 'admin') {
        App.showToast('Access Denied', 'Your account does not have Administrator privileges.', 'error');
        return false;
      }
      return true;
    }

    // Driver Portal guard
    if (viewId === 'driver') {
      if (!this.isAuthenticated) {
        App.showToast('Driver Access Required', 'Please sign in with your verified Driver account.', 'warning');
        this.showAuthModal('login', 'driver');
        return false;
      }
      if (this.currentRole !== 'driver' && this.currentRole !== 'admin') {
        App.showToast('Access Denied', 'Your account is registered as a Passenger. Only authorised drivers can access the cockpit.', 'error');
        return false;
      }
      return true;
    }

    return true;
  },

  // -----------------------------------------------------------------------
  // UI SYNC
  // -----------------------------------------------------------------------
  updateAuthUI() {
    const authBtn = document.getElementById('auth-status-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-status-btn');

    const roleTag = this.currentRole.toUpperCase();
    const roleColors = {
      admin: '#EF4444',
      driver: '#3B82F6',
      passenger: '#10B981'
    };
    const activeColor = roleColors[this.currentRole] || '#10B981';

    const buttonLabel = this.isAuthenticated
      ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${activeColor}; margin-right:6px;"></span><span style="font-weight:700;">${roleTag}</span> • ${this.currentUser.fullName.split(' ')[0]}`
      : `<span>Sign In</span>`;

    if (authBtn) {
      authBtn.innerHTML = buttonLabel;
      authBtn.setAttribute('title', this.isAuthenticated ? `Signed in as ${this.currentUser.email} (${roleTag})` : 'Sign In / Register');
    }

    if (mobileAuthBtn) {
      mobileAuthBtn.innerHTML = this.isAuthenticated
        ? `<span>Account: <strong>${this.currentUser.fullName}</strong> (${roleTag})</span>`
        : `<span>Sign In / Create Account</span>`;
    }
  },

  handleAuthBtnClick() {
    if (this.isAuthenticated) {
      this.showAccountModal();
    } else {
      this.showAuthModal('login');
    }
  },

  // -----------------------------------------------------------------------
  // AUTH MODAL (Login & Register)
  // -----------------------------------------------------------------------
  showAuthModal(initialTab = 'login', redirectView = null) {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'auth-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px; padding: 2rem; position: relative;">
        <button class="modal-close-btn" onclick="document.getElementById('auth-modal').style.display='none'" style="position:absolute; top:1.2rem; right:1.2rem; background:none; border:none; color:var(--text-muted); font-size:1.4rem; cursor:pointer;">✕</button>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: rgba(16,185,129,0.15); color: var(--primary); margin-bottom: 0.75rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h3 style="font-size: 1.4rem; margin-bottom: 0.25rem;">E-Bus Account</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Secure transit identity backed by Supabase</p>
        </div>

        <!-- Tab Switcher -->
        <div style="display: flex; gap: 0.5rem; background: var(--bg-surface-elevated); padding: 0.3rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
          <button id="auth-tab-login" onclick="RoleAccess.switchAuthTab('login')" style="flex:1; padding: 0.6rem; border-radius: var(--radius-sm); border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; background: ${initialTab === 'login' ? 'var(--primary)' : 'transparent'}; color: ${initialTab === 'login' ? '#000' : 'var(--text-muted)'};">
            Sign In
          </button>
          <button id="auth-tab-register" onclick="RoleAccess.switchAuthTab('register')" style="flex:1; padding: 0.6rem; border-radius: var(--radius-sm); border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; background: ${initialTab === 'register' ? 'var(--primary)' : 'transparent'}; color: ${initialTab === 'register' ? '#000' : 'var(--text-muted)'};">
            Create Account
          </button>
        </div>

        <!-- Alert / Feedback Banner -->
        <div id="auth-error-banner" style="display: none; padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.82rem;"></div>

        <!-- Login Form -->
        <form id="auth-login-form" style="display: ${initialTab === 'login' ? 'block' : 'none'};" onsubmit="RoleAccess.handleLoginSubmit(event, '${redirectView || ''}')">
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-control" required placeholder="name@example.com" autocomplete="email">
          </div>
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label" for="login-password">Password</label>
            <input type="password" id="login-password" class="form-control" required placeholder="••••••••" autocomplete="current-password">
          </div>
          <button type="submit" id="auth-login-submit-btn" class="btn btn-primary" style="width: 100%; padding: 0.8rem; font-weight: 700;">
            Sign In
          </button>
        </form>

        <!-- Register Form -->
        <form id="auth-register-form" style="display: ${initialTab === 'register' ? 'block' : 'none'};" onsubmit="RoleAccess.handleRegisterSubmit(event, '${redirectView || ''}')">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" for="reg-name">Full Name</label>
            <input type="text" id="reg-name" class="form-control" required placeholder="e.g. Kato Denis">
          </div>
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" for="reg-phone">Phone Number (MTN / Airtel)</label>
            <input type="tel" id="reg-phone" class="form-control" placeholder="0770 000 000">
          </div>
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" for="reg-email">Email Address</label>
            <input type="email" id="reg-email" class="form-control" required placeholder="name@example.com" autocomplete="email">
          </div>
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label" for="reg-password">Create Password</label>
            <input type="password" id="reg-password" class="form-control" required minlength="6" placeholder="At least 6 characters" autocomplete="new-password">
          </div>
          <button type="submit" id="auth-register-submit-btn" class="btn btn-primary" style="width: 100%; padding: 0.8rem; font-weight: 700;">
            Create Passenger Account
          </button>
          <div style="font-size: 0.72rem; color: var(--text-dim); text-align: center; margin-top: 0.75rem;">
            Driver and Admin access is assigned securely in the database by system administrators.
          </div>
        </form>
      </div>
    `;
  },

  switchAuthTab(tab) {
    const loginTab = document.getElementById('auth-tab-login');
    const regTab = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('auth-login-form');
    const regForm = document.getElementById('auth-register-form');
    const errBanner = document.getElementById('auth-error-banner');
    if (errBanner) errBanner.style.display = 'none';

    if (tab === 'login') {
      loginTab.style.background = 'var(--primary)';
      loginTab.style.color = '#000';
      regTab.style.background = 'transparent';
      regTab.style.color = 'var(--text-muted)';
      loginForm.style.display = 'block';
      regForm.style.display = 'none';
    } else {
      regTab.style.background = 'var(--primary)';
      regTab.style.color = '#000';
      loginTab.style.background = 'transparent';
      loginTab.style.color = 'var(--text-muted)';
      regForm.style.display = 'block';
      loginForm.style.display = 'none';
    }
  },

  async handleLoginSubmit(e, redirectView) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('auth-login-submit-btn');
    const errBanner = document.getElementById('auth-error-banner');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errBanner.style.display = 'none';

    try {
      await this.signIn(email, password);
      document.getElementById('auth-modal').style.display = 'none';
      App.showToast('Welcome Back!', `Signed in as ${this.currentUser.fullName} (${this.currentRole.toUpperCase()})`, 'success');

      if (redirectView) {
        App.navigateTo(redirectView);
      }
    } catch (err) {
      errBanner.style.display = 'block';
      errBanner.style.background = 'rgba(239, 68, 68, 0.15)';
      errBanner.style.border = '1px solid #EF4444';
      errBanner.style.color = '#EF4444';
      errBanner.textContent = err.message || 'Login failed. Please check your credentials.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  },

  async handleRegisterSubmit(e, redirectView) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('auth-register-submit-btn');
    const errBanner = document.getElementById('auth-error-banner');

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    errBanner.style.display = 'none';

    try {
      const data = await this.signUp(email, password, name, phone);
      document.getElementById('auth-modal').style.display = 'none';

      if (data?.session) {
        App.showToast('Account Created', `Welcome to E-Bus Connect, ${name}!`, 'success');
        if (redirectView) App.navigateTo(redirectView);
      } else {
        App.showToast('Check Your Email', 'A confirmation link has been sent to your email address.', 'info');
      }
    } catch (err) {
      errBanner.style.display = 'block';
      errBanner.style.background = 'rgba(239, 68, 68, 0.15)';
      errBanner.style.border = '1px solid #EF4444';
      errBanner.style.color = '#EF4444';
      errBanner.textContent = err.message || 'Registration failed. Please try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Passenger Account';
    }
  },

  // -----------------------------------------------------------------------
  // ACCOUNT INFO MODAL (Signed in state)
  // -----------------------------------------------------------------------
  showAccountModal() {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'auth-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const u = this.currentUser;
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px; padding: 2rem; position: relative;">
        <button class="modal-close-btn" onclick="document.getElementById('auth-modal').style.display='none'" style="position:absolute; top:1.2rem; right:1.2rem; background:none; border:none; color:var(--text-muted); font-size:1.4rem; cursor:pointer;">✕</button>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(16,185,129,0.15); border: 2px solid var(--primary); color: var(--primary); font-size: 1.3rem; font-weight: 700; margin-bottom: 0.75rem;">
            ${(u.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <h3 style="font-size: 1.35rem; margin-bottom: 0.2rem;">${u.fullName}</h3>
          <div style="display:inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.6rem; border-radius: 20px; background: rgba(16,185,129,0.15); color: var(--primary); margin-top: 0.25rem;">
            ${u.role}
          </div>
        </div>

        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.5rem; font-size: 0.88rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">
            <span style="color:var(--text-muted);">Email</span>
            <span style="font-weight:600;">${u.email}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">
            <span style="color:var(--text-muted);">Phone</span>
            <span style="font-weight:600;">${u.phone || 'Not provided'}</span>
          </div>
          ${u.badgeId ? `
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">Driver Badge</span>
            <span style="font-weight:700; color:var(--primary);">${u.badgeId}</span>
          </div>
          ` : ''}
        </div>

        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${u.role === 'admin' ? `
            <button class="btn btn-primary" onclick="document.getElementById('auth-modal').style.display='none'; App.navigateTo('admin');" style="width:100%;">
              Open Admin Dashboard
            </button>
          ` : ''}
          ${u.role === 'driver' || u.role === 'admin' ? `
            <button class="btn btn-outline" onclick="document.getElementById('auth-modal').style.display='none'; App.navigateTo('driver');" style="width:100%;">
              Open Driver Cockpit
            </button>
          ` : ''}
          <button class="btn btn-outline" onclick="RoleAccess.signOut(); document.getElementById('auth-modal').style.display='none';" style="width:100%; color:#EF4444; border-color:rgba(239,68,68,0.4);">
            Sign Out
          </button>
        </div>
      </div>
    `;
  },

  // Legacy compatibility for any remaining calls
  showRoleModal() {
    this.handleAuthBtnClick();
  }
};
