const app = document.getElementById("playgroundApp")
const dataElement = document.getElementById("playground-data")

if (app && dataElement) {
  const challenges = JSON.parse(dataElement.textContent)
  const challengeMap = new Map(challenges.map((challenge) => [challenge.id, challenge]))
  const editor = document.getElementById("codeEditor")
  const output = document.getElementById("outputBody")
  const runButton = document.getElementById("runCode")
  const completed = new Set(JSON.parse(localStorage.getItem("atlas.playground.completed") || "[]"))
  let currentChallenge = challenges[0]
  let saveTimer

  const storageKey = (challenge) => `atlas.playground.draft.${challenge.id}`

  function setText(id, value) {
    const element = document.getElementById(id)
    if (element) element.textContent = value
  }

  function updateProgress() {
    setText("missionProgress", `${completed.size}/${challenges.length}`)
    document.querySelectorAll(".challenge-item").forEach((button) => {
      button.classList.toggle("completed", completed.has(button.dataset.challengeId))
    })
  }

  function updateLineNumbers() {
    const count = Math.max(1, editor.value.split("\n").length)
    document.getElementById("lineNumbers").textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n")
  }

  function renderChallenge(challenge) {
    currentChallenge = challenge
    document.querySelectorAll(".challenge-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.challengeId === challenge.id)
    })
    setText("challengeIndex", `MISSION_${challenge.index}`)
    setText("challengeDifficulty", challenge.difficulty)
    setText("challengeXp", `+${challenge.xp} XP`)
    setText("challengeTitle", challenge.title)
    setText("challengeBrief", challenge.brief)
    setText("challengeHint", challenge.hint)
    document.getElementById("challengeConcepts").replaceChildren(
      ...challenge.concepts.map((concept) => {
        const tag = document.createElement("span")
        tag.textContent = concept
        return tag
      }),
    )
    editor.value = localStorage.getItem(storageKey(challenge)) || challenge.starter_code
    setText("draftState", localStorage.getItem(storageKey(challenge)) ? "已恢复本地草稿" : "新建本地草稿")
    updateLineNumbers()
    clearOutput()
    editor.focus()
  }

  function clearOutput() {
    output.replaceChildren()
    const placeholder = document.createElement("p")
    placeholder.className = "output-placeholder"
    placeholder.textContent = "› 等待运行。按 Ctrl + Enter 执行当前代码。"
    output.append(placeholder)
  }

  function showRunning() {
    output.replaceChildren()
    const line = document.createElement("p")
    line.className = "output-placeholder"
    line.textContent = `› 正在启动 ${currentChallenge.entry_point}()...`
    output.append(line)
  }

  function appendLog(message) {
    const line = document.createElement("p")
    line.className = "output-log"
    line.textContent = message
    output.append(line)
  }

  function renderResult(data) {
    output.replaceChildren()
    data.logs?.forEach((log) => appendLog(`[${log.level}] ${log.message}`))

    if (!data.ok) {
      const error = document.createElement("p")
      error.className = "runtime-error"
      error.textContent = data.error
      output.append(error)
      return
    }

    data.results.forEach((result) => {
      const row = document.createElement("div")
      row.className = `test-line ${result.pass ? "pass" : "fail"}`
      const icon = document.createElement("i")
      icon.textContent = result.pass ? "✓" : "×"
      const label = document.createElement("b")
      label.textContent = result.label
      const detail = document.createElement("small")
      detail.textContent = result.pass ? `得到 ${result.actual}` : `得到 ${result.actual} · 期望 ${result.expected}`
      row.append(icon, label, detail)
      output.append(row)
    })

    const passed = data.results.filter((result) => result.pass).length
    const allPassed = passed === data.results.length
    const summary = document.createElement("div")
    summary.className = `run-summary ${allPassed ? "" : "failed"}`
    const status = document.createElement("strong")
    status.textContent = allPassed ? `MISSION PASSED · +${currentChallenge.xp} XP` : `${passed}/${data.results.length} TESTS PASSED`
    const duration = document.createElement("span")
    duration.textContent = `${data.duration}ms`
    summary.append(status, duration)
    output.append(summary)

    if (allPassed) {
      completed.add(currentChallenge.id)
      localStorage.setItem("atlas.playground.completed", JSON.stringify([...completed]))
      updateProgress()
    }
  }

  function runCode() {
    runButton.disabled = true
    runButton.textContent = "运行中..."
    showRunning()
    const worker = new Worker(app.dataset.workerUrl)
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      worker.terminate()
      runButton.disabled = false
      runButton.innerHTML = "<kbd>Ctrl</kbd><kbd>↵</kbd> 运行代码"
    }

    const timeout = window.setTimeout(() => {
      const error = document.createElement("p")
      error.className = "runtime-error"
      error.textContent = "TimeoutError: 运行超过 2000ms，任务已终止。请检查是否存在无限循环。"
      output.replaceChildren(error)
      finish()
    }, 2000)

    worker.onmessage = ({ data }) => {
      window.clearTimeout(timeout)
      renderResult(data)
      finish()
    }
    worker.onerror = (event) => {
      window.clearTimeout(timeout)
      renderResult({ ok: false, error: `WorkerError: ${event.message}` })
      finish()
    }
    worker.postMessage({
      source: editor.value,
      entryPoint: currentChallenge.entry_point,
      tests: currentChallenge.tests,
    })
  }

  document.querySelector(".challenge-list").addEventListener("click", (event) => {
    const button = event.target.closest(".challenge-item")
    const challenge = button && challengeMap.get(button.dataset.challengeId)
    if (challenge) renderChallenge(challenge)
  })

  editor.addEventListener("input", () => {
    updateLineNumbers()
    setText("draftState", "正在保存...")
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      localStorage.setItem(storageKey(currentChallenge), editor.value)
      setText("draftState", "草稿已保存在本地")
    }, 250)
  })

  editor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault()
      runCode()
    }
    if (event.key === "Tab") {
      event.preventDefault()
      const start = editor.selectionStart
      editor.setRangeText("  ", start, editor.selectionEnd, "end")
      editor.dispatchEvent(new Event("input"))
    }
  })

  runButton.addEventListener("click", runCode)
  document.getElementById("clearOutput").addEventListener("click", clearOutput)
  document.getElementById("resetCode").addEventListener("click", () => {
    editor.value = currentChallenge.starter_code
    localStorage.removeItem(storageKey(currentChallenge))
    setText("draftState", "已重置为初始代码")
    updateLineNumbers()
    clearOutput()
    editor.focus()
  })

  updateProgress()
  renderChallenge(currentChallenge)
}
