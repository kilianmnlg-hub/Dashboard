// Datenquelle für das Dashboard.
// timeTracker, business.bricksOnTheFloor/brainwalkers (Abos/Videos/lastUploadAt),
// goals[tiktok-follower].current, bricklinkOrders und bricklinkRevenue werden automatisch
// von scripts/sync-all.mjs überschrieben (täglich per GitHub Actions oder manuell über
// den Sync-Button im Dashboard bzw. "node scripts/sync-all.mjs").
// Alles andere (goals-Zieltexte, restliche business-Felder, uploadRhythmDays) von
// Hand pflegen. Siehe README.md für Details.

const DASHBOARD_DATA = {
  "meta": {
    "lastUpdated": "2026-08-03",
    "lastSyncedAt": "2026-08-03T16:08:55.418Z",
    "owner": "Kilian"
  },
  "github": {
    "owner": "kilianmnlg-hub",
    "repo": "Dashboard",
    "workflowFile": "sync-all.yml"
  },
  "goals": [
    {
      "id": "bricks-abos",
      "label": "Bricks On The Floor – Abonnenten",
      "project": "bricksOnTheFloor",
      "current": 28300,
      "target": 50000,
      "unit": "Abos",
      "due": "2026-12-31"
    },
    {
      "id": "bricks-umsatz",
      "label": "Bricks On The Floor – Umsatz/Monat",
      "project": "bricksOnTheFloor",
      "current": 473.5,
      "target": 1000,
      "unit": "€/Monat",
      "due": "2026-12-31"
    },
    {
      "id": "brainwalkers-abos",
      "label": "The Brainwalkers – Abonnenten",
      "project": "brainwalkers",
      "current": 230,
      "target": 1000,
      "unit": "Abos",
      "due": "2026-12-31"
    },
    {
      "id": "tiktok-follower",
      "label": "Bricks On The Floor – TikTok-Follower",
      "project": "tiktok",
      "current": 2706,
      "target": 10000,
      "unit": "Follower",
      "due": "2026-12-31"
    }
  ],
  "bricklinkOrders": {
    "checkedAt": "2026-08-03T16:08:55.122Z",
    "openOrdersCount": 253,
    "pendingShipments": []
  },
  "bricklinkRevenue": {
    "checkedAt": "2026-08-03T16:08:55.418Z",
    "currency": "EUR",
    "weekly": [
      {
        "weekStart": "2026-06-08",
        "total": 162.88,
        "orderCount": 5
      },
      {
        "weekStart": "2026-06-15",
        "total": 63.9,
        "orderCount": 3
      },
      {
        "weekStart": "2026-06-22",
        "total": 297.43,
        "orderCount": 5
      },
      {
        "weekStart": "2026-06-29",
        "total": 57.92,
        "orderCount": 2
      },
      {
        "weekStart": "2026-07-06",
        "total": 70.22,
        "orderCount": 4
      },
      {
        "weekStart": "2026-07-13",
        "total": 118.62,
        "orderCount": 4
      },
      {
        "weekStart": "2026-07-20",
        "total": 414.07,
        "orderCount": 8
      },
      {
        "weekStart": "2026-07-27",
        "total": 49.84,
        "orderCount": 2
      }
    ],
    "monthly": [
      {
        "month": "2026-02",
        "total": 182.98,
        "orderCount": 5
      },
      {
        "month": "2026-03",
        "total": 855.5,
        "orderCount": 24
      },
      {
        "month": "2026-04",
        "total": 770.35,
        "orderCount": 21
      },
      {
        "month": "2026-05",
        "total": 1043.82,
        "orderCount": 30
      },
      {
        "month": "2026-06",
        "total": 865.55,
        "orderCount": 22
      },
      {
        "month": "2026-07",
        "total": 701,
        "orderCount": 19
      }
    ]
  },
  "business": {
    "bricklink": {
      "title": "Bricklink Store",
      "subtitle": "BrxOnTheFloor · seit 15.04.2022 · Brandenburg",
      "accent": "bricklink",
      "stats": [
        {
          "label": "Feedback gesamt",
          "value": "91",
          "hint": "88 Verkäufer / 3 Käufer, nur Praise"
        },
        {
          "label": "Store-Besuche",
          "value": "38.669"
        },
        {
          "label": "Sendung ausstehend",
          "value": "1"
        },
        {
          "label": "Drive-Thru-Mail offen",
          "value": "41"
        },
        {
          "label": "Ohne Feedback",
          "value": "36"
        }
      ],
      "note": "Sortiment: Einzelteile & Minifiguren (neu/gebraucht). Geplant: komplette gebrauchte Sets."
    },
    "bricksOnTheFloor": {
      "title": "Bricks On The Floor",
      "subtitle": "LEGO-YouTube-Kanal · Hauptprojekt",
      "accent": "bricks",
      "uploadRhythmDays": 7,
      "lastUploadAt": "2026-08-02T15:55:27Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "28.300",
          "hint": "+397 letzte 28 Tage"
        },
        {
          "label": "Views (28 Tage)",
          "value": "223.633"
        },
        {
          "label": "Wiedergabezeit",
          "value": "8.227,1 Std."
        },
        {
          "label": "Umsatz (28 Tage)",
          "value": "473,50 €"
        }
      ],
      "note": "Rhythmus: wöchentlich angestrebt, reißt öfter ab, fängt sich aber immer wieder."
    },
    "brainwalkers": {
      "title": "The Brainwalkers",
      "subtitle": "Magic: The Gathering · Nebenprojekt",
      "accent": "brainwalkers",
      "uploadRhythmDays": 14,
      "lastUploadAt": "2026-07-29T13:55:39Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "230"
        },
        {
          "label": "Videos",
          "value": "55"
        },
        {
          "label": "Rhythmus",
          "value": "alle 2 Wochen"
        }
      ],
      "note": "Fokus: Commander/EDH-Decks & Produkt-Reviews. Kein Studio-Zugriff für Umsatzdaten."
    }
  },
  "timeTracker": {
    "source": "Notion – Zeittracker",
    "range": {
      "from": "2026-07-25",
      "to": "2026-08-03"
    },
    "totalsByCategory": {
      "YouTube": 2415.78,
      "Bricklink": 564.59
    },
    "daily": [
      {
        "date": "2026-07-25",
        "YouTube": 246.75,
        "Bricklink": 0
      },
      {
        "date": "2026-07-26",
        "YouTube": 155.56,
        "Bricklink": 100.71
      },
      {
        "date": "2026-07-27",
        "YouTube": 443.89,
        "Bricklink": 185.8
      },
      {
        "date": "2026-07-28",
        "YouTube": 359.29,
        "Bricklink": 0
      },
      {
        "date": "2026-07-29",
        "YouTube": 150,
        "Bricklink": 89.7
      },
      {
        "date": "2026-07-30",
        "YouTube": 238.79,
        "Bricklink": 15
      },
      {
        "date": "2026-07-31",
        "YouTube": 134.64,
        "Bricklink": 0
      },
      {
        "date": "2026-08-01",
        "YouTube": 183.78,
        "Bricklink": 0
      },
      {
        "date": "2026-08-02",
        "YouTube": 280.31,
        "Bricklink": 173.38
      },
      {
        "date": "2026-08-03",
        "YouTube": 222.77,
        "Bricklink": 0
      }
    ]
  }
};

if (typeof window !== "undefined") {
  window.DASHBOARD_DATA = DASHBOARD_DATA;
}
if (typeof module !== "undefined") {
  module.exports = DASHBOARD_DATA;
}
