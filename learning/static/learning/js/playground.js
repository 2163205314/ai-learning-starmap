const app = document.getElementById("playgroundApp")
const dataElement = document.getElementById("playground-data")
const languageDataElement = document.getElementById("playground-languages")

if (app && dataElement && languageDataElement) {
  const challenges = JSON.parse(dataElement.textContent)
  const languages = JSON.parse(languageDataElement.textContent)
  const challengeMap = new Map(challenges.map((challenge) => [challenge.id, challenge]))
  const languageMap = new Map(languages.map((language) => [language.id, language]))
  const editor = document.getElementById("codeEditor")
  const lineNumbers = document.getElementById("lineNumbers")
  const output = document.getElementById("outputBody")
  const runButton = document.getElementById("runCode")
  const preview = document.getElementById("editorPreview")
  const previewFrame = document.getElementById("previewFrame")
  const workspace = document.getElementById("codeWorkspace")
  const csrfToken = document.querySelector("#runnerSecurity input[name=csrfmiddlewaretoken]")?.value || ""
  let currentChallenge = challenges[0]
  let currentLanguage = languages[0]
  let runnerOnline = null
  let runnerInfo = {}
  let saveTimer

  function readCompleted() {
    try {
      return new Set(JSON.parse(localStorage.getItem("atlas.playground.completed") || "[]"))
    } catch {
      return new Set()
    }
  }

  const completed = readCompleted()
  const storageKey = (challenge, language) => `atlas.playground.draft.${challenge.id}.${language.id}`
  const starterCode = () => (currentLanguage.id === "javascript" ? currentChallenge.starter_code : currentLanguage.starter_code)

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
    lineNumbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n")
  }

  function updateCursorPosition() {
    const beforeCursor = editor.value.slice(0, editor.selectionStart).split("\n")
    setText("cursorPosition", `Ln ${beforeCursor.length}, Col ${beforeCursor.at(-1).length + 1}`)
  }

  function loadDraft() {
    const draft = localStorage.getItem(storageKey(currentChallenge, currentLanguage))
    editor.value = draft ?? starterCode()
    setText("draftState", draft === null ? "新建本地草稿" : "已恢复本地草稿")
    updateLineNumbers()
    updateCursorPosition()
    editor.scrollTop = 0
    lineNumbers.scrollTop = 0
    if (currentLanguage.mode === "preview") renderPreview(true)
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
    loadDraft()
    clearOutput()
    editor.focus()
  }

  function configureRunButton() {
    runButton.replaceChildren()
    if (currentLanguage.mode === "worker" || currentLanguage.mode === "server") {
      for (const value of ["Ctrl", "↵"]) {
        const key = document.createElement("kbd")
        key.textContent = value
        runButton.append(key)
      }
      runButton.append(currentLanguage.mode === "worker" ? " 运行测试" : " 运行代码")
      return
    }
    runButton.textContent = currentLanguage.mode === "preview" ? "刷新预览" : "查看运行说明"
  }

  function updateRuntimeStatus() {
    const light = document.getElementById("runtimeLight")
    if (currentLanguage.mode !== "server") {
      setText("runtimeName", currentLanguage.runtime)
      setText("runtimeDetail", currentLanguage.detail)
      setText("terminalConnection", currentLanguage.mode === "worker" ? "WORKER::READY" : "PREVIEW::ISOLATED")
      light.classList.remove("offline")
      return
    }
    if (runnerOnline === null) {
      setText("runtimeName", "RUNNER CHECKING")
      setText("runtimeDetail", currentLanguage.detail)
      setText("terminalConnection", "RUNNER::CHECKING")
      light.classList.remove("offline")
    } else if (runnerOnline) {
      const toolchainReady = runnerInfo.toolchains?.[currentLanguage.id] !== false
      const localMode = runnerInfo.executionMode === "local"
      setText("runtimeName", toolchainReady ? (localMode ? `LOCAL ${currentLanguage.label.toUpperCase()}` : currentLanguage.runtime) : "TOOLCHAIN MISSING")
      setText("runtimeDetail", toolchainReady ? (localMode ? "TRUSTED CODE · TEMP CLEANUP" : currentLanguage.detail) : `INSTALL ${currentLanguage.label.toUpperCase()} TOOLCHAIN`)
      setText("terminalConnection", toolchainReady ? (localMode ? "RUNNER::LOCAL" : "RUNNER::DOCKER") : "RUNNER::TOOLCHAIN_MISSING")
      light.classList.toggle("offline", !toolchainReady)
    } else {
      setText("runtimeName", "RUNNER OFFLINE")
      setText("runtimeDetail", "CHECK RUNNER.CONFIG")
      setText("terminalConnection", "RUNNER::OFFLINE")
      light.classList.add("offline")
    }
  }

  async function checkRunnerHealth() {
    try {
      const response = await fetch(app.dataset.runnerHealthUrl, { credentials: "same-origin" })
      const data = await response.json()
      runnerOnline = Boolean(data.ok)
      runnerInfo = data
    } catch {
      runnerOnline = false
    }
    updateRuntimeStatus()
  }

  function renderLanguage(language) {
    currentLanguage = language
    document.querySelectorAll(".language-tab").forEach((button) => {
      const active = button.dataset.languageId === language.id
      button.classList.toggle("active", active)
      button.setAttribute("aria-selected", String(active))
      button.tabIndex = active ? 0 : -1
    })
    workspace.dataset.language = language.id
    workspace.classList.toggle("preview-active", language.mode === "preview")
    preview.hidden = language.mode !== "preview"
    setText("languageBadge", language.badge)
    setText("activeFilename", language.filename)
    setText("promptFilename", language.filename)
    setText("editorMode", language.mode.toUpperCase())
    setText("languageStatus", language.label)
    updateRuntimeStatus()
    editor.setAttribute("aria-label", `${language.label} 代码编辑器`)
    configureRunButton()
    loadDraft()
    clearOutput()
    editor.focus()
  }

  function outputPlaceholder(message) {
    output.replaceChildren()
    const placeholder = document.createElement("p")
    placeholder.className = "output-placeholder"
    const prompt = document.createElement("span")
    prompt.textContent = "›"
    placeholder.append(prompt, ` ${message}`)
    output.append(placeholder)
  }

  function clearOutput() {
    if (currentLanguage.mode === "worker") {
      outputPlaceholder("等待运行。按 Ctrl + Enter 执行当前 JavaScript。")
    } else if (currentLanguage.mode === "preview") {
      outputPlaceholder("沙箱预览已就绪。按 Ctrl + Enter 刷新。")
    } else {
      outputPlaceholder(`${currentLanguage.label} Runner 已待命。按 Ctrl + Enter 编译并运行。`)
    }
  }

  function showRunning(challenge) {
    outputPlaceholder(`正在启动 ${challenge.entry_point}()...`)
  }

  function appendLog(message) {
    const line = document.createElement("p")
    line.className = "output-log"
    line.textContent = message
    output.append(line)
  }

  function renderResult(data, challenge) {
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
    status.textContent = allPassed ? `MISSION PASSED · +${challenge.xp} XP` : `${passed}/${data.results.length} TESTS PASSED`
    const duration = document.createElement("span")
    duration.textContent = `${data.duration}ms`
    summary.append(status, duration)
    output.append(summary)

    if (allPassed) {
      completed.add(challenge.id)
      localStorage.setItem("atlas.playground.completed", JSON.stringify([...completed]))
      updateProgress()
    }
  }

  function buildPreviewDocument() {
    const policy = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:\">"
    if (currentLanguage.id === "html") return `${policy}${editor.value}`
    const safeCss = editor.value.replace(/<\/style/gi, "<\\/style")
    return `${policy}<main class="preview-card"><span>CSS_SIGNAL</span><h1>Style systems online.</h1><p>调整变量、间距和边框，观察终端卡片如何变化。</p></main><style>${safeCss}</style>`
  }

  function renderPreview(quiet = false) {
    previewFrame.srcdoc = buildPreviewDocument()
    if (quiet) return
    output.replaceChildren()
    appendLog(`[preview] ${currentLanguage.filename} 已刷新`)
    const summary = document.createElement("div")
    summary.className = "run-summary"
    const status = document.createElement("strong")
    status.textContent = "PREVIEW UPDATED"
    const detail = document.createElement("span")
    detail.textContent = "脚本与网络已禁用"
    summary.append(status, detail)
    output.append(summary)
  }

  function renderServerResult(data) {
    output.replaceChildren()
    if (data.stdout) appendLog(`[stdout]\n${data.stdout}`)
    if (data.stderr) {
      const errorOutput = document.createElement("p")
      errorOutput.className = "output-log output-stderr"
      errorOutput.textContent = `[stderr]\n${data.stderr}`
      output.append(errorOutput)
    }
    if (data.message) {
      const error = document.createElement("p")
      error.className = "runtime-error"
      error.textContent = data.message
      output.append(error)
    }
    if (data.timedOut) {
      const timeout = document.createElement("p")
      timeout.className = "runtime-error"
      timeout.textContent = "TimeoutError: 执行超过 3 秒，Runner 已终止任务。"
      output.append(timeout)
    }
    if (data.outputLimited) {
      const limit = document.createElement("p")
      limit.className = "runtime-error"
      limit.textContent = "OutputLimitError: 输出超过 128KB，Runner 已终止任务。"
      output.append(limit)
    }
    if (!data.stdout && !data.stderr && !data.message && !data.timedOut && !data.outputLimited) appendLog("[stdout]\n（程序没有输出）")

    const summary = document.createElement("div")
    summary.className = `run-summary ${data.ok ? "" : "failed"}`
    const status = document.createElement("strong")
    status.textContent = data.ok ? "PROCESS EXITED SUCCESSFULLY" : `${(data.phase || "runner").toUpperCase()} FAILED`
    const detail = document.createElement("span")
    const mode = data.executionMode === "local" ? "LOCAL" : data.executionMode === "docker" ? "DOCKER" : "RUNNER"
    detail.textContent = `${mode} · EXIT ${data.exitCode ?? "-"} · ${data.duration ?? 0}ms`
    summary.append(status, detail)
    output.append(summary)
  }

  async function runServerLanguage() {
    runButton.disabled = true
    runButton.textContent = "运行中..."
    outputPlaceholder(`正在把 ${currentLanguage.filename} 发送到 Runner...`)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 13000)
    try {
      const response = await fetch(app.dataset.runnerUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
        body: JSON.stringify({ language: currentLanguage.id, source: editor.value }),
        signal: controller.signal,
      })
      const data = await response.json()
      runnerOnline = response.status !== 503
      if (data.executionMode) runnerInfo.executionMode = data.executionMode
      updateRuntimeStatus()
      renderServerResult(data)
    } catch (error) {
      runnerOnline = false
      updateRuntimeStatus()
      renderServerResult({
        ok: false,
        phase: "runner",
        message: error.name === "AbortError" ? "Runner 请求超时，请检查 runner.config 对应的运行环境。" : `RunnerError: ${error.message}`,
      })
    } finally {
      window.clearTimeout(timeout)
      runButton.disabled = false
      configureRunButton()
    }
  }

  function runJavascript() {
    const challenge = currentChallenge
    runButton.disabled = true
    runButton.textContent = "运行中..."
    showRunning(challenge)
    const worker = new Worker(app.dataset.workerUrl)
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      worker.terminate()
      runButton.disabled = false
      configureRunButton()
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
      renderResult(data, challenge)
      finish()
    }
    worker.onerror = (event) => {
      window.clearTimeout(timeout)
      renderResult({ ok: false, error: `WorkerError: ${event.message}` }, challenge)
      finish()
    }
    worker.postMessage({
      language: "javascript",
      source: editor.value,
      entryPoint: challenge.entry_point,
      tests: challenge.tests,
    })
  }

  function runCode() {
    if (currentLanguage.mode === "worker") runJavascript()
    else if (currentLanguage.mode === "server") runServerLanguage()
    else if (currentLanguage.mode === "preview") renderPreview()
  }

  document.querySelector(".challenge-list").addEventListener("click", (event) => {
    const button = event.target.closest(".challenge-item")
    const challenge = button && challengeMap.get(button.dataset.challengeId)
    if (challenge) renderChallenge(challenge)
  })

  document.querySelector(".language-switcher").addEventListener("click", (event) => {
    const button = event.target.closest(".language-tab")
    const language = button && languageMap.get(button.dataset.languageId)
    if (language) renderLanguage(language)
  })
  document.querySelector(".language-switcher").addEventListener("keydown", (event) => {
    if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return
    const tabs = [...document.querySelectorAll(".language-tab")]
    const currentIndex = tabs.indexOf(document.activeElement)
    if (currentIndex < 0) return
    event.preventDefault()
    let nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : currentIndex + (event.key === "ArrowRight" ? 1 : -1)
    nextIndex = (nextIndex + tabs.length) % tabs.length
    tabs[nextIndex].focus()
    tabs[nextIndex].click()
  })

  editor.addEventListener("input", () => {
    updateLineNumbers()
    updateCursorPosition()
    setText("draftState", "正在保存...")
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      localStorage.setItem(storageKey(currentChallenge, currentLanguage), editor.value)
      setText("draftState", "草稿已保存在本地")
      if (currentLanguage.mode === "preview") renderPreview(true)
    }, 250)
  })

  editor.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editor.scrollTop
  })
  editor.addEventListener("click", updateCursorPosition)
  editor.addEventListener("keyup", updateCursorPosition)
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
  document.getElementById("copyCode").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor.value)
      setText("draftState", "代码已复制")
    } catch {
      setText("draftState", "复制失败，请手动选择代码")
      editor.focus()
      editor.select()
    }
  })
  document.getElementById("resetCode").addEventListener("click", () => {
    editor.value = starterCode()
    localStorage.removeItem(storageKey(currentChallenge, currentLanguage))
    setText("draftState", "已重置为初始代码")
    updateLineNumbers()
    updateCursorPosition()
    if (currentLanguage.mode === "preview") renderPreview(true)
    clearOutput()
    editor.focus()
  })

  updateProgress()
  renderLanguage(currentLanguage)
  renderChallenge(currentChallenge)
  checkRunnerHealth()
}
