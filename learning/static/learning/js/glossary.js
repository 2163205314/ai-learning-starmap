document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".concept-toggle")
  if (toggle) toggle.closest(".concept-card").classList.toggle("open")
  const related = event.target.closest(".related-list a")
  if (related) {
    const target = document.querySelector(related.getAttribute("href"))
    if (target) {
      target.classList.add("open")
      setTimeout(() => target.classList.remove("pulse"), 900)
    }
  }
})
