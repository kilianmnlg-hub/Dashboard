/* Nach-oben-Knopf (nur am Rechner, siehe .to-top in styles.css): erscheint klein unten rechts, sobald du ein Stueck gescrollt hast, und
   scrollt zum Seitenanfang (weich, ausser bei "weniger Bewegung"). Merkt sich nichts, schreibt nichts. Am Handy gibt es dafuer das Sprungmenue. */
(function () {
  const btn = document.getElementById("toTop");
  if (!btn) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let on = false, queued = false;
  const update = () => {
    queued = false;
    const show = window.scrollY > Math.max(480, window.innerHeight * 0.7);
    if (show === on) return;
    on = show;
    btn.classList.toggle("on", show);
  };
  window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    btn.blur();
  });
  update();
})();
