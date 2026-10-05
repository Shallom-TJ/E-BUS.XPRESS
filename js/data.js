// ==========================================================================
// E-BUS CONNECT UGANDA - TRANSIT DATA REPOSITORY
// Realistic Kampala Metropolitan Electric Bus Corridors & Fleet Telematics
// ==========================================================================

const EBUS_DATA = {
  appName: "E-Bus Connect Uganda",
  currency: "UGX",
  country: "Uganda",
  depotCoordinates: [0.3476, 32.5825], // Central Kampala

// Corridors & Routes
  routes: [
    {
      id: "R-01",
      name: "Line 01: Ntinda ⇄ Bukoto ⇄ Kisementi ⇄ City Centre",
      shortName: "Ntinda → City Centre",
      color: "#10B981",
      badge: "High Frequency",
      fare: 2500,
      estimatedMinutes: 24,
      frequency: "Every 8 mins",
      firstBus: "05:30",
      lastBus: "23:00",
      description: "Direct urban electric line serving Ntinda, Bukoto Market, Kisementi Shopping Hub, and City Centre.",
      stops: ["ST-NTD", "ST-BKT", "ST-KSM", "ST-CBD"],
      coordinates: [
        [0.3556, 32.6120], // Ntinda
        [0.3510, 32.5990], // Bukoto
        [0.3340, 32.5860], // Kisementi
        [0.3136, 32.5811]  // City Centre
      ]
    },
    {
      id: "R-02",
      name: "Line 02: Chanja ⇄ Kyanja ⇄ Bukoto ⇄ City Centre",
      shortName: "Chanja → City Centre",
      color: "#06B6D4",
      badge: "Suburban Express",
      fare: 3000,
      estimatedMinutes: 32,
      frequency: "Every 12 mins",
      firstBus: "05:45",
      lastBus: "22:30",
      description: "Northern suburban corridor from Chanja and Kyanja via Bukoto to Kampala City Centre.",
      stops: ["ST-CHJ", "ST-KYJ", "ST-BKT", "ST-KSM", "ST-CBD"],
      coordinates: [
        [0.4050, 32.5950], // Chanja
        [0.3850, 32.6070], // Kyanja
        [0.3510, 32.5990], // Bukoto
        [0.3340, 32.5860], // Kisementi
        [0.3136, 32.5811]  // City Centre
      ]
    },
    {
      id: "R-03",
      name: "Line 03: Nakawa ⇄ Banda ⇄ Kireka ⇄ Mukono",
      shortName: "Nakawa → Mukono Trunk",
      color: "#F59E0B",
      badge: "Heavy Passenger Load",
      fare: 3000,
      estimatedMinutes: 40,
      frequency: "Every 10 mins",
      firstBus: "05:30",
      lastBus: "22:00",
      description: "Arterial eastern route linking Nakawa Spear Motors, Banda Kyambogo gate, and Mukono.",
      stops: ["ST-CBD", "ST-NKW", "ST-BND", "ST-KRK", "ST-MKN"],
      coordinates: [
        [0.3136, 32.5811],
        [0.3298, 32.6178],
        [0.3503, 32.6318],
        [0.3475, 32.6508],
        [0.3533, 32.7533]
      ]
    },
    {
      id: "R-04",
      name: "Line 04: Kampala CBD ⇄ Entebbe Airport Express",
      shortName: "Entebbe Express",
      color: "#8B5CF6",
      badge: "Airport Expressway",
      fare: 5000,
      estimatedMinutes: 35,
      frequency: "Every 15 mins",
      firstBus: "05:00",
      lastBus: "23:30",
      description: "Non-stop express connection via Kampala-Entebbe Expressway.",
      stops: ["ST-CBD", "ST-KBY", "ST-KJJ", "ST-EBB"],
      coordinates: [
        [0.3136, 32.5811],
        [0.2885, 32.5695],
        [0.2185, 32.5385],
        [0.0424, 32.4435]
      ]
    }
  ],

  // Designated Electric Bus Stops (Realistic Kampala Locations)
  stops: [
    {
      id: "ST-NTD",
      name: "Ntinda Bus Stop (Ntinda Complex)",
      shortName: "Ntinda",
      code: "NTD",
      zone: "Nakawa Division",
      lat: 0.3556,
      lng: 32.6120,
      amenities: ["Solar Shelter", "Digital ETA Board", "USB Charging"],
      routes: ["R-01"],
      waitingPassengers: 4
    },
    {
      id: "ST-BKT",
      name: "Bukoto Bus Stop (Bukoto Market)",
      shortName: "Bukoto",
      code: "BKT",
      zone: "Kawempe / Nakawa",
      lat: 0.3510,
      lng: 32.5990,
      amenities: ["Solar Shelter", "CCTV"],
      routes: ["R-01", "R-02"],
      waitingPassengers: 7
    },
    {
      id: "ST-KSM",
      name: "Kisementi Bus Stop (Kamwokya Hub)",
      shortName: "Kisementi",
      code: "KSM",
      zone: "Central Division",
      lat: 0.3340,
      lng: 32.5860,
      amenities: ["Solar Canopy", "Wheelchair Ramp"],
      routes: ["R-01", "R-02"],
      waitingPassengers: 5
    },
    {
      id: "ST-CBD",
      name: "City Centre (Pioneer Mall / City Square)",
      shortName: "City Centre",
      code: "CBD",
      zone: "Central Kampala",
      lat: 0.3136,
      lng: 32.5811,
      amenities: ["Main Transit Hub", "Customer Care Kiosk", "EV Fast Depot"],
      routes: ["R-01", "R-02", "R-03", "R-04"],
      waitingPassengers: 14
    },
    {
      id: "ST-NKW",
      name: "Nakawa Stage (Spear Motors Junction)",
      shortName: "Nakawa",
      code: "NKW",
      zone: "Nakawa Division",
      lat: 0.3298,
      lng: 32.6178,
      amenities: ["Solar Shelter", "Digital Display"],
      routes: ["R-03"],
      waitingPassengers: 9
    },
    {
      id: "ST-BND",
      name: "Banda Stage (Kyambogo Main Gate)",
      shortName: "Banda",
      code: "BND",
      zone: "Banda",
      lat: 0.3503,
      lng: 32.6318,
      amenities: ["Student Pass Validator", "Solar Lighting"],
      routes: ["R-03"],
      waitingPassengers: 19
    },
    {
      id: "ST-KYJ",
      name: "Kyanja Bus Stop (Kyanja Trading Centre)",
      shortName: "Kyanja",
      code: "KYJ",
      zone: "Nakawa North",
      lat: 0.3850,
      lng: 32.6070,
      amenities: ["Solar Shelter"],
      routes: ["R-02"],
      waitingPassengers: 3
    },
    {
      id: "ST-CHJ",
      name: "Chanja Bus Stop (Chanja Terminal)",
      shortName: "Chanja",
      code: "CHJ",
      zone: "Greater Kampala",
      lat: 0.4050,
      lng: 32.5950,
      amenities: ["Suburban Terminal", "Solar Canopy"],
      routes: ["R-02"],
      waitingPassengers: 6
    },
    {
      id: "ST-KRK",
      name: "Kireka Trading Stage",
      shortName: "Kireka",
      code: "KRK",
      zone: "Kireka",
      lat: 0.3475,
      lng: 32.6508,
      amenities: ["Shelter"],
      routes: ["R-03"],
      waitingPassengers: 8
    },
    {
      id: "ST-MKN",
      name: "Mukono Central Terminal",
      shortName: "Mukono",
      code: "MKN",
      zone: "Mukono",
      lat: 0.3533,
      lng: 32.7533,
      amenities: ["Depot Bay"],
      routes: ["R-03"],
      waitingPassengers: 12
    },
    {
      id: "ST-KBY",
      name: "Kibuye Roundabout",
      shortName: "Kibuye",
      code: "KBY",
      zone: "Makindye",
      lat: 0.2885,
      lng: 32.5695,
      amenities: ["Shelter"],
      routes: ["R-04"],
      waitingPassengers: 4
    },
    {
      id: "ST-KJJ",
      name: "Kajjansi Expressway Toll Interchange",
      shortName: "Kajjansi",
      code: "KJJ",
      zone: "Wakiso",
      lat: 0.2185,
      lng: 32.5385,
      amenities: ["Express Shelter"],
      routes: ["R-04"],
      waitingPassengers: 2
    },
    {
      id: "ST-EBB",
      name: "Entebbe International Airport",
      shortName: "Entebbe Airport",
      code: "EBB",
      zone: "Entebbe",
      lat: 0.0424,
      lng: 32.4435,
      amenities: ["Airport Terminal", "Luggage Concierge"],
      routes: ["R-04"],
      waitingPassengers: 16
    }
  ],

  // Electric Bus Fleet Telematics (Simulated Demo Fleet)
  fleet: [
    {
      id: "BUS 04",
      name: "BUS 04",
      displayNumber: "BUS 04",
      plateNumber: "UBZ 456G",
      model: "Kiira Kayoola EVS (12m Electric)",
      routeId: "R-01",
      routeName: "Ntinda → City Centre",
      status: "in-service", // in-service, charging, idle, maintenance
      scheduleStatus: "On Time", // On Time, Delayed, Out of Service
      speedKmH: 35,
      batteryPercent: 88,
      rangeRemainingKm: 230,
      passengerCount: 26,
      capacity: 45,
      driverName: "Kato Denis",
      driverBadge: "UG-DRV-042",
      startLocation: "Ntinda",
      currentLocationName: "Near Ntinda",
      nextStopId: "ST-KSM",
      nextStopName: "Kisementi",
      etaMinutes: 8,
      distanceKm: 2.4,
      lat: 0.3540,
      lng: 32.6080,
      direction: "outbound"
    },
    {
      id: "BUS 01",
      name: "BUS 01",
      displayNumber: "BUS 01",
      plateNumber: "UBZ 102M",
      model: "Kiira Kayoola EVS (12m Electric)",
      routeId: "R-01",
      routeName: "Ntinda → Bukoto → Kisementi → City Centre",
      status: "in-service",
      scheduleStatus: "On Time",
      speedKmH: 42,
      batteryPercent: 92,
      rangeRemainingKm: 245,
      passengerCount: 31,
      capacity: 45,
      driverName: "Nabirye Sarah",
      driverBadge: "UG-DRV-019",
      startLocation: "Ntinda",
      currentLocationName: "Near Bukoto Market",
      nextStopId: "ST-KSM",
      nextStopName: "Kisementi",
      etaMinutes: 4,
      distanceKm: 1.2,
      lat: 0.3450,
      lng: 32.5920,
      direction: "outbound"
    },
    {
      id: "BUS 02",
      name: "BUS 02",
      displayNumber: "BUS 02",
      plateNumber: "UBZ 782K",
      model: "Kiira Kayoola Coach (10.5m)",
      routeId: "R-02",
      routeName: "Chanja → City Centre",
      status: "in-service",
      scheduleStatus: "Delayed",
      speedKmH: 22,
      batteryPercent: 71,
      rangeRemainingKm: 185,
      passengerCount: 38,
      capacity: 38,
      driverName: "Mugisha Robert",
      driverBadge: "UG-DRV-033",
      startLocation: "Chanja",
      currentLocationName: "Near Kyanja Junction",
      nextStopId: "ST-BKT",
      nextStopName: "Bukoto",
      etaMinutes: 14,
      distanceKm: 4.8,
      lat: 0.3750,
      lng: 32.6020,
      direction: "outbound"
    },
    {
      id: "BUS 07",
      name: "BUS 07",
      displayNumber: "BUS 07",
      plateNumber: "UCA 552X",
      model: "Kiira Kayoola EVS (12m Electric)",
      routeId: "R-03",
      routeName: "Nakawa → Mukono Trunk",
      status: "in-service",
      scheduleStatus: "On Time",
      speedKmH: 38,
      batteryPercent: 80,
      rangeRemainingKm: 210,
      passengerCount: 22,
      capacity: 45,
      driverName: "Okello Moses",
      driverBadge: "UG-DRV-087",
      startLocation: "Nakawa",
      currentLocationName: "Near Banda Stage",
      nextStopId: "ST-KRK",
      nextStopName: "Kireka Trading Stage",
      etaMinutes: 6,
      distanceKm: 2.1,
      lat: 0.3490,
      lng: 32.6420,
      direction: "outbound"
    },
    {
      id: "BUS 09",
      name: "BUS 09",
      displayNumber: "BUS 09",
      plateNumber: "UBZ 990P",
      model: "Kiira Kayoola EVS (12m Electric)",
      routeId: "R-01",
      routeName: "Ntinda → City Centre",
      status: "charging",
      scheduleStatus: "Out of Service",
      speedKmH: 0,
      batteryPercent: 35,
      rangeRemainingKm: 85,
      passengerCount: 0,
      capacity: 45,
      driverName: "Depot Technical Crew",
      driverBadge: "DEP-004",
      startLocation: "City Centre",
      currentLocationName: "City Centre EV Fast Depot",
      nextStopId: "None",
      nextStopName: "Charging Hub",
      etaMinutes: 0,
      distanceKm: 0,
      lat: 0.3140,
      lng: 32.5820,
      direction: "depot"
    }
  ],

  // Haversine Distance Formula between coordinates (km)
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round((R * c) * 10) / 10;
  },

  // Live Alerts & Notifications (Section 16 — Info / Warning / Urgent levels)
  alerts: [
    {
      id: "ALT-URGENT-01",
      type: "urgent",
      level: "urgent",
      title: "Service Interruption — Route 02",
      message: "Route 02 (Chanja to City Centre) has a temporary service interruption near Kyanja due to road works. Buses are diverted via Bukoto Market. Expect delays of 8-12 minutes.",
      timestamp: "2 mins ago"
    },
    {
      id: "ALT-WARN-01",
      type: "warning",
      level: "warning",
      title: "Bus 04 is Currently Delayed",
      message: "Bus 04 (Ntinda to City Centre) is running approximately 7 minutes behind schedule due to heavy traffic at Nakawa junction. Passengers at Bukoto and Kisementi should expect a later arrival.",
      timestamp: "5 mins ago"
    },
    {
      id: "ALT-INFO-01",
      type: "info",
      level: "info",
      title: "Bus 01 is Approaching Kisementi",
      message: "Bus 01 (Ntinda to City Centre) is approaching Kisementi Bus Stop. Estimated arrival in approximately 4 minutes. Please proceed to the designated boarding area.",
      timestamp: "8 mins ago"
    },
    {
      id: "ALT-INFO-02",
      type: "info",
      level: "info",
      title: "Your Selected Bus is Approximately 5 Minutes Away",
      message: "Your selected bus (BUS 04) is approximately 5 minutes from your current location at Chanja. Prepare to proceed to Kyanja Bus Stop for boarding.",
      timestamp: "10 mins ago"
    },
    {
      id: "ALT-SERVICE-01",
      type: "service",
      level: "info",
      title: "Clean Energy Milestone: 15,000 Commuters",
      message: "Kampala metropolitan electric buses have offset over 12.4 tonnes of CO2 this week alone! Thank you for choosing clean transport.",
      timestamp: "25 mins ago"
    },
    {
      id: "ALT-WARN-02",
      type: "warning",
      level: "warning",
      title: "Nakawa Junction — Heavy Traffic",
      message: "Buses on Line 03 (Nakawa to Mukono) are experiencing a 5-minute delay near Spear Motors due to ongoing road maintenance. Passengers are advised to plan accordingly.",
      timestamp: "30 mins ago"
    },
    {
      id: "ALT-INFO-03",
      type: "info",
      level: "info",
      title: "New Charging Hub Active at Bweyogerere",
      message: "A new 150kW DC fast charging hub at Bweyogerere Depot is now operational, reducing bus downtime by 35% and improving fleet reliability on all routes.",
      timestamp: "1 hour ago"
    }
  ],

  // Demo Payment Records & Ledger (Task 5)
  payments: [
    {
      id: "EB-PAY-9821",
      reference: "MOMO-UG-982104",
      route: "Line 01: Ntinda → City Centre",
      stop: "Ntinda Stage",
      busId: "EB-004",
      amount: 2500,
      currency: "UGX",
      method: "MTN Mobile Money",
      status: "Completed",
      date: "26 Sep 2026, 14:30",
      seats: 1
    },
    {
      id: "EB-PAY-9412",
      reference: "AIRTEL-UG-941255",
      route: "Line 02: Chanja → City Centre",
      stop: "Chanja Terminal",
      busId: "EB-002",
      amount: 3000,
      currency: "UGX",
      method: "Airtel Money",
      status: "Completed",
      date: "26 Sep 2026, 11:15",
      seats: 1
    },
    {
      id: "EB-PAY-8902",
      reference: "NFC-KC-890211",
      route: "Line 04: Kampala CBD → Entebbe Express",
      stop: "City Centre (CBD)",
      busId: "EB-012",
      amount: 5000,
      currency: "UGX",
      method: "KaCyber Transit Card",
      status: "Completed",
      date: "25 Sep 2026, 17:45",
      seats: 2
    },
    {
      id: "EB-PAY-8120",
      reference: "MOMO-UG-812033",
      route: "Line 03: Nakawa → Mukono Trunk",
      stop: "Nakawa Stage",
      busId: "EB-007",
      amount: 3000,
      currency: "UGX",
      method: "MTN Mobile Money",
      status: "Completed",
      date: "24 Sep 2026, 08:20",
      seats: 1
    },
    {
      id: "EB-PAY-7741",
      reference: "CARD-VS-774190",
      route: "Line 01: Bukoto → City Centre",
      stop: "Bukoto Market",
      busId: "EB-001",
      amount: 2500,
      currency: "UGX",
      method: "Visa Card (Demo)",
      status: "Refunded",
      date: "23 Sep 2026, 16:10",
      seats: 1
    }
  ]
};
