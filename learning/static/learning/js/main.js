document.addEventListener("click", (event) => {
  const stepHead = event.target.closest(".step-head")
  if (stepHead) {
    const step = stepHead.closest(".project-step")
    const states = ["todo", "doing", "done"]
    const labels = { todo: "待完成", doing: "进行中", done: "已完成" }
    const next = states[(states.indexOf(step.dataset.state) + 1) % states.length]
    step.dataset.state = next
    step.classList.add("open")
    stepHead.querySelector("b").textContent = labels[next]
  }
})
