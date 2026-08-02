// Datenquelle für das Dashboard. Von Hand pflegen oder per scripts/sync-all.mjs
// (Zeittracker, YouTube-Abos/Upload-Datum, Bricklink-Bestellungen/Umsatz) automatisch
// aktualisieren lassen. Siehe README.md für Details.

const DASHBOARD_DATA = {
  meta: {
    lastUpdated: "2026-08-02",
    lastSyncedAt: null,
    owner: "Kilian"
  },

  // Für den "Jetzt synchronisieren"-Button im Dashboard: einmalig ausfüllen,
  // sobald das GitHub-Repo existiert (siehe README, Abschnitt "Manueller Sync").
  github: {
    owner: "kilianmnlg-hub",
    repo: "Dashboard",
    workflowFile: "sync-all.yml"
  },

  goals: [
    {
      id: "bricks-abos",
      label: "Bricks On The Floor – Abonnenten",
      project: "bricksOnTheFloor",
      current: 28214,
      target: 50000,
      unit: "Abos",
      due: "2026-12-31"
    },
    {
      id: "bricks-umsatz",
      label: "Bricks On The Floor – Umsatz/Monat",
      project: "bricksOnTheFloor",
      current: 473.50,
      target: 1000,
      unit: "€/Monat",
      due: "2026-12-31"
    },
    {
      id: "brainwalkers-abos",
      label: "The Brainwalkers – Abonnenten",
      project: "brainwalkers",
      current: 209,
      target: 1000,
      unit: "Abos",
      due: "2026-12-31"
    },
    {
      id: "brainwalkers-monetarisierung",
      label: "The Brainwalkers – Monetarisierung",
      project: "brainwalkers",
      current: 0,
      target: 1,
      unit: "erreicht",
      due: "2026-12-31",
      isMilestone: true
    }
  ],

  // Wird von scripts/fetchers/bricklink.mjs überschrieben, sobald die Bricklink-API
  // eingerichtet ist (siehe README). checkedAt: null = noch nie automatisch geprüft.
  bricklinkOrders: {
    checkedAt: null,
    openOrdersCount: null,
    pendingShipments: []
  },

  // Wird von scripts/fetchers/bricklink.mjs überschrieben. weekly: [{weekStart, total, orderCount}].
  bricklinkRevenue: {
    checkedAt: null,
    currency: "EUR",
    weekly: []
  },

  business: {
    bricklink: {
      title: "Bricklink Store",
      subtitle: "BrxOnTheFloor · seit 15.04.2022 · Brandenburg",
      accent: "bricklink",
      stats: [
        { label: "Feedback gesamt", value: "91", hint: "88 Verkäufer / 3 Käufer, nur Praise" },
        { label: "Store-Besuche", value: "38.669" },
        { label: "Sendung ausstehend", value: "1" },
        { label: "Drive-Thru-Mail offen", value: "41" },
        { label: "Ohne Feedback", value: "36" }
      ],
      note: "Sortiment: Einzelteile & Minifiguren (neu/gebraucht). Geplant: komplette gebrauchte Sets."
    },
    bricksOnTheFloor: {
      title: "Bricks On The Floor",
      subtitle: "LEGO-YouTube-Kanal · Hauptprojekt",
      accent: "bricks",
      uploadRhythmDays: 7,
      lastUploadAt: null,
      stats: [
        { label: "Abonnenten", value: "28.214", hint: "+397 letzte 28 Tage" },
        { label: "Views (28 Tage)", value: "223.633" },
        { label: "Wiedergabezeit", value: "8.227,1 Std." },
        { label: "Umsatz (28 Tage)", value: "473,50 €" }
      ],
      note: "Rhythmus: wöchentlich angestrebt, reißt öfter ab, fängt sich aber immer wieder."
    },
    brainwalkers: {
      title: "The Brainwalkers",
      subtitle: "Magic: The Gathering · Nebenprojekt",
      accent: "brainwalkers",
      uploadRhythmDays: 14,
      lastUploadAt: null,
      stats: [
        { label: "Abonnenten", value: "209" },
        { label: "Videos", value: "49" },
        { label: "Rhythmus", value: "alle 2 Wochen" }
      ],
      note: "Fokus: Commander/EDH-Decks & Produkt-Reviews. Kein Studio-Zugriff für Umsatzdaten."
    }
  },

  timeTracker: {
    source: "Notion – Zeittracker",
    range: { from: "2026-07-25", to: "2026-08-02" },
    totalsByCategory: {
      YouTube: 2193.01,
      Bricklink: 564.59
    },
    daily: [
      { date: "2026-07-25", YouTube: 246.75, Bricklink: 0 },
      { date: "2026-07-26", YouTube: 155.56, Bricklink: 100.71 },
      { date: "2026-07-27", YouTube: 443.89, Bricklink: 185.80 },
      { date: "2026-07-28", YouTube: 359.29, Bricklink: 0 },
      { date: "2026-07-29", YouTube: 150.00, Bricklink: 89.70 },
      { date: "2026-07-30", YouTube: 238.79, Bricklink: 15.00 },
      { date: "2026-07-31", YouTube: 134.64, Bricklink: 0 },
      { date: "2026-08-01", YouTube: 183.78, Bricklink: 0 },
      { date: "2026-08-02", YouTube: 280.31, Bricklink: 173.38 }
    ]
  }
};

if (typeof window !== "undefined") {
  window.DASHBOARD_DATA = DASHBOARD_DATA;
}
if (typeof module !== "undefined") {
  module.exports = DASHBOARD_DATA;
}
