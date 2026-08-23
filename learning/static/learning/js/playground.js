const app = document.getElementById("playgroundApp")
const dataElement = document.getElementById("playground-data")
const languageDataElement = document.getElementById("playground-languages")

if (app && dataElement && languageDataElement) {
  const challenges = JSON.parse(dataElement.textContent)
  const languages = JSON.parse(languageDataElement.textContent)
  const challengeMap = new Map(challenges.map((challenge) => [challenge.id, challenge]))
  const languageMap = new Map(languages.map((language) => [language.id, language]))
  const fallbackEditor = document.getElementById("codeEditor")
  const monacoHost = document.getElementById("monacoEditor")
  const languageSelect = document.getElementById("languageSelect")
  const languageSelectBadge = document.getElementById("languageSelectBadge")
  const intelligenceStatus = document.getElementById("intelligenceStatus")
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
  let monacoEditor = null
  let pythonLsp = null
  let changingEditorValue = false

  const monacoLanguageIds = {
    javascript: "javascript",
    python: "python",
    c: "c",
    cpp: "cpp",
    java: "java",
    html: "html",
    css: "css",
  }

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

  function setIntelligenceStatus(state, message) {
    intelligenceStatus.dataset.state = state
    intelligenceStatus.querySelector("span").textContent = `智能提示 · ${message}`
  }

  function syncLanguageIntelligence() {
    if (!monacoEditor) {
      setIntelligenceStatus("basic", "BASIC")
      return
    }
    if (currentLanguage.id === "python") {
      if (pythonLsp) pythonLsp.activate(monacoEditor.getModel())
      else setIntelligenceStatus("offline", "PYRIGHT OFFLINE")
      return
    }
    pythonLsp?.deactivate()
    if (["javascript", "html", "css"].includes(currentLanguage.id)) setIntelligenceStatus("builtin", "MONACO BUILT-IN")
    else setIntelligenceStatus("basic", "BASIC")
  }

  function getEditorValue() {
    return monacoEditor ? monacoEditor.getValue() : fallbackEditor.value
  }

  function setEditorValue(value) {
    fallbackEditor.value = value
    if (!monacoEditor || monacoEditor.getValue() === value) return
    changingEditorValue = true
    monacoEditor.setValue(value)
    changingEditorValue = false
  }

  function focusEditor() {
    if (monacoEditor) monacoEditor.focus()
    else fallbackEditor.focus()
  }

  function selectEditorContent() {
    if (monacoEditor) {
      const model = monacoEditor.getModel()
      monacoEditor.setSelection(model.getFullModelRange())
      monacoEditor.focus()
    } else {
      fallbackEditor.focus()
      fallbackEditor.select()
    }
  }

  function setEditorLanguage(language) {
    const ariaLabel = `${language.label} 代码编辑器`
    fallbackEditor.setAttribute("aria-label", ariaLabel)
    monacoHost.setAttribute("aria-label", ariaLabel)
    if (!monacoEditor) return
    window.monaco.editor.setModelLanguage(monacoEditor.getModel(), monacoLanguageIds[language.id])
    monacoEditor.updateOptions({ ariaLabel })
  }

  function updateProgress() {
    setText("missionProgress", `${completed.size}/${challenges.length}`)
    document.querySelectorAll(".challenge-item").forEach((button) => {
      button.classList.toggle("completed", completed.has(button.dataset.challengeId))
    })
  }

  function updateCursorPosition() {
    if (monacoEditor) {
      const position = monacoEditor.getPosition()
      setText("cursorPosition", `Ln ${position.lineNumber}, Col ${position.column}`)
      return
    }
    const beforeCursor = fallbackEditor.value.slice(0, fallbackEditor.selectionStart).split("\n")
    setText("cursorPosition", `Ln ${beforeCursor.length}, Col ${beforeCursor.at(-1).length + 1}`)
  }

  function loadDraft() {
    const draft = localStorage.getItem(storageKey(currentChallenge, currentLanguage))
    setEditorValue(draft ?? starterCode())
    setText("draftState", draft === null ? "新建本地草稿" : "已恢复本地草稿")
    updateCursorPosition()
    if (monacoEditor) monacoEditor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 })
    else fallbackEditor.scrollTop = 0
    pythonLsp?.documentChanged()
    if (currentLanguage.mode === "preview") renderPreview(true)
  }

  function renderChallenge(challenge, shouldFocus = true) {
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
    if (shouldFocus) focusEditor()
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

  function renderLanguage(language, shouldFocus = true) {
    currentLanguage = language
    languageSelect.value = language.id
    languageSelectBadge.textContent = language.badge
    workspace.dataset.language = language.id
    workspace.classList.toggle("preview-active", language.mode === "preview")
    preview.hidden = language.mode !== "preview"
    setText("languageBadge", language.badge)
    setText("activeFilename", language.filename)
    setText("promptFilename", language.filename)
    setText("editorMode", language.mode.toUpperCase())
    setText("languageStatus", language.label)
    updateRuntimeStatus()
    setEditorLanguage(language)
    configureRunButton()
    loadDraft()
    syncLanguageIntelligence()
    clearOutput()
    if (shouldFocus) focusEditor()
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
    if (currentLanguage.id === "html") return `${policy}${getEditorValue()}`
    const safeCss = getEditorValue().replace(/<\/style/gi, "<\\/style")
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
        body: JSON.stringify({ language: currentLanguage.id, source: getEditorValue() }),
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
      source: getEditorValue(),
      entryPoint: challenge.entry_point,
      tests: challenge.tests,
    })
  }

  function runCode() {
    if (currentLanguage.mode === "worker") runJavascript()
    else if (currentLanguage.mode === "server") runServerLanguage()
    else if (currentLanguage.mode === "preview") renderPreview()
  }

  function handleEditorInput() {
    updateCursorPosition()
    setText("draftState", "正在保存...")
    window.clearTimeout(saveTimer)
    const draftKey = storageKey(currentChallenge, currentLanguage)
    const draftValue = getEditorValue()
    const shouldRefreshPreview = currentLanguage.mode === "preview"
    saveTimer = window.setTimeout(() => {
      localStorage.setItem(draftKey, draftValue)
      setText("draftState", "草稿已保存在本地")
      if (shouldRefreshPreview && draftKey === storageKey(currentChallenge, currentLanguage)) renderPreview(true)
    }, 250)
  }

  function initializeMonacoEditor() {
    if (!window.require?.config || !app.dataset.monacoBaseUrl) {
      setText("editorEngine", "BASIC FALLBACK")
      return
    }

    window.require.config({
      paths: { vs: `${app.dataset.monacoBaseUrl}/vs` },
    })

    window.require(
      ["vs/editor/editor.main"],
      () => {
        window.monaco.editor.defineTheme("atlas-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "comment", foreground: "607985", fontStyle: "italic" },
            { token: "keyword", foreground: "64FFDA" },
            { token: "string", foreground: "F5CB75" },
            { token: "number", foreground: "A6E3A1" },
            { token: "type", foreground: "7CB7FF" },
          ],
          colors: {
            "editor.background": "#05080D",
            "editor.foreground": "#D1DEE6",
            "editorLineNumber.foreground": "#354955",
            "editorLineNumber.activeForeground": "#64FFDA",
            "editorCursor.foreground": "#64FFDA",
            "editor.selectionBackground": "#64FFDA33",
            "editor.inactiveSelectionBackground": "#64FFDA1A",
            "editorIndentGuide.background1": "#16242D",
            "editorIndentGuide.activeBackground1": "#41606F",
            "editor.lineHighlightBackground": "#0A1018",
            "editorGutter.background": "#05080D",
            "editorWidget.background": "#0A1119",
            "editorWidget.border": "#24414D",
            "editorSuggestWidget.selectedBackground": "#12322F",
            "focusBorder": "#64FFDA88",
          },
        })

        monacoHost.hidden = false
        monacoEditor = window.monaco.editor.create(monacoHost, {
          value: fallbackEditor.value,
          language: monacoLanguageIds[currentLanguage.id],
          theme: "atlas-dark",
          ariaLabel: `${currentLanguage.label} 代码编辑器`,
          automaticLayout: true,
          fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
          fontLigatures: true,
          fontSize: 15,
          lineHeight: 24,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          formatOnPaste: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          suggestOnTriggerCharacters: true,
          parameterHints: { enabled: true, cycle: true },
          snippetSuggestions: "top",
          tabCompletion: "on",
          wordBasedSuggestions: "matchingDocuments",
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: "active", indentation: true },
          minimap: { enabled: true, showSlider: "mouseover" },
          padding: { top: 16, bottom: 24 },
          renderWhitespace: "selection",
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          overviewRulerBorder: false,
          fixedOverflowWidgets: true,
        })
        fallbackEditor.hidden = true
        setText("editorEngine", "MONACO 0.56.0")

        monacoEditor.onDidChangeModelContent(() => {
          fallbackEditor.value = monacoEditor.getValue()
          if (!changingEditorValue) {
            handleEditorInput()
            pythonLsp?.documentChanged()
          }
        })
        monacoEditor.onDidChangeCursorPosition(updateCursorPosition)
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, runCode)
        if (window.AtlasPythonLsp) {
          pythonLsp = window.AtlasPythonLsp.create({
            monaco: window.monaco,
            websocketUrl: app.dataset.pythonLspUrl,
            statusChanged: ({ state, message }) => setIntelligenceStatus(state, message),
          })
        }
        setEditorLanguage(currentLanguage)
        syncLanguageIntelligence()
        updateCursorPosition()
      },
      () => {
        monacoHost.hidden = true
        fallbackEditor.hidden = false
        setText("editorEngine", "BASIC FALLBACK")
        setIntelligenceStatus("basic", "BASIC")
      },
    )
  }

  document.querySelector(".challenge-list").addEventListener("click", (event) => {
    const button = event.target.closest(".challenge-item")
    const challenge = button && challengeMap.get(button.dataset.challengeId)
    if (challenge) renderChallenge(challenge)
  })

  languageSelect.addEventListener("change", (event) => {
    const language = languageMap.get(event.target.value)
    if (language) renderLanguage(language)
  })

  fallbackEditor.addEventListener("input", handleEditorInput)
  fallbackEditor.addEventListener("click", updateCursorPosition)
  fallbackEditor.addEventListener("keyup", updateCursorPosition)
  fallbackEditor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault()
      runCode()
    }
    if (event.key === "Tab") {
      event.preventDefault()
      const start = fallbackEditor.selectionStart
      fallbackEditor.setRangeText("  ", start, fallbackEditor.selectionEnd, "end")
      fallbackEditor.dispatchEvent(new Event("input"))
    }
  })

  runButton.addEventListener("click", runCode)
  document.getElementById("clearOutput").addEventListener("click", clearOutput)
  document.getElementById("copyCode").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getEditorValue())
      setText("draftState", "代码已复制")
    } catch {
      setText("draftState", "复制失败，请手动选择代码")
      selectEditorContent()
    }
  })
  document.getElementById("resetCode").addEventListener("click", () => {
    setEditorValue(starterCode())
    localStorage.removeItem(storageKey(currentChallenge, currentLanguage))
    setText("draftState", "已重置为初始代码")
    pythonLsp?.documentChanged()
    updateCursorPosition()
    if (currentLanguage.mode === "preview") renderPreview(true)
    clearOutput()
    focusEditor()
  })

  updateProgress()
  renderLanguage(currentLanguage, false)
  renderChallenge(currentChallenge, false)
  initializeMonacoEditor()
  checkRunnerHealth()
  window.addEventListener("beforeunload", () => pythonLsp?.dispose())
}
