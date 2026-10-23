// ==========================================================================
// E-BUS CONNECT UGANDA - BOOKING & DIGITAL BOARDING PASS
// Seat Selection, MTN/Airtel MoMo Payment Simulator, & QR Pass Generator
// ==========================================================================

const Booking = {
  selectedSeat: null,
  currentFare: 3000,
  occupiedSeats: ['1A', '2B', '3C', '4A', '5D', '6B', '8C'],

  init() {
    this.populateStopsDropdowns();
    this.renderSeatGrid();
    this.loadOccupiedSeats();
  },

  async loadOccupiedSeats() {
    const client = window.supabaseClient;
    if (!client) return;

    try {
      const { data, error } = await client
        .from('bookings')
        .select('seat')
        .eq('status', 'confirmed');

      if (!error && Array.isArray(data)) {
        const dbSeats = data.map(b => b.seat);
        this.occupiedSeats = Array.from(new Set([...this.occupiedSeats, ...dbSeats]));
        this.renderSeatGrid();
      }
    } catch (e) {
      console.warn('[Booking] Could not load occupied seats from Supabase:', e);
    }
  },

  populateStopsDropdowns() {
    const originSelect = document.getElementById('book-origin-select');
    const destSelect = document.getElementById('book-dest-select');
    if (!originSelect || !destSelect) return;

    const options = State.stops.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    originSelect.innerHTML = `<option value="">-- Choose Origin --</option>` + options;
    destSelect.innerHTML = `<option value="">-- Choose Destination --</option>` + options;

    // Default select
    originSelect.value = 'ST-01';
    destSelect.value = 'ST-06';
    this.updatePrice();
  },

  updatePrice() {
    const origin = document.getElementById('book-origin-select')?.value;
    const dest = document.getElementById('book-dest-select')?.value;
    
    // Estimate fare based on distance / route
    if (origin === 'ST-10' || dest === 'ST-10') {
      this.currentFare = 5000; // Entebbe Airport
    } else {
      this.currentFare = 3000;
    }

    const fareEl = document.getElementById('book-fare-display');
    if (fareEl) {
      fareEl.innerText = `UGX ${this.currentFare.toLocaleString()}`;
    }
  },

  renderSeatGrid() {
    const gridEl = document.getElementById('bus-seats-container');
    if (!gridEl) return;

    const rows = 8;
    const cols = ['A', 'B', 'C', 'D'];
    let html = '';

    for (let r = 1; r <= rows; r++) {
      cols.forEach((c, idx) => {
        const seatNum = `${r}${c}`;
        const isOccupied = this.occupiedSeats.includes(seatNum);
        const isSelected = this.selectedSeat === seatNum;
        const isPriority = r === 1; // Front row for elders / disabled

        html += `
          <div class="bus-seat ${isOccupied ? 'occupied' : ''} ${isSelected ? 'selected' : ''} ${isPriority ? 'priority' : ''}" 
               data-seat="${seatNum}"
               onclick="Booking.handleSeatClick('${seatNum}')">
            ${seatNum}
          </div>
        `;
      });
    }

    gridEl.innerHTML = html;
  },

  handleSeatClick(seatNum) {
    if (this.occupiedSeats.includes(seatNum)) {
      App.showToast('Seat Occupied', 'Please select another seat', 'warning');
      return;
    }

    this.selectedSeat = seatNum;
    this.renderSeatGrid();

    const selectedDisplay = document.getElementById('selected-seat-display');
    if (selectedDisplay) {
      selectedDisplay.innerText = seatNum;
    }
  },

  handleBookingSubmit(e) {
    e.preventDefault();

    if (!this.selectedSeat) {
      App.showToast('Pick a Seat', 'Please click on an available seat from the bus diagram', 'warning');
      return;
    }

    const originId = document.getElementById('book-origin-select').value;
    const destId = document.getElementById('book-dest-select').value;
    const passengerName = document.getElementById('passenger-name').value;
    const passengerPhone = document.getElementById('passenger-phone').value;
    const paymentMethod = document.querySelector('input[name="pay-method"]:checked')?.value || 'MTN MoMo';

    // Require authenticated account (Step B + Step C)
    if (!window.RoleAccess || !window.RoleAccess.isAuthenticated) {
      App.showToast('Sign In Required', 'Please sign in or create an account to book your seat.', 'warning');
      window.RoleAccess.showAuthModal('login', 'booking');
      return;
    }

    if (!originId || !destId || !passengerName || !passengerPhone) {
      App.showToast('Missing Info', 'Please fill in all booking fields', 'warning');
      return;
    }

    if (originId === destId) {
      App.showToast('Invalid Route', 'Origin and destination cannot be the same', 'warning');
      return;
    }

    const originStop = State.stops.find(s => s.id === originId);
    const destStop = State.stops.find(s => s.id === destId);

    // Open simulated payment authorization modal
    this.openPaymentModal({
      passengerName,
      passengerPhone,
      originName: originStop.name,
      originCode: originStop.code,
      destName: destStop.name,
      destCode: destStop.code,
      seat: this.selectedSeat,
      fare: this.currentFare,
      paymentMethod
    });
  },

  openPaymentModal(data) {
    this.pendingPaymentData = data;
    const modal = document.getElementById('momo-modal');
    if (!modal) return;

    document.getElementById('momo-modal-phone').innerText = data.passengerPhone;
    document.getElementById('momo-modal-amount').innerText = `UGX ${data.fare.toLocaleString()}`;
    document.getElementById('momo-modal-method').innerText = data.paymentMethod;
    document.getElementById('momo-pin-input').value = '';

    modal.classList.add('active');
  },

  closePaymentModal() {
    const modal = document.getElementById('momo-modal');
    if (modal) modal.classList.remove('active');
  },

  confirmPaymentSimulation() {
    const pin = document.getElementById('momo-pin-input').value;
    if (!pin || pin.length < 4) {
      App.showToast('Invalid PIN', 'Please enter a 4-digit demo PIN (e.g. 1234)', 'warning');
      return;
    }

    // Process payment and atomic database booking
    const btn = document.getElementById('confirm-pay-btn');
    btn.innerHTML = 'Authorizing & Securing Seat in Supabase...';
    btn.disabled = true;

    (async () => {
      try {
        let bookingId = 'UG-' + Math.floor(100000 + Math.random() * 900000);
        let vehicleName = 'Kayoola Electric EB-015';

        const client = window.supabaseClient;
        if (client && window.RoleAccess && window.RoleAccess.isAuthenticated) {
          const { data, error } = await client.rpc('book_seat_smart', {
            p_route: this.pendingPaymentData.routeId || 'R-01',
            p_bus: this.pendingPaymentData.busName || 'BUS 01',
            p_seat: this.pendingPaymentData.seat,
            p_origin: this.pendingPaymentData.originCode || 'ST-NTD',
            p_dest: this.pendingPaymentData.destCode || 'ST-CBD'
          });

          if (error) {
            throw new Error(error.message);
          }

          if (data && data.booking_id) {
            bookingId = data.booking_id;
            if (data.bus_name) vehicleName = data.bus_name;
          }
        }

        this.closePaymentModal();
        btn.innerHTML = 'Authorize Payment';
        btn.disabled = false;

        // Mark seat occupied
        this.occupiedSeats.push(this.pendingPaymentData.seat);
        const bookedSeat = this.pendingPaymentData.seat;
        this.selectedSeat = null;

        // Create confirmed ticket
        const ticket = {
          id: bookingId,
          passengerName: this.pendingPaymentData.passengerName,
          passengerPhone: this.pendingPaymentData.passengerPhone,
          originName: this.pendingPaymentData.originName,
          originCode: this.pendingPaymentData.originCode,
          destName: this.pendingPaymentData.destName,
          destCode: this.pendingPaymentData.destCode,
          seat: bookedSeat,
          fare: this.pendingPaymentData.fare,
          busName: vehicleName,
          departureTime: 'Today 17:30',
          paymentMethod: this.pendingPaymentData.paymentMethod,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Record payment in payments ledger (Task 5)
        const paymentRecord = {
          id: 'EB-PAY-' + Math.floor(1000 + Math.random() * 9000),
          reference: (this.pendingPaymentData.paymentMethod.includes('MTN') ? 'MOMO-UG-' : (this.pendingPaymentData.paymentMethod.includes('Airtel') ? 'AIRTEL-UG-' : 'CARD-UG-')) + Math.floor(100000 + Math.random() * 900000),
          route: `${this.pendingPaymentData.originName} → ${this.pendingPaymentData.destName}`,
          stop: this.pendingPaymentData.originName,
          busId: vehicleName,
          amount: this.pendingPaymentData.fare,
          currency: 'UGX',
          method: this.pendingPaymentData.paymentMethod,
          status: 'Completed',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          seats: 1
        };
        if (!State.payments) State.payments = [];
        State.payments.unshift(paymentRecord);
        localStorage.setItem('ebus_payments', JSON.stringify(State.payments));

        State.addBookedTicket(ticket);
        App.showToast('Seat Confirmed!', `Seat ${bookedSeat} atomic reservation verified by Supabase.`, 'success');

        this.renderSeatGrid();
        this.displayBoardingPass(ticket);
      } catch (err) {
        btn.innerHTML = 'Authorize Payment';
        btn.disabled = false;
        App.showToast('Booking Failed', err.message || 'Could not complete booking', 'error');
        // Refresh seats in case another passenger booked this seat
        await this.loadOccupiedSeats();
      }
    })();
  },

  displayBoardingPass(ticket) {
    const modal = document.getElementById('ticket-modal');
    const container = document.getElementById('ticket-modal-content');
    if (!modal || !container) return;

    container.innerHTML = `
      <div class="ticket-card" id="printable-ticket">
        <div class="ticket-header">
          <div class="brand">E-BUS CONNECT UGANDA</div>
          <span class="badge badge-electric">CONFIRMED PASS</span>
        </div>
        <div class="ticket-body">
          <div class="ticket-route">
            <div class="ticket-stop">
              <span class="ticket-stop-code">${ticket.originCode}</span>
              <span class="ticket-stop-name">${ticket.originName}</span>
            </div>
            <div style="color:#10B981; font-size:1.4rem;">➔</div>
            <div class="ticket-stop" style="text-align:right;">
              <span class="ticket-stop-code">${ticket.destCode}</span>
              <span class="ticket-stop-name">${ticket.destName}</span>
            </div>
          </div>

          <div class="ticket-divider"></div>

          <div class="ticket-details-grid">
            <div class="ticket-detail-item">
              <span class="ticket-label">Passenger</span>
              <span class="ticket-value">${ticket.passengerName}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Seat Number</span>
              <span class="ticket-value" style="color:#10B981; font-size:1.15rem;">${ticket.seat}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Assigned Vehicle</span>
              <span class="ticket-value">${ticket.busName}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Departure</span>
              <span class="ticket-value">${ticket.departureTime}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Ticket Reference</span>
              <span class="ticket-value">${ticket.id}</span>
            </div>
            <div class="ticket-detail-item">
              <span class="ticket-label">Fare Paid</span>
              <span class="ticket-value">UGX ${ticket.fare.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="ticket-qr-section">
          <!-- Scalable SVG QR Code Simulation -->
          <svg class="ticket-qr-code" viewBox="0 0 100 100" fill="#0F172A">
            <rect x="0" y="0" width="30" height="30" fill="#0F172A"/>
            <rect x="5" y="5" width="20" height="20" fill="#ffffff"/>
            <rect x="10" y="10" width="10" height="10" fill="#0F172A"/>
            
            <rect x="70" y="0" width="30" height="30" fill="#0F172A"/>
            <rect x="75" y="5" width="20" height="20" fill="#ffffff"/>
            <rect x="80" y="10" width="10" height="10" fill="#0F172A"/>
            
            <rect x="0" y="70" width="30" height="30" fill="#0F172A"/>
            <rect x="5" y="75" width="20" height="20" fill="#ffffff"/>
            <rect x="10" y="80" width="10" height="10" fill="#0F172A"/>
            
            <rect x="40" y="10" width="10" height="20"/>
            <rect x="55" y="5" width="10" height="10"/>
            <rect x="35" y="45" width="30" height="10"/>
            <rect x="70" y="40" width="10" height="25"/>
            <rect x="40" y="70" width="15" height="15"/>
            <rect x="65" y="75" width="25" height="15"/>
          </svg>
          <div style="font-size: 0.75rem; color: #64748B; text-align: center;">
            Present QR code to conductor's smart validator scanner upon boarding
          </div>
        </div>
      </div>
      <div style="display:flex; gap:1rem; justify-content:center; margin-top:1.5rem;">
        <button class="btn btn-primary" onclick="window.print()">Print Pass</button>
        <button class="btn btn-secondary" onclick="Booking.closeTicketModal()">Done</button>
      </div>
    `;

    modal.classList.add('active');
  },

  closeTicketModal() {
    const modal = document.getElementById('ticket-modal');
    if (modal) modal.classList.remove('active');
  }
};
