const cards = Array.from(document.querySelectorAll(".knowledge-card"))
const quizzes = Array.from(document.querySelectorAll(".quiz-card"))
const seen = new Set()
const answered = new Set()
const correct = new Set()

function updateProgress() {
  const setBar = (id, value, total) => {
    const el = document.getElementById(id)
    if (el) el.style.width = `${total ? Math.round(value / total * 100) : 0}%`
  }
  document.getElementById("seenCount").textContent = seen.size
  document.getElementById("answeredCount").textContent = answered.size
  document.getElementById("correctCount").textContent = correct.size
  setBar("seenBar", seen.size, cards.length)
  setBar("answeredBar", answered.size, quizzes.length)
  setBar("correctBar", correct.size, quizzes.length)
}

document.addEventListener("click", async (event) => {
  const cardToggle = event.target.closest(".card-toggle")
  if (cardToggle) {
    const card = cardToggle.closest(".knowledge-card")
    card.classList.toggle("card-selected")
    seen.add(card.dataset.cardId)
    updateProgress()
  }
  const sectionToggle = event.target.closest(".section-toggle")
  if (sectionToggle) sectionToggle.closest(".section-card").classList.toggle("open")
  const option = event.target.closest(".quiz-options button")
  if (option) {
    const quiz = option.closest(".quiz-card")
    const form = new FormData()
    form.append("quiz_id", quiz.dataset.quizId)
    form.append("selected", option.dataset.index)
    const response = await fetch("/api/quiz/check/", { method: "POST", body: form, headers: { "X-CSRFToken": getCookie("csrftoken") } })
    const data = await response.json()
    quiz.querySelectorAll("button").forEach((button) => {
      button.disabled = true
      if (Number(button.dataset.index) === data.correctIndex) button.classList.add("correct")
    })
    if (!data.correct) option.classList.add("wrong")
    quiz.querySelector(".quiz-result").textContent = `${data.correct ? "回答正确" : "回答错误"}：${data.explanation}`
    answered.add(quiz.dataset.quizId)
    if (data.correct) correct.add(quiz.dataset.quizId)
    updateProgress()
  }
})

function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(";").shift()
  return ""
}

updateProgress()
