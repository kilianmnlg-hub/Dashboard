// Datenquelle für das Dashboard.
// timeTracker, business.bricksOnTheFloor/brainwalkers (Abos/Videos/lastUploadAt),
// goals[tiktok-follower].current, bricklinkOrders, bricklinkRevenue und metricsHistory
// (für die Wochenvergleich-Trendpfeile) werden automatisch von scripts/sync-all.mjs
// überschrieben (täglich per GitHub Actions oder manuell über den Sync-Button im
// Dashboard bzw. "node scripts/sync-all.mjs").
// Alles andere (goals-Zieltexte, restliche business-Felder, uploadRhythmDays) von
// Hand pflegen. Siehe README.md für Details.

const DASHBOARD_DATA = {
  "meta": {
    "lastUpdated": "2026-08-11",
    "lastSyncedAt": "2026-08-11T10:14:42.506Z",
    "owner": "Kilian"
  },
  "github": {
    "owner": "kilianmnlg-hub",
    "repo": "Dashboard",
    "workflowFile": "sync-all.yml"
  },
  "brainMap": {
    "syncedAt": "2026-08-06T15:18:53.030Z",
    "vaultName": "Kilian Obsidian",
    "areas": [
      {
        "id": "bricklink",
        "folder": "Bricklink",
        "noteCount": 1,
        "color": "var(--accent-bricklink)"
      },
      {
        "id": "botf",
        "folder": "Bricks On The Floor",
        "noteCount": 1,
        "color": "var(--accent-bricks)"
      },
      {
        "id": "ideen",
        "folder": "Ideen",
        "noteCount": 2,
        "color": "var(--accent-tiktok)"
      },
      {
        "id": "laden",
        "folder": "Laden",
        "noteCount": 1,
        "color": "var(--node-laden)"
      },
      {
        "id": "privat",
        "folder": "Privat",
        "noteCount": 1,
        "color": "var(--node-privat)"
      },
      {
        "id": "brainwalkers",
        "folder": "The Brainwalkers",
        "noteCount": 1,
        "color": "var(--accent-brainwalkers)"
      }
    ]
  },
  "notes": [
    {
      "date": "2026-08-05T22:31:00",
      "category": "Ideen",
      "text": "Bodycam for YouTube"
    },
    {
      "date": "2026-08-05T22:29:00",
      "category": "Ideen",
      "text": "Bodycam for Youtube"
    }
  ],
  "metricsHistory": {
    "bricksOnTheFloorAbos": [
      {
        "date": "2026-08-04",
        "value": 28300
      },
      {
        "date": "2026-08-05",
        "value": 28300
      },
      {
        "date": "2026-08-06",
        "value": 28300
      },
      {
        "date": "2026-08-07",
        "value": 28300
      },
      {
        "date": "2026-08-08",
        "value": 28400
      },
      {
        "date": "2026-08-09",
        "value": 28400
      },
      {
        "date": "2026-08-10",
        "value": 28400
      },
      {
        "date": "2026-08-11",
        "value": 28400
      }
    ],
    "brainwalkersAbos": [
      {
        "date": "2026-08-04",
        "value": 240
      },
      {
        "date": "2026-08-05",
        "value": 253
      },
      {
        "date": "2026-08-06",
        "value": 253
      },
      {
        "date": "2026-08-07",
        "value": 253
      },
      {
        "date": "2026-08-08",
        "value": 254
      },
      {
        "date": "2026-08-09",
        "value": 254
      },
      {
        "date": "2026-08-10",
        "value": 257
      },
      {
        "date": "2026-08-11",
        "value": 257
      }
    ],
    "tiktokFollower": [
      {
        "date": "2026-08-04",
        "value": 2707
      },
      {
        "date": "2026-08-05",
        "value": 2710
      },
      {
        "date": "2026-08-06",
        "value": 2712
      },
      {
        "date": "2026-08-07",
        "value": 2713
      },
      {
        "date": "2026-08-08",
        "value": 2713
      },
      {
        "date": "2026-08-09",
        "value": 2717
      },
      {
        "date": "2026-08-10",
        "value": 2718
      },
      {
        "date": "2026-08-11",
        "value": 2720
      }
    ]
  },
  "goals": [
    {
      "id": "bricks-abos",
      "label": "Bricks On The Floor – Abonnenten",
      "project": "bricksOnTheFloor",
      "current": 28400,
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
      "current": 257,
      "target": 1000,
      "unit": "Abos",
      "due": "2026-12-31"
    },
    {
      "id": "tiktok-follower",
      "label": "Bricks On The Floor – TikTok-Follower",
      "project": "tiktok",
      "current": 2720,
      "target": 10000,
      "unit": "Follower",
      "due": "2026-12-31"
    }
  ],
  "bricklinkOrders": {
    "checkedAt": "2026-08-11T10:14:42.394Z",
    "openOrdersCount": 259,
    "pendingShipments": [
      {
        "orderId": 32256607,
        "buyer": "davisito",
        "status": "PAID",
        "orderedDate": "2026-08-05T12:33:27.917Z",
        "total": "23.7725",
        "currency": "EUR"
      }
    ]
  },
  "bricklinkRevenue": {
    "checkedAt": "2026-08-11T10:14:42.505Z",
    "currency": "EUR",
    "weekly": [
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
      },
      {
        "weekStart": "2026-08-03",
        "total": 497.95,
        "orderCount": 6
      }
    ],
    "monthly": [
      {
        "month": "2026-02",
        "total": 153.74,
        "orderCount": 4
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
      },
      {
        "month": "2026-08",
        "total": 497.95,
        "orderCount": 6
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
      "lastUploadAt": "2026-08-09T13:55:13Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "28.400",
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
          "value": "257"
        },
        {
          "label": "Videos",
          "value": "59"
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
      "to": "2026-08-10"
    },
    "totalsByCategory": {
      "YouTube": 3643.73,
      "Bricklink": 854.86
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
        "YouTube": 273.2,
        "Bricklink": 90.04
      },
      {
        "date": "2026-08-04",
        "YouTube": 108.98,
        "Bricklink": 41.16
      },
      {
        "date": "2026-08-05",
        "YouTube": 194.69,
        "Bricklink": 25
      },
      {
        "date": "2026-08-06",
        "YouTube": 150,
        "Bricklink": 76.04
      },
      {
        "date": "2026-08-07",
        "YouTube": 60,
        "Bricklink": 0
      },
      {
        "date": "2026-08-08",
        "YouTube": 273.99,
        "Bricklink": 0
      },
      {
        "date": "2026-08-09",
        "YouTube": 157.5,
        "Bricklink": 0
      },
      {
        "date": "2026-08-10",
        "YouTube": 232.36,
        "Bricklink": 58.03
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
