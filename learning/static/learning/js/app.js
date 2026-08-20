const navToggle = document.querySelector(".nav-toggle")
const mainNav = document.getElementById("main-nav")

function setNavigation(open) {
  if (!navToggle || !mainNav) return
  mainNav.classList.toggle("open", open)
  navToggle.setAttribute("aria-expanded", String(open))
}

navToggle?.addEventListener("click", () => {
  setNavigation(!mainNav.classList.contains("open"))
})

mainNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) setNavigation(false)
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNavigation(false)
})

document.addEventListener("click", (event) => {
  if (mainNav?.classList.contains("open") && !event.target.closest(".site-header")) {
    setNavigation(false)
  }
})
