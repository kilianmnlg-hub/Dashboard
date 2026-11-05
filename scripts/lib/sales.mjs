// Shop-Radar (Bestseller): macht aus den Positionen der Bestellungen (GET /orders/{id}/items) NUR Zahlen und je Monat die meistverkauften Artikel.
// Gespeichert wird später data.bricklinkSales. Die Positionen enthalten keine Kundendaten (nur Artikel, Menge, Preis), und je Bestellung wird nichts
// gespeichert, nur die Summen je Monat und die Top-Liste. Im Protokoll (öffentliches Repo) steht nichts davon.
// Reine Funktionen ohne Node-Abhängigkeiten, damit sie sich auch im Browser testen lassen (wie lib/uploads.mjs).
//
// Ein Artikel ist Typ + Nummer + Farbe; neu und gebraucht zählen zusammen. Die Reihenfolge richtet sich nach der Stückzahl, bei gleicher Stückzahl nach dem Umsatz.
// Umsatz ist Stückzahl mal Preis der Position (unit_price_final, sonst unit_price) in der Währung des Shops.

export const TOP_COUNT = 10;

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

// orders: [{ month: "JJJJ-MM", items: [Positionen aus der API] }]; liefert { checkedAt, currency, months: [{ month, orders, units, revenue, top }] }, älteste Monate zuerst
export function summarizeSales(orders, { top = TOP_COUNT, now = new Date(), currency = "EUR" } = {}) {
  const months = new Map();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (!o || typeof o.month !== "string" || !/^\d{4}-\d{2}$/.test(o.month)) continue;
    let m = months.get(o.month);
    if (!m) months.set(o.month, (m = { month: o.month, orders: 0, units: 0, revenue: 0, by: new Map() }));
    m.orders += 1;
    const seen = new Set();
    for (const it of Array.isArray(o.items) ? o.items : []) {
      const qty = num(it && it.quantity);
      const no = it && it.item && it.item.no != null ? String(it.item.no) : "";
      if (!(qty > 0) || !no) continue;
      const type = String(it.item.type || "").toUpperCase();
      const color = num(it.color_id) || 0;
      const price = num(it.unit_price_final) ?? num(it.unit_price) ?? 0;
      m.units += qty;
      m.revenue += qty * price;
      const key = `${type}|${no}|${color}`;
      let row = m.by.get(key);
      if (!row) m.by.set(key, (row = { t: type, no, name: String(it.item.name || "").slice(0, 120), color, colorName: String(it.color_name || "").slice(0, 40), qty: 0, revenue: 0, orders: 0 }));
      row.qty += qty;
      row.revenue += qty * price;
      if (!seen.has(key)) { seen.add(key); row.orders += 1; }
    }
  }
  return {
    checkedAt: now.toISOString(),
    currency: currency || "EUR",
    months: [...months.values()]
      .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
      .map((m) => ({
        month: m.month, orders: m.orders, units: m.units, revenue: round2(m.revenue),
        top: [...m.by.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, top).map((r) => ({ ...r, revenue: round2(r.revenue) }))
      }))
  };
}
