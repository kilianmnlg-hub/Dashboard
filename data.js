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
    "lastUpdated": "2026-10-07",
    "lastSyncedAt": "2026-10-07T12:02:34.523Z",
    "owner": "Kilian"
  },
  "github": {
    "owner": "kilianmnlg-hub",
    "repo": "Dashboard",
    "workflowFile": "sync-all.yml"
  },
  "googleCalendar": {
    "clientId": "864080911617-s0mr2dif1ftilon7fpcejdu7brjnqubr.apps.googleusercontent.com",
    "workerUrl": "https://dashboard-gcal-proxy.kilian-mnlg.workers.dev"
  },
  "brainMap": {
    "syncedAt": "2026-09-19T06:07:05.543Z",
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
      },
      {
        "date": "2026-08-27",
        "value": 28800
      },
      {
        "date": "2026-08-28",
        "value": 28800
      },
      {
        "date": "2026-08-29",
        "value": 28900
      },
      {
        "date": "2026-08-30",
        "value": 28900
      },
      {
        "date": "2026-08-31",
        "value": 28900
      },
      {
        "date": "2026-09-01",
        "value": 28900
      },
      {
        "date": "2026-09-02",
        "value": 28900
      },
      {
        "date": "2026-09-03",
        "value": 28900
      },
      {
        "date": "2026-09-04",
        "value": 29000
      },
      {
        "date": "2026-09-05",
        "value": 29000
      },
      {
        "date": "2026-09-06",
        "value": 29000
      },
      {
        "date": "2026-09-07",
        "value": 29000
      },
      {
        "date": "2026-09-08",
        "value": 29100
      },
      {
        "date": "2026-09-09",
        "value": 29100
      },
      {
        "date": "2026-09-10",
        "value": 29100
      },
      {
        "date": "2026-09-11",
        "value": 29100
      },
      {
        "date": "2026-09-12",
        "value": 29100
      },
      {
        "date": "2026-09-13",
        "value": 29100
      },
      {
        "date": "2026-09-14",
        "value": 29200
      },
      {
        "date": "2026-09-15",
        "value": 29200
      },
      {
        "date": "2026-09-16",
        "value": 29200
      },
      {
        "date": "2026-09-17",
        "value": 29100
      },
      {
        "date": "2026-09-18",
        "value": 29200
      },
      {
        "date": "2026-09-19",
        "value": 29200
      },
      {
        "date": "2026-09-20",
        "value": 29200
      },
      {
        "date": "2026-09-21",
        "value": 29200
      },
      {
        "date": "2026-09-22",
        "value": 29200
      },
      {
        "date": "2026-09-23",
        "value": 29200
      },
      {
        "date": "2026-09-24",
        "value": 29300
      },
      {
        "date": "2026-09-25",
        "value": 29300
      },
      {
        "date": "2026-09-26",
        "value": 29300
      },
      {
        "date": "2026-09-27",
        "value": 29300
      },
      {
        "date": "2026-09-28",
        "value": 29300
      },
      {
        "date": "2026-09-29",
        "value": 29300
      },
      {
        "date": "2026-09-30",
        "value": 29300
      },
      {
        "date": "2026-10-01",
        "value": 29300
      },
      {
        "date": "2026-10-02",
        "value": 29300
      },
      {
        "date": "2026-10-03",
        "value": 29300
      },
      {
        "date": "2026-10-04",
        "value": 29300
      },
      {
        "date": "2026-10-05",
        "value": 29300
      },
      {
        "date": "2026-10-06",
        "value": 29300
      },
      {
        "date": "2026-10-07",
        "value": 29300
      }
    ],
    "brainwalkersAbos": [
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
        "value": 369
      },
      {
        "date": "2026-08-27",
        "value": 369
      },
      {
        "date": "2026-08-28",
        "value": 373
      },
      {
        "date": "2026-08-29",
        "value": 377
      },
      {
        "date": "2026-08-30",
        "value": 386
      },
      {
        "date": "2026-08-31",
        "value": 389
      },
      {
        "date": "2026-09-01",
        "value": 396
      },
      {
        "date": "2026-09-02",
        "value": 405
      },
      {
        "date": "2026-09-03",
        "value": 408
      },
      {
        "date": "2026-09-04",
        "value": 413
      },
      {
        "date": "2026-09-05",
        "value": 415
      },
      {
        "date": "2026-09-06",
        "value": 421
      },
      {
        "date": "2026-09-07",
        "value": 425
      },
      {
        "date": "2026-09-08",
        "value": 434
      },
      {
        "date": "2026-09-09",
        "value": 446
      },
      {
        "date": "2026-09-10",
        "value": 450
      },
      {
        "date": "2026-09-11",
        "value": 452
      },
      {
        "date": "2026-09-12",
        "value": 455
      },
      {
        "date": "2026-09-13",
        "value": 458
      },
      {
        "date": "2026-09-14",
        "value": 460
      },
      {
        "date": "2026-09-15",
        "value": 460
      },
      {
        "date": "2026-09-16",
        "value": 460
      },
      {
        "date": "2026-09-17",
        "value": 456
      },
      {
        "date": "2026-09-18",
        "value": 461
      },
      {
        "date": "2026-09-19",
        "value": 462
      },
      {
        "date": "2026-09-20",
        "value": 444
      },
      {
        "date": "2026-09-21",
        "value": 495
      },
      {
        "date": "2026-09-22",
        "value": 509
      },
      {
        "date": "2026-09-23",
        "value": 518
      },
      {
        "date": "2026-09-24",
        "value": 519
      },
      {
        "date": "2026-09-25",
        "value": 519
      },
      {
        "date": "2026-09-26",
        "value": 521
      },
      {
        "date": "2026-09-27",
        "value": 523
      },
      {
        "date": "2026-09-28",
        "value": 526
      },
      {
        "date": "2026-09-29",
        "value": 534
      },
      {
        "date": "2026-09-30",
        "value": 535
      },
      {
        "date": "2026-10-01",
        "value": 536
      },
      {
        "date": "2026-10-02",
        "value": 535
      },
      {
        "date": "2026-10-03",
        "value": 537
      },
      {
        "date": "2026-10-04",
        "value": 537
      },
      {
        "date": "2026-10-05",
        "value": 537
      },
      {
        "date": "2026-10-06",
        "value": 537
      },
      {
        "date": "2026-10-07",
        "value": 537
      }
    ],
    "tiktokFollower": [
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
        "value": 2738
      },
      {
        "date": "2026-08-27",
        "value": 2737
      },
      {
        "date": "2026-08-28",
        "value": 2737
      },
      {
        "date": "2026-08-29",
        "value": 2738
      },
      {
        "date": "2026-08-30",
        "value": 2737
      },
      {
        "date": "2026-08-31",
        "value": 2735
      },
      {
        "date": "2026-09-01",
        "value": 2739
      },
      {
        "date": "2026-09-02",
        "value": 2739
      },
      {
        "date": "2026-09-03",
        "value": 2739
      },
      {
        "date": "2026-09-04",
        "value": 2739
      },
      {
        "date": "2026-09-05",
        "value": 2740
      },
      {
        "date": "2026-09-06",
        "value": 2738
      },
      {
        "date": "2026-09-07",
        "value": 2740
      },
      {
        "date": "2026-09-08",
        "value": 2741
      },
      {
        "date": "2026-09-09",
        "value": 2758
      },
      {
        "date": "2026-09-10",
        "value": 2762
      },
      {
        "date": "2026-09-11",
        "value": 2762
      },
      {
        "date": "2026-09-12",
        "value": 2760
      },
      {
        "date": "2026-09-13",
        "value": 2757
      },
      {
        "date": "2026-09-14",
        "value": 2766
      },
      {
        "date": "2026-09-15",
        "value": 2766
      },
      {
        "date": "2026-09-16",
        "value": 2767
      },
      {
        "date": "2026-09-17",
        "value": 2773
      },
      {
        "date": "2026-09-18",
        "value": 2771
      },
      {
        "date": "2026-09-19",
        "value": 2771
      },
      {
        "date": "2026-09-20",
        "value": 2775
      },
      {
        "date": "2026-09-21",
        "value": 2776
      },
      {
        "date": "2026-09-22",
        "value": 2776
      },
      {
        "date": "2026-09-23",
        "value": 2777
      },
      {
        "date": "2026-09-24",
        "value": 2777
      },
      {
        "date": "2026-09-25",
        "value": 2782
      },
      {
        "date": "2026-09-26",
        "value": 2788
      },
      {
        "date": "2026-09-27",
        "value": 2789
      },
      {
        "date": "2026-09-28",
        "value": 2791
      },
      {
        "date": "2026-09-29",
        "value": 2792
      },
      {
        "date": "2026-09-30",
        "value": 2793
      },
      {
        "date": "2026-10-01",
        "value": 2793
      },
      {
        "date": "2026-10-02",
        "value": 2792
      },
      {
        "date": "2026-10-03",
        "value": 2792
      },
      {
        "date": "2026-10-04",
        "value": 2791
      },
      {
        "date": "2026-10-05",
        "value": 2791
      },
      {
        "date": "2026-10-06",
        "value": 2792
      },
      {
        "date": "2026-10-07",
        "value": 2791
      }
    ]
  },
  "goals": [
    {
      "id": "bricks-abos",
      "label": "Bricks On The Floor – Abonnenten",
      "project": "bricksOnTheFloor",
      "current": 29300,
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
      "current": 537,
      "target": 1000,
      "unit": "Abos",
      "due": "2026-12-31"
    },
    {
      "id": "tiktok-follower",
      "label": "Bricks On The Floor – TikTok-Follower",
      "project": "tiktok",
      "current": 2791,
      "target": 10000,
      "unit": "Follower",
      "due": "2026-12-31"
    },
    {
      "id": "bricklink-parts",
      "label": "Bricklink – Teile verkauft",
      "project": "bricklink",
      "current": 84108,
      "target": 100000,
      "unit": "Teile",
      "due": "2026-12-31"
    },
    {
      "id": "bricks-longform-2026",
      "label": "Bricks On The Floor – Longform-Videos 2026",
      "project": "bricksOnTheFloor",
      "current": 27,
      "target": 52,
      "unit": "Videos",
      "due": "2026-12-31"
    },
    {
      "id": "brainwalkers-longform-2026",
      "label": "The Brainwalkers – Longform-Videos 2026",
      "project": "brainwalkers",
      "current": 10,
      "target": 26,
      "unit": "Videos",
      "due": "2026-12-31"
    }
  ],
  "bricklinkOrders": {
    "checkedAt": "2026-10-07T12:02:33.089Z",
    "openOrdersCount": 286,
    "pendingShipments": []
  },
  "bricklinkRevenue": {
    "checkedAt": "2026-10-07T12:02:33.371Z",
    "currency": "EUR",
    "weekly": [
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
        "total": 315.84,
        "orderCount": 4
      },
      {
        "weekStart": "2026-08-31",
        "total": 73.03,
        "orderCount": 3
      },
      {
        "weekStart": "2026-09-07",
        "total": 28.26,
        "orderCount": 2
      },
      {
        "weekStart": "2026-09-14",
        "total": 107.22,
        "orderCount": 4
      },
      {
        "weekStart": "2026-09-21",
        "total": 111.19,
        "orderCount": 2
      },
      {
        "weekStart": "2026-09-28",
        "total": 42.01,
        "orderCount": 2
      },
      {
        "weekStart": "2026-10-05",
        "total": 100,
        "orderCount": 1
      }
    ],
    "monthly": [
      {
        "month": "2026-04",
        "total": 485.19,
        "orderCount": 14
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
        "total": 1051.03,
        "orderCount": 16
      },
      {
        "month": "2026-09",
        "total": 322.7,
        "orderCount": 11
      },
      {
        "month": "2026-10",
        "total": 120.22,
        "orderCount": 2
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
      "lastUploadAt": "2026-09-23T16:20:16Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "29.300",
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
      "lastUploadAt": "2026-09-20T13:55:36Z",
      "stats": [
        {
          "label": "Abonnenten",
          "value": "537"
        },
        {
          "label": "Videos",
          "value": "81"
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
      "to": "2026-10-06"
    },
    "totalsByCategory": {
      "YouTube": 12864.05,
      "Bricklink": 3630.79
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
      },
      {
        "date": "2026-08-26",
        "YouTube": 203.12,
        "Bricklink": 65.8
      },
      {
        "date": "2026-08-27",
        "YouTube": 255.83,
        "Bricklink": 96.25
      },
      {
        "date": "2026-08-28",
        "YouTube": 148.87,
        "Bricklink": 0
      },
      {
        "date": "2026-08-29",
        "YouTube": 198.55,
        "Bricklink": 0
      },
      {
        "date": "2026-08-30",
        "YouTube": 404.86,
        "Bricklink": 34.91
      },
      {
        "date": "2026-08-31",
        "YouTube": 494.34,
        "Bricklink": 133.83
      },
      {
        "date": "2026-09-01",
        "YouTube": 409.69,
        "Bricklink": 46.05
      },
      {
        "date": "2026-09-02",
        "YouTube": 18.08,
        "Bricklink": 0
      },
      {
        "date": "2026-09-07",
        "YouTube": 21.2,
        "Bricklink": 73.65
      },
      {
        "date": "2026-09-08",
        "YouTube": 144.51,
        "Bricklink": 46.36
      },
      {
        "date": "2026-09-09",
        "YouTube": 274.6,
        "Bricklink": 126.35
      },
      {
        "date": "2026-09-10",
        "YouTube": 287.89,
        "Bricklink": 0
      },
      {
        "date": "2026-09-11",
        "YouTube": 45.88,
        "Bricklink": 0
      },
      {
        "date": "2026-09-14",
        "YouTube": 83.61,
        "Bricklink": 177.93
      },
      {
        "date": "2026-09-15",
        "YouTube": 66.39,
        "Bricklink": 0
      },
      {
        "date": "2026-09-16",
        "YouTube": 144.83,
        "Bricklink": 0
      },
      {
        "date": "2026-09-17",
        "YouTube": 281.09,
        "Bricklink": 71.4
      },
      {
        "date": "2026-09-18",
        "YouTube": 88.86,
        "Bricklink": 200.76
      },
      {
        "date": "2026-09-19",
        "YouTube": 192.78,
        "Bricklink": 0
      },
      {
        "date": "2026-09-20",
        "YouTube": 70.95,
        "Bricklink": 206.43
      },
      {
        "date": "2026-09-21",
        "YouTube": 128.98,
        "Bricklink": 90
      },
      {
        "date": "2026-09-22",
        "YouTube": 139.65,
        "Bricklink": 250.47
      },
      {
        "date": "2026-09-23",
        "YouTube": 342.12,
        "Bricklink": 176.07
      },
      {
        "date": "2026-09-24",
        "YouTube": 120.27,
        "Bricklink": 210
      },
      {
        "date": "2026-09-25",
        "YouTube": 0,
        "Bricklink": 130.01
      },
      {
        "date": "2026-09-30",
        "YouTube": 44.04,
        "Bricklink": 0
      },
      {
        "date": "2026-10-02",
        "YouTube": 75.02,
        "Bricklink": 0
      },
      {
        "date": "2026-10-04",
        "YouTube": 284.6,
        "Bricklink": 61.77
      },
      {
        "date": "2026-10-05",
        "YouTube": 291.28,
        "Bricklink": 79.9
      },
      {
        "date": "2026-10-06",
        "YouTube": 120.18,
        "Bricklink": 0
      }
    ],
    "entries": [
      {
        "id": "3a9430d3-4cf3-81e1-b837-d66d7a820849",
        "cat": "youtube",
        "start": 1784973600000,
        "end": 1784979000000,
        "min": 90
      },
      {
        "id": "3a8430d3-4cf3-81ab-844f-d31c7287dc41",
        "cat": "youtube",
        "start": 1784983320000,
        "end": 1784992020000,
        "min": 144.97
      },
      {
        "id": "3a8430d3-4cf3-81f3-babd-ff093bb8d4ac",
        "cat": "youtube",
        "start": 1784999880000,
        "end": 1785000600000,
        "min": 11.78
      },
      {
        "id": "3a9430d3-4cf3-8169-b303-e80248eab568",
        "cat": "bricklink",
        "start": 1785054420000,
        "end": 1785060480000,
        "min": 100.71
      },
      {
        "id": "3a9430d3-4cf3-818d-919d-fd35e9d9eafb",
        "cat": "youtube",
        "start": 1785068520000,
        "end": 1785070080000,
        "min": 25.61
      },
      {
        "id": "3a9430d3-4cf3-8100-a545-f875f7e97fd6",
        "cat": "youtube",
        "start": 1785090240000,
        "end": 1785098040000,
        "min": 129.95
      },
      {
        "id": "3aa430d3-4cf3-81b6-ad23-d0ab918d11e4",
        "cat": "youtube",
        "start": 1785137940000,
        "end": 1785145740000,
        "min": 129.54
      },
      {
        "id": "3aa430d3-4cf3-8189-b326-edb957facec1",
        "cat": "youtube",
        "start": 1785151260000,
        "end": 1785158340000,
        "min": 118.08
      },
      {
        "id": "3aa430d3-4cf3-8185-9fb6-ef2833268296",
        "cat": "youtube",
        "start": 1785158940000,
        "end": 1785165120000,
        "min": 102.83
      },
      {
        "id": "3aa430d3-4cf3-8109-b3e2-ece43718b043",
        "cat": "bricklink",
        "start": 1785165120000,
        "end": 1785176280000,
        "min": 185.8
      },
      {
        "id": "3aa430d3-4cf3-8176-8987-e4278f9a5f63",
        "cat": "youtube",
        "start": 1785181500000,
        "end": 1785187080000,
        "min": 93.44
      },
      {
        "id": "3ac430d3-4cf3-816b-a3f0-d8c035086883",
        "cat": "youtube",
        "start": 1785232800000,
        "end": 1785240000000,
        "min": 120
      },
      {
        "id": "3ab430d3-4cf3-81ef-b828-d96941ddb176",
        "cat": "youtube",
        "start": 1785238320000,
        "end": 1785243360000,
        "min": 84.09
      },
      {
        "id": "3ab430d3-4cf3-81cc-9e43-f06c3cf53aaa",
        "cat": "youtube",
        "start": 1785246480000,
        "end": 1785255780000,
        "min": 155.2
      },
      {
        "id": "3ad430d3-4cf3-816d-a30c-f91eb315b99a",
        "cat": "youtube",
        "start": 1785319200000,
        "end": 1785328200000,
        "min": 150
      },
      {
        "id": "3ac430d3-4cf3-81f7-b26d-e50e68e0f477",
        "cat": "bricklink",
        "start": 1785347460000,
        "end": 1785352800000,
        "min": 89.7
      },
      {
        "id": "3ad430d3-4cf3-81e7-a9ca-e19956464d66",
        "cat": "youtube",
        "start": 1785393480000,
        "end": 1785393780000,
        "min": 5.32
      },
      {
        "id": "3ad430d3-4cf3-81b9-9f77-f399167ee0ad",
        "cat": "youtube",
        "start": 1785397500000,
        "end": 1785398820000,
        "min": 22.55
      },
      {
        "id": "3ad430d3-4cf3-81af-9843-d53cbb72e4f5",
        "cat": "youtube",
        "start": 1785401520000,
        "end": 1785402900000,
        "min": 23.68
      },
      {
        "id": "3ad430d3-4cf3-8129-ad5d-cddeb83b8850",
        "cat": "bricklink",
        "start": 1785405600000,
        "end": 1785406500000,
        "min": 15
      },
      {
        "id": "3ad430d3-4cf3-81c8-a414-ce24bf476972",
        "cat": "youtube",
        "start": 1785405600000,
        "end": 1785409200000,
        "min": 60
      },
      {
        "id": "3ad430d3-4cf3-810a-83aa-dfceff8b01f3",
        "cat": "youtube",
        "start": 1785428220000,
        "end": 1785429600000,
        "min": 22.88
      },
      {
        "id": "3ad430d3-4cf3-81e0-a7fa-da033d7b8cb5",
        "cat": "youtube",
        "start": 1785430980000,
        "end": 1785437280000,
        "min": 104.36
      },
      {
        "id": "3ae430d3-4cf3-81ab-9438-e8c6195e6c3e",
        "cat": "youtube",
        "start": 1785479880000,
        "end": 1785484980000,
        "min": 85.16
      },
      {
        "id": "3af430d3-4cf3-8182-8923-e6acff9a7bad",
        "cat": "youtube",
        "start": 1785492000000,
        "end": 1785493800000,
        "min": 30
      },
      {
        "id": "3ae430d3-4cf3-814a-a6b1-e239c28f8071",
        "cat": "youtube",
        "start": 1785495720000,
        "end": 1785496860000,
        "min": 19.48
      },
      {
        "id": "3af430d3-4cf3-81db-ace5-ca0dd0b99b5b",
        "cat": "youtube",
        "start": 1785573660000,
        "end": 1785575700000,
        "min": 33.78
      },
      {
        "id": "3b0430d3-4cf3-819d-9d30-dcca2abe3d20",
        "cat": "youtube",
        "start": 1785578400000,
        "end": 1785587400000,
        "min": 150
      },
      {
        "id": "3b0430d3-4cf3-8180-aadb-fb2b35ed6b19",
        "cat": "youtube",
        "start": 1785670020000,
        "end": 1785686880000,
        "min": 280.31
      },
      {
        "id": "3b0430d3-4cf3-819d-8b90-cadd072753e0",
        "cat": "bricklink",
        "start": 1785686880000,
        "end": 1785697260000,
        "min": 173.38
      },
      {
        "id": "3b1430d3-4cf3-81bf-b16c-f7d5870baebe",
        "cat": "youtube",
        "start": 1785741780000,
        "end": 1785741840000,
        "min": 0.89
      },
      {
        "id": "3b1430d3-4cf3-8197-8790-e639dd5490d4",
        "cat": "youtube",
        "start": 1785744300000,
        "end": 1785746340000,
        "min": 34.03
      },
      {
        "id": "3b1430d3-4cf3-8173-98b0-f24592f6e07d",
        "cat": "youtube",
        "start": 1785749820000,
        "end": 1785751980000,
        "min": 36.56
      },
      {
        "id": "3b1430d3-4cf3-8165-b7a2-e7632a055105",
        "cat": "youtube",
        "start": 1785759960000,
        "end": 1785764820000,
        "min": 81.33
      },
      {
        "id": "3b1430d3-4cf3-81d3-8e0b-cde760fceef7",
        "cat": "youtube",
        "start": 1785766500000,
        "end": 1785767220000,
        "min": 12.59
      },
      {
        "id": "3b1430d3-4cf3-81e6-b3d0-c313f8bf35eb",
        "cat": "youtube",
        "start": 1785768060000,
        "end": 1785771480000,
        "min": 57.37
      },
      {
        "id": "3b1430d3-4cf3-813b-99c5-f0435b723ade",
        "cat": "youtube",
        "start": 1785776700000,
        "end": 1785779700000,
        "min": 50.43
      },
      {
        "id": "3b1430d3-4cf3-8160-bb7e-c480969fcdfa",
        "cat": "bricklink",
        "start": 1785779700000,
        "end": 1785785100000,
        "min": 90.04
      },
      {
        "id": "3b2430d3-4cf3-81cc-aba8-f1e45673b6b5",
        "cat": "bricklink",
        "start": 1785844560000,
        "end": 1785847020000,
        "min": 41.16
      },
      {
        "id": "3b2430d3-4cf3-8177-aabe-fc960971e89b",
        "cat": "youtube",
        "start": 1785847380000,
        "end": 1785848880000,
        "min": 25.42
      },
      {
        "id": "3b2430d3-4cf3-814d-8636-f65fc29ce527",
        "cat": "youtube",
        "start": 1785856620000,
        "end": 1785861660000,
        "min": 83.56
      },
      {
        "id": "3b4430d3-4cf3-8197-ba77-f391fb0f12e5",
        "cat": "youtube",
        "start": 1785924000000,
        "end": 1785931200000,
        "min": 120
      },
      {
        "id": "3b4430d3-4cf3-8114-8313-ed576800714b",
        "cat": "youtube",
        "start": 1785924000000,
        "end": 1785925800000,
        "min": 30
      },
      {
        "id": "3b3430d3-4cf3-8188-8775-e342726bf86c",
        "cat": "youtube",
        "start": 1785926280000,
        "end": 1785928980000,
        "min": 44.69
      },
      {
        "id": "3b3430d3-4cf3-81e3-bd6c-fa7200bec06b",
        "cat": "bricklink",
        "start": 1785942900000,
        "end": 1785944400000,
        "min": 25
      },
      {
        "id": "3b5430d3-4cf3-8138-ba0a-f2687b7dbbb5",
        "cat": "youtube",
        "start": 1786010400000,
        "end": 1786019400000,
        "min": 150
      },
      {
        "id": "3b4430d3-4cf3-816f-8c01-ecbcce73ba1b",
        "cat": "bricklink",
        "start": 1786010400000,
        "end": 1786012200000,
        "min": 30
      },
      {
        "id": "3b4430d3-4cf3-81cb-a831-da51252a537e",
        "cat": "bricklink",
        "start": 1786034040000,
        "end": 1786036800000,
        "min": 46.04
      },
      {
        "id": "3b6430d3-4cf3-81ee-a8cb-ed1f686b432b",
        "cat": "youtube",
        "start": 1786096800000,
        "end": 1786100400000,
        "min": 60
      },
      {
        "id": "3b6430d3-4cf3-81dc-a659-de727c83a0dc",
        "cat": "youtube",
        "start": 1786179720000,
        "end": 1786180920000,
        "min": 19.99
      },
      {
        "id": "3b6430d3-4cf3-81c8-bd64-e96d1d34e708",
        "cat": "youtube",
        "start": 1786182720000,
        "end": 1786197960000,
        "min": 254
      },
      {
        "id": "3b7430d3-4cf3-8146-a23b-d51df491e1c1",
        "cat": "youtube",
        "start": 1786277340000,
        "end": 1786277340000,
        "min": 0.68
      },
      {
        "id": "3b7430d3-4cf3-815d-8cec-d24e0f056bc4",
        "cat": "youtube",
        "start": 1786278180000,
        "end": 1786285260000,
        "min": 117.87
      },
      {
        "id": "3b7430d3-4cf3-8116-9ca8-e22aaf251045",
        "cat": "youtube",
        "start": 1786287660000,
        "end": 1786290000000,
        "min": 38.95
      },
      {
        "id": "3b9430d3-4cf3-814b-9cbc-d0ac6154cc37",
        "cat": "youtube",
        "start": 1786356000000,
        "end": 1786365000000,
        "min": 150
      },
      {
        "id": "3b8430d3-4cf3-81b9-ab49-d769ef434e81",
        "cat": "youtube",
        "start": 1786356000000,
        "end": 1786363200000,
        "min": 120
      },
      {
        "id": "3b8430d3-4cf3-81f3-9d9a-df4412e27134",
        "cat": "bricklink",
        "start": 1786364580000,
        "end": 1786368060000,
        "min": 58.03
      },
      {
        "id": "3b8430d3-4cf3-81bd-b7fc-c3abf01a4867",
        "cat": "youtube",
        "start": 1786381500000,
        "end": 1786388220000,
        "min": 112.36
      },
      {
        "id": "3ba430d3-4cf3-81e2-a939-d2b9ceb2ef49",
        "cat": "youtube",
        "start": 1786442400000,
        "end": 1786458600000,
        "min": 270
      },
      {
        "id": "3b9430d3-4cf3-81d1-83d0-eba49b5b3a8c",
        "cat": "youtube",
        "start": 1786451160000,
        "end": 1786457760000,
        "min": 109.52
      },
      {
        "id": "3b9430d3-4cf3-817b-a48e-fdceb21ca085",
        "cat": "youtube",
        "start": 1786459260000,
        "end": 1786462620000,
        "min": 55.72
      },
      {
        "id": "3ba430d3-4cf3-81e9-b5cd-dd2f2b68a18c",
        "cat": "youtube",
        "start": 1786528800000,
        "end": 1786530600000,
        "min": 30
      },
      {
        "id": "3ba430d3-4cf3-81b1-8942-d14950f33284",
        "cat": "youtube",
        "start": 1786541280000,
        "end": 1786544820000,
        "min": 59.49
      },
      {
        "id": "3ba430d3-4cf3-815d-ad72-cf3e6e6df80c",
        "cat": "youtube",
        "start": 1786545600000,
        "end": 1786552260000,
        "min": 111.06
      },
      {
        "id": "3ba430d3-4cf3-81cd-a568-d3c65be72c26",
        "cat": "youtube",
        "start": 1786553220000,
        "end": 1786569000000,
        "min": 263.13
      },
      {
        "id": "3bf430d3-4cf3-8100-b551-c4d58f87ad0f",
        "cat": "youtube",
        "start": 1786952640000,
        "end": 1786953420000,
        "min": 12.7
      },
      {
        "id": "3bf430d3-4cf3-81e1-b5d6-cb36ef398925",
        "cat": "youtube",
        "start": 1786953540000,
        "end": 1786954860000,
        "min": 22.34
      },
      {
        "id": "3bf430d3-4cf3-8151-b810-cc181794ae30",
        "cat": "youtube",
        "start": 1786960800000,
        "end": 1786962600000,
        "min": 30
      },
      {
        "id": "3bf430d3-4cf3-81cc-b686-e6b1c85f06c7",
        "cat": "bricklink",
        "start": 1786972740000,
        "end": 1786975500000,
        "min": 46.8
      },
      {
        "id": "3bf430d3-4cf3-81f1-802a-eae2eea2411e",
        "cat": "youtube",
        "start": 1786978560000,
        "end": 1786978920000,
        "min": 6.08
      },
      {
        "id": "3bf430d3-4cf3-8146-99c7-fa5201b94473",
        "cat": "youtube",
        "start": 1786980360000,
        "end": 1786981260000,
        "min": 15
      },
      {
        "id": "3bf430d3-4cf3-819f-8f19-e60ec8bba02d",
        "cat": "youtube",
        "start": 1786982340000,
        "end": 1786987140000,
        "min": 79.28
      },
      {
        "id": "3bf430d3-4cf3-81d2-8afb-d8973e955b52",
        "cat": "youtube",
        "start": 1786995000000,
        "end": 1786998180000,
        "min": 53.01
      },
      {
        "id": "3bf430d3-4cf3-81aa-b472-fda6b82a505e",
        "cat": "bricklink",
        "start": 1786998180000,
        "end": 1787002980000,
        "min": 80.14
      },
      {
        "id": "3c0430d3-4cf3-81ba-8fdc-c39aabd9bc3c",
        "cat": "youtube",
        "start": 1787047200000,
        "end": 1787050800000,
        "min": 60
      },
      {
        "id": "3c0430d3-4cf3-812b-bc8d-d742b205555c",
        "cat": "youtube",
        "start": 1787054760000,
        "end": 1787063040000,
        "min": 137.77
      },
      {
        "id": "3c0430d3-4cf3-8159-b324-c32cbef1d1f4",
        "cat": "youtube",
        "start": 1787063160000,
        "end": 1787064360000,
        "min": 20.18
      },
      {
        "id": "3c0430d3-4cf3-8177-90a6-ce5a9e45e523",
        "cat": "bricklink",
        "start": 1787064360000,
        "end": 1787065920000,
        "min": 25.79
      },
      {
        "id": "3c0430d3-4cf3-8188-aa0d-d0fcb7ab23a8",
        "cat": "youtube",
        "start": 1787066460000,
        "end": 1787068740000,
        "min": 37.85
      },
      {
        "id": "3c0430d3-4cf3-8134-9560-d0d16e775e54",
        "cat": "youtube",
        "start": 1787084040000,
        "end": 1787085300000,
        "min": 21.13
      },
      {
        "id": "3c0430d3-4cf3-81aa-9f19-c912d74426d5",
        "cat": "bricklink",
        "start": 1787085300000,
        "end": 1787088540000,
        "min": 53.37
      },
      {
        "id": "3c1430d3-4cf3-8185-bae8-d9d150dfae51",
        "cat": "youtube",
        "start": 1787127240000,
        "end": 1787133780000,
        "min": 109.32
      },
      {
        "id": "3c1430d3-4cf3-8184-9c64-d7051b5ae5a7",
        "cat": "youtube",
        "start": 1787140500000,
        "end": 1787145000000,
        "min": 75.17
      },
      {
        "id": "3c2430d3-4cf3-812a-8d78-f7354512999b",
        "cat": "youtube",
        "start": 1787220000000,
        "end": 1787225400000,
        "min": 90
      },
      {
        "id": "3c2430d3-4cf3-81d2-acaf-d87e7086bab4",
        "cat": "youtube",
        "start": 1787221440000,
        "end": 1787227980000,
        "min": 109.02
      },
      {
        "id": "3c6430d3-4cf3-8107-9ef0-c8caeaba9cdc",
        "cat": "youtube",
        "start": 1787306400000,
        "end": 1787335200000,
        "min": 480
      },
      {
        "id": "3c6430d3-4cf3-81e0-a45d-e5e5827172b7",
        "cat": "youtube",
        "start": 1787392800000,
        "end": 1787421600000,
        "min": 480
      },
      {
        "id": "3c6430d3-4cf3-81e4-91b6-d3b19ec64ba3",
        "cat": "youtube",
        "start": 1787479200000,
        "end": 1787508000000,
        "min": 480
      },
      {
        "id": "3c6430d3-4cf3-812f-beb7-db2b356867d7",
        "cat": "youtube",
        "start": 1787551920000,
        "end": 1787553600000,
        "min": 27.76
      },
      {
        "id": "3c6430d3-4cf3-81be-a897-f76408a12c83",
        "cat": "youtube",
        "start": 1787555760000,
        "end": 1787557740000,
        "min": 32.95
      },
      {
        "id": "3c7430d3-4cf3-816e-b51e-e70673602425",
        "cat": "bricklink",
        "start": 1787565600000,
        "end": 1787574600000,
        "min": 150
      },
      {
        "id": "3c7430d3-4cf3-8165-aaaf-f4508d2fe91c",
        "cat": "youtube",
        "start": 1787565600000,
        "end": 1787567400000,
        "min": 30
      },
      {
        "id": "3c6430d3-4cf3-81b9-b3ff-eff8c7b219d1",
        "cat": "bricklink",
        "start": 1787565600000,
        "end": 1787567400000,
        "min": 30
      },
      {
        "id": "3c6430d3-4cf3-819c-b712-f332a022a756",
        "cat": "youtube",
        "start": 1787565660000,
        "end": 1787571000000,
        "min": 88.87
      },
      {
        "id": "3c7430d3-4cf3-81b7-b01e-ea8d2e5336ee",
        "cat": "youtube",
        "start": 1787643600000,
        "end": 1787645280000,
        "min": 28.41
      },
      {
        "id": "3c7430d3-4cf3-81e1-80ec-ebc86a395df4",
        "cat": "youtube",
        "start": 1787645700000,
        "end": 1787648580000,
        "min": 48.64
      },
      {
        "id": "3c7430d3-4cf3-81c7-a305-ec4ceb8eb648",
        "cat": "bricklink",
        "start": 1787652000000,
        "end": 1787657400000,
        "min": 90
      },
      {
        "id": "3c7430d3-4cf3-8147-9e83-ca9218e67c4d",
        "cat": "youtube",
        "start": 1787652000000,
        "end": 1787652900000,
        "min": 15
      },
      {
        "id": "3c7430d3-4cf3-8180-8b3a-c17d3e4974ac",
        "cat": "youtube",
        "start": 1787653500000,
        "end": 1787654940000,
        "min": 23.78
      },
      {
        "id": "3c7430d3-4cf3-81bb-bc09-f2b6f093db1e",
        "cat": "bricklink",
        "start": 1787659200000,
        "end": 1787659800000,
        "min": 10.47
      },
      {
        "id": "3c7430d3-4cf3-8153-9611-d03f17e93898",
        "cat": "youtube",
        "start": 1787659800000,
        "end": 1787662140000,
        "min": 39.19
      },
      {
        "id": "3c7430d3-4cf3-8119-b126-da19733630cd",
        "cat": "bricklink",
        "start": 1787674740000,
        "end": 1787675400000,
        "min": 11.42
      },
      {
        "id": "3c7430d3-4cf3-8184-9046-cc7c5dd590e1",
        "cat": "youtube",
        "start": 1787675400000,
        "end": 1787683560000,
        "min": 135.88
      },
      {
        "id": "3c8430d3-4cf3-81ec-ab86-f7dc6b5e6783",
        "cat": "bricklink",
        "start": 1787728860000,
        "end": 1787730420000,
        "min": 26.07
      },
      {
        "id": "3c8430d3-4cf3-81d3-8410-d1ef624ee889",
        "cat": "youtube",
        "start": 1787736360000,
        "end": 1787737140000,
        "min": 13.12
      },
      {
        "id": "3c9430d3-4cf3-815a-98b5-fb87c3ccdac3",
        "cat": "youtube",
        "start": 1787738400000,
        "end": 1787743800000,
        "min": 90
      },
      {
        "id": "3c8430d3-4cf3-81fb-bba7-de73ddc688c6",
        "cat": "youtube",
        "start": 1787738400000,
        "end": 1787743800000,
        "min": 90
      },
      {
        "id": "3c8430d3-4cf3-8119-b361-d8187cae94dd",
        "cat": "youtube",
        "start": 1787738400000,
        "end": 1787739000000,
        "min": 10
      },
      {
        "id": "3c8430d3-4cf3-811c-83f9-c4a5feb9bece",
        "cat": "bricklink",
        "start": 1787762460000,
        "end": 1787764800000,
        "min": 39.73
      },
      {
        "id": "3c9430d3-4cf3-817c-92cb-ff10ea9b82f4",
        "cat": "youtube",
        "start": 1787813100000,
        "end": 1787823060000,
        "min": 165.83
      },
      {
        "id": "3ca430d3-4cf3-81e2-856d-fd9f951c4f26",
        "cat": "youtube",
        "start": 1787824800000,
        "end": 1787830200000,
        "min": 90
      },
      {
        "id": "3c9430d3-4cf3-81d3-b68d-f4db6504fba9",
        "cat": "bricklink",
        "start": 1787827080000,
        "end": 1787832360000,
        "min": 88.04
      },
      {
        "id": "3c9430d3-4cf3-8149-a2b8-ff2b42c9f046",
        "cat": "bricklink",
        "start": 1787841600000,
        "end": 1787842140000,
        "min": 8.21
      },
      {
        "id": "3ca430d3-4cf3-8136-a7b1-da7bb94742e2",
        "cat": "youtube",
        "start": 1787913540000,
        "end": 1787918280000,
        "min": 79.2
      },
      {
        "id": "3ca430d3-4cf3-81c5-b793-e5d1d04cef4c",
        "cat": "youtube",
        "start": 1787926740000,
        "end": 1787930940000,
        "min": 69.67
      },
      {
        "id": "3cb430d3-4cf3-8104-b7d0-f556c54b6573",
        "cat": "youtube",
        "start": 1787993460000,
        "end": 1787997480000,
        "min": 67.83
      },
      {
        "id": "3cb430d3-4cf3-81c9-b0ae-db98376c2652",
        "cat": "youtube",
        "start": 1787997600000,
        "end": 1788001200000,
        "min": 60
      },
      {
        "id": "3cb430d3-4cf3-81bc-bc27-e04473d9a269",
        "cat": "youtube",
        "start": 1788008100000,
        "end": 1788012360000,
        "min": 70.72
      },
      {
        "id": "3cc430d3-4cf3-81f0-be2a-e3323be84bcc",
        "cat": "youtube",
        "start": 1788092100000,
        "end": 1788101880000,
        "min": 162.76
      },
      {
        "id": "3cc430d3-4cf3-8173-9cee-eda92a7f2236",
        "cat": "youtube",
        "start": 1788102180000,
        "end": 1788106260000,
        "min": 68.19
      },
      {
        "id": "3cc430d3-4cf3-814b-aae1-e765948783f4",
        "cat": "youtube",
        "start": 1788106560000,
        "end": 1788110460000,
        "min": 64.89
      },
      {
        "id": "3cc430d3-4cf3-8197-afd4-c56b007e458e",
        "cat": "youtube",
        "start": 1788113760000,
        "end": 1788120300000,
        "min": 109.02
      },
      {
        "id": "3cc430d3-4cf3-8119-8297-c2d3266deff1",
        "cat": "bricklink",
        "start": 1788120300000,
        "end": 1788122400000,
        "min": 34.91
      },
      {
        "id": "3cd430d3-4cf3-81d2-ae3c-eec0717aea33",
        "cat": "youtube",
        "start": 1788157860000,
        "end": 1788174840000,
        "min": 282.57
      },
      {
        "id": "3cd430d3-4cf3-81a0-a2e2-c2d6a8eb2b1e",
        "cat": "youtube",
        "start": 1788170400000,
        "end": 1788175800000,
        "min": 90
      },
      {
        "id": "3cd430d3-4cf3-812a-baf6-f6d8d750f472",
        "cat": "youtube",
        "start": 1788190020000,
        "end": 1788190380000,
        "min": 6.32
      },
      {
        "id": "3cd430d3-4cf3-8108-81b5-d5a0ace0b860",
        "cat": "bricklink",
        "start": 1788190380000,
        "end": 1788195540000,
        "min": 85.68
      },
      {
        "id": "3cd430d3-4cf3-81fb-946e-f6724580bc89",
        "cat": "youtube",
        "start": 1788195540000,
        "end": 1788198480000,
        "min": 48.66
      },
      {
        "id": "3cd430d3-4cf3-8107-a963-ec57ab206e56",
        "cat": "youtube",
        "start": 1788200820000,
        "end": 1788201060000,
        "min": 3.91
      },
      {
        "id": "3cd430d3-4cf3-813e-a420-e0576f1aba96",
        "cat": "bricklink",
        "start": 1788201060000,
        "end": 1788203940000,
        "min": 48.15
      },
      {
        "id": "3cd430d3-4cf3-819c-ba9e-cecc0c26c35a",
        "cat": "youtube",
        "start": 1788204060000,
        "end": 1788207780000,
        "min": 62.88
      },
      {
        "id": "3ce430d3-4cf3-8148-8df7-f184b8f04a09",
        "cat": "youtube",
        "start": 1788245400000,
        "end": 1788245580000,
        "min": 2.77
      },
      {
        "id": "3ce430d3-4cf3-818e-8096-db7e567d8999",
        "cat": "bricklink",
        "start": 1788245580000,
        "end": 1788247500000,
        "min": 32.1
      },
      {
        "id": "3ce430d3-4cf3-811c-8bb8-d19d23795882",
        "cat": "youtube",
        "start": 1788249240000,
        "end": 1788255420000,
        "min": 103.33
      },
      {
        "id": "3ce430d3-4cf3-81d2-9561-cc59d11f4000",
        "cat": "bricklink",
        "start": 1788255600000,
        "end": 1788256440000,
        "min": 13.95
      },
      {
        "id": "3ce430d3-4cf3-813b-845a-d3b0a68bf146",
        "cat": "youtube",
        "start": 1788256800000,
        "end": 1788257700000,
        "min": 15
      },
      {
        "id": "3ce430d3-4cf3-812c-9210-de919730d96b",
        "cat": "youtube",
        "start": 1788256800000,
        "end": 1788257700000,
        "min": 15
      },
      {
        "id": "3ce430d3-4cf3-81aa-bde7-e6bf44e274b9",
        "cat": "youtube",
        "start": 1788264540000,
        "end": 1788264600000,
        "min": 1.13
      },
      {
        "id": "3ce430d3-4cf3-81dd-be43-ee1d63b45085",
        "cat": "youtube",
        "start": 1788265680000,
        "end": 1788267420000,
        "min": 29.05
      },
      {
        "id": "3ce430d3-4cf3-81e1-a79b-d2f582a29fc6",
        "cat": "youtube",
        "start": 1788268260000,
        "end": 1788272340000,
        "min": 68.11
      },
      {
        "id": "3ce430d3-4cf3-817c-811d-f92248d1cddc",
        "cat": "youtube",
        "start": 1788273360000,
        "end": 1788276540000,
        "min": 53.57
      },
      {
        "id": "3ce430d3-4cf3-81d9-acec-fd4fc444cca5",
        "cat": "youtube",
        "start": 1788278040000,
        "end": 1788284220000,
        "min": 103.14
      },
      {
        "id": "3ce430d3-4cf3-8178-92cc-ce8c3f13c0f3",
        "cat": "youtube",
        "start": 1788289980000,
        "end": 1788291120000,
        "min": 18.59
      },
      {
        "id": "3cf430d3-4cf3-81df-bfb3-ffa5fc74b424",
        "cat": "youtube",
        "start": 1788326040000,
        "end": 1788327120000,
        "min": 18.08
      },
      {
        "id": "3d4430d3-4cf3-81c4-9ac6-e96c9b8e6d1f",
        "cat": "youtube",
        "start": 1788764820000,
        "end": 1788766080000,
        "min": 21.2
      },
      {
        "id": "3d4430d3-4cf3-8117-8b7d-c85b9e3156f2",
        "cat": "bricklink",
        "start": 1788766080000,
        "end": 1788768780000,
        "min": 45.4
      },
      {
        "id": "3d4430d3-4cf3-8188-8249-f7ac4c8849a6",
        "cat": "bricklink",
        "start": 1788769020000,
        "end": 1788770760000,
        "min": 28.25
      },
      {
        "id": "3d6430d3-4cf3-81a2-be67-df5fbf87771c",
        "cat": "youtube",
        "start": 1788861600000,
        "end": 1788867000000,
        "min": 90
      },
      {
        "id": "3d5430d3-4cf3-8123-90c2-e2b10eba1938",
        "cat": "youtube",
        "start": 1788873540000,
        "end": 1788874620000,
        "min": 18.11
      },
      {
        "id": "3d5430d3-4cf3-81c3-952b-e651eea3be2c",
        "cat": "youtube",
        "start": 1788876060000,
        "end": 1788876060000,
        "min": 0.31
      },
      {
        "id": "3d5430d3-4cf3-8113-b34f-fd8e949d974d",
        "cat": "youtube",
        "start": 1788879720000,
        "end": 1788881880000,
        "min": 35.89
      },
      {
        "id": "3d5430d3-4cf3-8180-98fb-c3c988b3ba9d",
        "cat": "youtube",
        "start": 1788883020000,
        "end": 1788883020000,
        "min": 0.2
      },
      {
        "id": "3d5430d3-4cf3-8117-8f3d-c3aba3eba76f",
        "cat": "bricklink",
        "start": 1788887280000,
        "end": 1788890040000,
        "min": 46.36
      },
      {
        "id": "3d6430d3-4cf3-81c2-bbe6-fca7f7c4fd92",
        "cat": "youtube",
        "start": 1788936600000,
        "end": 1788936960000,
        "min": 5.9
      },
      {
        "id": "3d6430d3-4cf3-8149-9fab-faa8cc93c4a8",
        "cat": "youtube",
        "start": 1788942540000,
        "end": 1788946140000,
        "min": 60.35
      },
      {
        "id": "3d6430d3-4cf3-810a-9de0-c1fdc8ba97d9",
        "cat": "youtube",
        "start": 1788953880000,
        "end": 1788958680000,
        "min": 80.75
      },
      {
        "id": "3d6430d3-4cf3-8142-b221-e7af092262fe",
        "cat": "bricklink",
        "start": 1788961200000,
        "end": 1788968760000,
        "min": 126.31
      },
      {
        "id": "3d6430d3-4cf3-8146-b185-d0483a6a3d16",
        "cat": "bricklink",
        "start": 1788969120000,
        "end": 1788969120000,
        "min": 0.04
      },
      {
        "id": "3d6430d3-4cf3-81c8-8b22-d89b05e610ab",
        "cat": "youtube",
        "start": 1788970380000,
        "end": 1788973500000,
        "min": 52.31
      },
      {
        "id": "3d6430d3-4cf3-81f8-9cfc-e00842843827",
        "cat": "youtube",
        "start": 1788977520000,
        "end": 1788982020000,
        "min": 75.29
      },
      {
        "id": "3d7430d3-4cf3-810c-bae9-d19ce6838bcc",
        "cat": "youtube",
        "start": 1789027560000,
        "end": 1789031520000,
        "min": 66.41
      },
      {
        "id": "3d8430d3-4cf3-81d5-a14a-e284db4dddc1",
        "cat": "youtube",
        "start": 1789034400000,
        "end": 1789039800000,
        "min": 90
      },
      {
        "id": "3d7430d3-4cf3-8199-83d5-d173142136ac",
        "cat": "youtube",
        "start": 1789034400000,
        "end": 1789037100000,
        "min": 45
      },
      {
        "id": "3d7430d3-4cf3-81fa-b78e-d28e301d1933",
        "cat": "youtube",
        "start": 1789046220000,
        "end": 1789048680000,
        "min": 41.24
      },
      {
        "id": "3d7430d3-4cf3-811a-b1b3-f1e7e77cfc73",
        "cat": "youtube",
        "start": 1789061220000,
        "end": 1789063920000,
        "min": 45.24
      },
      {
        "id": "3d8430d3-4cf3-81e3-a592-ed5b5ea8ec69",
        "cat": "youtube",
        "start": 1789110480000,
        "end": 1789113240000,
        "min": 45.88
      },
      {
        "id": "3db430d3-4cf3-817d-a99e-fd366f32dbfb",
        "cat": "bricklink",
        "start": 1789380000000,
        "end": 1789381800000,
        "min": 30
      },
      {
        "id": "3db430d3-4cf3-8112-9274-eb19cd86f8f3",
        "cat": "youtube",
        "start": 1789383060000,
        "end": 1789387500000,
        "min": 73.44
      },
      {
        "id": "3db430d3-4cf3-817f-a097-d52efea52d3a",
        "cat": "bricklink",
        "start": 1789395420000,
        "end": 1789397460000,
        "min": 33.99
      },
      {
        "id": "3db430d3-4cf3-8167-91e4-fb097d2d9edf",
        "cat": "youtube",
        "start": 1789401840000,
        "end": 1789402440000,
        "min": 10.17
      },
      {
        "id": "3db430d3-4cf3-811b-9496-f2dd76425c35",
        "cat": "bricklink",
        "start": 1789405500000,
        "end": 1789412340000,
        "min": 113.94
      },
      {
        "id": "3dc430d3-4cf3-8173-bc94-fff0e286959a",
        "cat": "youtube",
        "start": 1789466400000,
        "end": 1789468200000,
        "min": 30
      },
      {
        "id": "3dc430d3-4cf3-813a-8aa9-eb24b57d01e2",
        "cat": "youtube",
        "start": 1789470840000,
        "end": 1789473000000,
        "min": 36.39
      },
      {
        "id": "3dd430d3-4cf3-8165-b853-ed1dc51ab8c7",
        "cat": "youtube",
        "start": 1789552800000,
        "end": 1789554600000,
        "min": 30
      },
      {
        "id": "3dd430d3-4cf3-81a8-9ee6-d5d1174f18fd",
        "cat": "youtube",
        "start": 1789552800000,
        "end": 1789558200000,
        "min": 90
      },
      {
        "id": "3dd430d3-4cf3-81de-9866-f54361f8f4f6",
        "cat": "youtube",
        "start": 1789574580000,
        "end": 1789576080000,
        "min": 24.83
      },
      {
        "id": "3df430d3-4cf3-81e2-80b6-c2b2b0656fdd",
        "cat": "youtube",
        "start": 1789639200000,
        "end": 1789648200000,
        "min": 150
      },
      {
        "id": "3de430d3-4cf3-8174-942a-f98a1962694d",
        "cat": "youtube",
        "start": 1789639200000,
        "end": 1789642800000,
        "min": 60
      },
      {
        "id": "3de430d3-4cf3-81e0-9ccc-f7b97ab35a76",
        "cat": "youtube",
        "start": 1789647120000,
        "end": 1789648740000,
        "min": 26.26
      },
      {
        "id": "3de430d3-4cf3-8153-905b-c76e18251d80",
        "cat": "bricklink",
        "start": 1789656720000,
        "end": 1789660980000,
        "min": 71.4
      },
      {
        "id": "3de430d3-4cf3-81a1-b5f0-f7e24a7dad66",
        "cat": "youtube",
        "start": 1789662000000,
        "end": 1789664700000,
        "min": 44.83
      },
      {
        "id": "3df430d3-4cf3-8100-ae5d-d627148d9fd6",
        "cat": "bricklink",
        "start": 1789711500000,
        "end": 1789711500000,
        "min": 0.04
      },
      {
        "id": "3e0430d3-4cf3-813e-ad2b-e86952d65ed6",
        "cat": "youtube",
        "start": 1789725600000,
        "end": 1789727400000,
        "min": 30
      },
      {
        "id": "3e0430d3-4cf3-810a-b9c6-cb501586e993",
        "cat": "bricklink",
        "start": 1789725600000,
        "end": 1789731000000,
        "min": 90
      },
      {
        "id": "3df430d3-4cf3-811c-8b49-d5c74398b763",
        "cat": "bricklink",
        "start": 1789737660000,
        "end": 1789738980000,
        "min": 21.61
      },
      {
        "id": "3df430d3-4cf3-8163-b7f0-fe516fe0304d",
        "cat": "bricklink",
        "start": 1789739040000,
        "end": 1789744380000,
        "min": 89.11
      },
      {
        "id": "3df430d3-4cf3-819e-8d27-c12b74cd3eea",
        "cat": "youtube",
        "start": 1789744500000,
        "end": 1789748040000,
        "min": 58.86
      },
      {
        "id": "3e0430d3-4cf3-8125-8251-e596cbad1d75",
        "cat": "youtube",
        "start": 1789802760000,
        "end": 1789808940000,
        "min": 102.78
      },
      {
        "id": "3e1430d3-4cf3-8120-9d7f-d50e43d30a63",
        "cat": "youtube",
        "start": 1789812000000,
        "end": 1789817400000,
        "min": 90
      },
      {
        "id": "3e1430d3-4cf3-810b-982d-c4638d95c444",
        "cat": "youtube",
        "start": 1789906800000,
        "end": 1789909080000,
        "min": 37.64
      },
      {
        "id": "3e1430d3-4cf3-814a-b907-d64fa2f03204",
        "cat": "youtube",
        "start": 1789916160000,
        "end": 1789918140000,
        "min": 33.31
      },
      {
        "id": "3e1430d3-4cf3-81a0-85cc-ed579296c766",
        "cat": "bricklink",
        "start": 1789918140000,
        "end": 1789918320000,
        "min": 2.63
      },
      {
        "id": "3e1430d3-4cf3-8145-adf8-ea229ac3c88f",
        "cat": "bricklink",
        "start": 1789918680000,
        "end": 1789921380000,
        "min": 44.64
      },
      {
        "id": "3e1430d3-4cf3-8137-aee9-c799c1229076",
        "cat": "bricklink",
        "start": 1789925820000,
        "end": 1789935360000,
        "min": 159.16
      },
      {
        "id": "3e3430d3-4cf3-81f9-9405-c77fd4ce3f0f",
        "cat": "bricklink",
        "start": 1789984800000,
        "end": 1789990200000,
        "min": 90
      },
      {
        "id": "3e2430d3-4cf3-8141-8606-ef81b4cc7c45",
        "cat": "youtube",
        "start": 1789984800000,
        "end": 1789988400000,
        "min": 60
      },
      {
        "id": "3e2430d3-4cf3-810d-a381-dffbe2b7f576",
        "cat": "youtube",
        "start": 1790005740000,
        "end": 1790007300000,
        "min": 25.18
      },
      {
        "id": "3e2430d3-4cf3-81af-9b8a-ea1bf966445b",
        "cat": "youtube",
        "start": 1790011320000,
        "end": 1790013180000,
        "min": 30.85
      },
      {
        "id": "3e2430d3-4cf3-81a9-a0fb-d0ae343f341b",
        "cat": "youtube",
        "start": 1790014200000,
        "end": 1790014980000,
        "min": 12.95
      },
      {
        "id": "3e4430d3-4cf3-8177-a618-cc584c04dfcb",
        "cat": "bricklink",
        "start": 1790071200000,
        "end": 1790083800000,
        "min": 210
      },
      {
        "id": "3e3430d3-4cf3-8175-9ae2-e8ee8658ed89",
        "cat": "bricklink",
        "start": 1790078040000,
        "end": 1790080440000,
        "min": 40.47
      },
      {
        "id": "3e3430d3-4cf3-81bf-87a3-ce34a8b1c2f2",
        "cat": "youtube",
        "start": 1790078460000,
        "end": 1790080440000,
        "min": 32.46
      },
      {
        "id": "3e3430d3-4cf3-8177-b68c-f02bbbba219a",
        "cat": "youtube",
        "start": 1790081820000,
        "end": 1790088300000,
        "min": 107.19
      },
      {
        "id": "3e4430d3-4cf3-8199-9130-d1ba16833cd1",
        "cat": "bricklink",
        "start": 1790157600000,
        "end": 1790158200000,
        "min": 10
      },
      {
        "id": "3e4430d3-4cf3-8176-9a4b-d32b49ca2df6",
        "cat": "youtube",
        "start": 1790158560000,
        "end": 1790160600000,
        "min": 33.69
      },
      {
        "id": "3e4430d3-4cf3-81ec-9b6f-d6959df110b2",
        "cat": "youtube",
        "start": 1790165640000,
        "end": 1790184120000,
        "min": 308.43
      },
      {
        "id": "3e4430d3-4cf3-8128-96f5-ff84bb54c0aa",
        "cat": "bricklink",
        "start": 1790184720000,
        "end": 1790194680000,
        "min": 166.07
      },
      {
        "id": "3e5430d3-4cf3-814d-9093-edc9cbcaae13",
        "cat": "youtube",
        "start": 1790241540000,
        "end": 1790247540000,
        "min": 100.78
      },
      {
        "id": "3e6430d3-4cf3-816b-988e-ee58081c6bda",
        "cat": "bricklink",
        "start": 1790244000000,
        "end": 1790256600000,
        "min": 210
      },
      {
        "id": "3e5430d3-4cf3-812f-95d4-e473ea9b30fc",
        "cat": "youtube",
        "start": 1790269200000,
        "end": 1790269200000,
        "min": 0.53
      },
      {
        "id": "3e5430d3-4cf3-81ff-8f58-d573a18e4e6b",
        "cat": "youtube",
        "start": 1790269440000,
        "end": 1790270580000,
        "min": 18.96
      },
      {
        "id": "3e6430d3-4cf3-8160-89cd-cddc6e088421",
        "cat": "bricklink",
        "start": 1790330760000,
        "end": 1790332920000,
        "min": 35.25
      },
      {
        "id": "3e6430d3-4cf3-81e1-9dad-d2d67134cbb8",
        "cat": "bricklink",
        "start": 1790333880000,
        "end": 1790339580000,
        "min": 94.76
      },
      {
        "id": "3eb430d3-4cf3-8175-a88b-fc7e4c04539c",
        "cat": "youtube",
        "start": 1790793120000,
        "end": 1790795760000,
        "min": 44.04
      },
      {
        "id": "3ed430d3-4cf3-8135-aa09-cd7b90d94a0a",
        "cat": "youtube",
        "start": 1790922120000,
        "end": 1790926620000,
        "min": 75.02
      },
      {
        "id": "3ef430d3-4cf3-81cf-8874-fb4459c0ba03",
        "cat": "bricklink",
        "start": 1791104520000,
        "end": 1791108240000,
        "min": 61.77
      },
      {
        "id": "3ef430d3-4cf3-81ab-a7a7-d14e7d5f578e",
        "cat": "youtube",
        "start": 1791108000000,
        "end": 1791111600000,
        "min": 60
      },
      {
        "id": "3ef430d3-4cf3-8109-a933-e6b8b9f5e57b",
        "cat": "youtube",
        "start": 1791137040000,
        "end": 1791150540000,
        "min": 224.6
      },
      {
        "id": "3f0430d3-4cf3-81ad-a8ee-dd04eb236e9d",
        "cat": "youtube",
        "start": 1791190380000,
        "end": 1791193560000,
        "min": 53.64
      },
      {
        "id": "3f1430d3-4cf3-813f-b859-f9b373ab4635",
        "cat": "youtube",
        "start": 1791194400000,
        "end": 1791199800000,
        "min": 90
      },
      {
        "id": "3f0430d3-4cf3-8106-9ec6-ea96c49a7fb9",
        "cat": "youtube",
        "start": 1791206760000,
        "end": 1791215640000,
        "min": 147.64
      },
      {
        "id": "3f0430d3-4cf3-81ed-8980-d4a7263b408b",
        "cat": "bricklink",
        "start": 1791215640000,
        "end": 1791220440000,
        "min": 79.9
      },
      {
        "id": "3f1430d3-4cf3-8109-a146-ff1ee0726564",
        "cat": "youtube",
        "start": 1791289260000,
        "end": 1791296460000,
        "min": 120.18
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
