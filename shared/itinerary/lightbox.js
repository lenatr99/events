(function () {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const counter = document.getElementById("lightboxCounter");
  const prevBtn = lightbox.querySelector(".lightbox-prev");
  const nextBtn = lightbox.querySelector(".lightbox-next");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  let group = [];
  let index = 0;

  function show(i) {
    if (!group.length) return;
    index = (i + group.length) % group.length;
    const img = group[index];
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "";
    counter.textContent = `${index + 1} / ${group.length}`;
    const onlyOne = group.length <= 1;
    prevBtn.style.display = onlyOne ? "none" : "";
    nextBtn.style.display = onlyOne ? "none" : "";
    counter.style.display = onlyOne ? "none" : "";
  }

  function open(target) {
    const gridEl = target.closest(".local-photo-grid");
    group = gridEl ? Array.from(gridEl.querySelectorAll("img")) : [target];
    show(group.indexOf(target));
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lightboxImg.src = "";
  }

  document.querySelectorAll(".local-photo-grid img").forEach((img) => {
    img.addEventListener("click", () => open(img));
  });

  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); show(index - 1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); show(index + 1); });
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target === lightboxImg) close();
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowLeft") show(index - 1);
    else if (event.key === "ArrowRight") show(index + 1);
  });

  let touchStartX = null;
  lightbox.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });
})();
