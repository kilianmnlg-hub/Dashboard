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
    "lastUpdated": "2026-08-26",
    "lastSyncedAt": "2026-08-26T07:17:57.321Z",
    "owner": "Kilian"
  },
  "github": {
    "owner": "kilianmnlg-hub",
    "repo": "Dashboard",
    "workflowFile": "sync-all.yml"
  },
  "brainMap": {
    "syncedAt": "2026-08-25T06:07:03.883Z",
    "vaultName": "Kilian Obsidian",
    "areas": [
      {
        "id": "bricklink",
        "folder": "Bricklink",
        "noteCount": 2,
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
      "date": "2026-08-18T11:43:00",
      "category": "Ideen",
      "text": "Habittracker verbessern"
    },
    {
      "date": "2026-08-18T11:43:00",
      "category": "Ideen",
      "text": "Habittracker verbessern"
    },
    {
      "date": "2026-08-07T08:45:00",
      "category": "Bricklink",
      "text": "100k Artikel auf Bricklink als Ziel für dieses Jahr"
    },
    {
      "date": "2026-08-07T08:42:00",
      "category": "Ideen",
      "text": "52 Bricks Vids und 26 Brain Vids in Ziele"
    },
    {
      "date": "2026-08-07T08:41:00",
      "category": "Ideen",
      "text": "Calendar ins Dashboard"
    },
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
      },
      {
        "date": "2026-08-12",
        "value": 28400
      },
      {
        "date": "2026-08-13",
        "value": 28400
      },
      {
        "date": "2026-08-14",
        "value": 28400
      },
      {
        "date": "2026-08-15",
        "value": 28500
      },
      {
        "date": "2026-08-16",
        "value": 28500
      },
      {
        "date": "2026-08-17",
        "value": 28500
      },
      {
        "date": "2026-08-18",
        "value": 28500
      },
      {
        "date": "2026-08-19",
        "value": 28600
      },
      {
        "date": "2026-08-20",
        "value": 28600
      },
      {
        "date": "2026-08-21",
        "value": 28600
      },
      {
        "date": "2026-08-22",
        "value": 28700
      },
      {
        "date": "2026-08-23",
        "value": 28700
      },
      {
        "date": "2026-08-24",
        "value": 28700
      },
      {
        "date": "2026-08-25",
        "value": 28800
      },
      {
        "date": "2026-08-26",
        "value": 28800
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
      },
      {
        "date": "2026-08-12",
        "value": 258
      },
      {
        "date": "2026-08-13",
        "value": 259
      },
      {
        "date": "2026-08-14",
        "value": 261
      },
      {
        "date": "2026-08-15",
        "value": 265
      },
      {
        "date": "2026-08-16",
        "value": 267
      },
      {
        "date": "2026-08-17",
        "value": 268
      },
      {
        "date": "2026-08-18",
        "value": 271
      },
      {
        "date": "2026-08-19",
        "value": 310
      },
      {
        "date": "2026-08-20",
        "value": 322
      },
      {
        "date": "2026-08-21",
        "value": 332
      },
      {
        "date": "2026-08-22",
        "value": 337
      },
      {
        "date": "2026-08-23",
        "value": 346
      },
      {
        "date": "2026-08-24",
        "value": 354
      },
      {
        "date": "2026-08-25",
        "value": 361
      },
      {
        "date": "2026-08-26",
        "value": 367
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
      },
      {
        "date": "2026-08-12",
        "value": 2725
      },
      {
        "date": "2026-08-13",
        "value": 2725
      },
      {
        "date": "2026-08-14",
        "value": 2727
      },
      {
        "date": "2026-08-15",
        "value": 2725
      },
      {
        "date": "2026-08-16",
        "value": 2725
      },
      {
        "date": "2026-08-17",
        "value": 2726
      },
      {
        "date": "2026-08-18",
        "value": 2728
      },
      {
        "date": "2026-08-19",
        "value": 2730
      },
      {
        "date": "2026-08-20",
        "value": 2731
      },
      {
        "date": "2026-08-21",
        "value": 2734
      },
      {
        "date": "2026-08-22",
        "value": 2736
      },
      {
        "date": "2026-08-23",
        "value": 2735
      },
      {
        "date": "2026-08-24",
        "value": 2736
      },
      {
        "date": "2026-08-25",
        "value": 2735
      },
      {
        "date": "2026-08-26",
        "value": 2739
      }
    ]
  },
  "goals": [
    {
      "id": "bricks-abos",
      "label": "Bricks On The Floor – Abonnenten",
      "project": "bricksOnTheFloor",
      "current": 28800,
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
      "current": 367,
      "target": 1000,
      "unit": "Abos",
      "due": "2026-12-31"
    },
    {
      "id": "tiktok-follower",
      "label": "Bricks On The Floor – TikTok-Follower",
      "project": "tiktok",
      "current": 2739,
      "target": 10000,
      "unit": "Follower",
      "due": "2026-12-31"
    },
    {
      "id": "bricklink-parts",
      "label": "Bricklink – Teile verkauft",
      "project": "bricklink",
      "current": 72550,
      "target": 100000,
      "unit": "Teile",
      "due": "2026-12-31"
    },
    {
      "id": "bricks-longform-2026",
      "label": "Bricks On The Floor – Longform-Videos 2026",
      "project": "bricksOnTheFloor",
      "current": 23,
      "target": 52,
      "unit": "Videos",
      "due": "2026-12-31"
    },
    {
      "id": "brainwalkers-longform-2026",
      "label": "The Brainwalkers – Longform-Videos 2026",
      "project": "brainwalkers",
      "current": 8,
      "target": 26,
      "unit": "Videos",
      "due": "2026-12-31"
    }
  ],
  "bricklinkOrders": {
    "checkedAt": "2026-08-26T07:17:55.957Z",
    "openOrdersCount": 269,
    "pendingShipments": [
      {
        "orderId": 32406842,
        "buyer": "Merlin888",
        "status": "PAID",
        "orderedDate": "2026-08-24T10:33:02.077Z",
        "total": "22.0950",
        "currency": "EUR"
      },
      {
        "orderId": 32415059,
        "buyer": "brickpoint51",
        "status": "PAID",
        "orderedDate": "2026-08-25T10:22:56.590Z",
        "total": "67.4460",
        "currency": "EUR"
      }
    ]
  },
  "bricklinkRevenue": {
    "checkedAt": "2026-08-26T07:17:56.200Z",
    "currency": "EUR",
    "weekly": [
      {
        "weekStart": "2026-06-29",
        "total": 48.25,
        "orderCount": 1
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
      },
      {
        "weekStart": "2026-08-10",
        "total": 13.22,
        "orderCount": 1
      },
      {
        "weekStart": "2026-08-17",
        "total": 205.25,
        "orderCount": 4
      },
      {
        "weekStart": "2026-08-24",
        "total": 228.26,
        "orderCount": 3
      }
    ],
    "monthly": [
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
        "total": 944.68,
        "orderCount": 14
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
      "lastUploadAt": "2026-08-24T13:55:04Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "28.800",
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
      "lastUploadAt": "2026-08-12T14:05:01Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "367"
        },
        {
          "label": "Videos",
          "value": "64"
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
      "to": "2026-08-25"
    },
    "totalsByCategory": {
      "YouTube": 40310.14,
      "Bricklink": 1352.85
    },
    "daily": [
      {
        "date": "2026-07-25",
        "YouTube": 33074.91,
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
        "YouTube": 382.36,
        "Bricklink": 58.03
      },
      {
        "date": "2026-08-11",
        "YouTube": 435.24,
        "Bricklink": 0
      },
      {
        "date": "2026-08-12",
        "YouTube": 463.68,
        "Bricklink": 0
      },
      {
        "date": "2026-08-17",
        "YouTube": 218.41,
        "Bricklink": 126.94
      },
      {
        "date": "2026-08-18",
        "YouTube": 276.93,
        "Bricklink": 79.16
      },
      {
        "date": "2026-08-19",
        "YouTube": 184.49,
        "Bricklink": 0
      },
      {
        "date": "2026-08-20",
        "YouTube": 199.02,
        "Bricklink": 0
      },
      {
        "date": "2026-08-21",
        "YouTube": 480,
        "Bricklink": 0
      },
      {
        "date": "2026-08-22",
        "YouTube": 480,
        "Bricklink": 0
      },
      {
        "date": "2026-08-23",
        "YouTube": 480,
        "Bricklink": 0
      },
      {
        "date": "2026-08-24",
        "YouTube": 179.58,
        "Bricklink": 180
      },
      {
        "date": "2026-08-25",
        "YouTube": 290.9,
        "Bricklink": 111.89
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
