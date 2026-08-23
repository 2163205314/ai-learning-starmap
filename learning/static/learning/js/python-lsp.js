(() => {
  const REQUEST_TIMEOUT_MS = 6000
  const CHANGE_DEBOUNCE_MS = 140
  const PYRIGHT_SETTINGS = {
    python: {
      analysis: {
        autoSearchPaths: true,
        typeCheckingMode: "basic",
        useLibraryCodeForTypes: true,
      },
    },
  }

  const toLspPosition = (position) => ({ line: position.lineNumber - 1, character: position.column - 1 })
  const toMonacoRange = (range) => ({
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  })

  function normalizeDocumentUri(uri) {
    try {
      const value = new URL(uri)
      if (value.protocol !== "file:") return value.href
      let pathname = decodeURIComponent(value.pathname).replaceAll("\\", "/")
      if (/^\/[a-zA-Z]:/.test(pathname)) pathname = `/${pathname[1].toLowerCase()}${pathname.slice(2)}`
      return `file://${value.host}${pathname}`
    } catch {
      return uri
    }
  }

  function markdown(value) {
    if (!value) return undefined
    if (typeof value === "string") return { value }
    if (Array.isArray(value)) {
      const blocks = value.map((item) => {
        if (typeof item === "string") return item
        if (!item || typeof item !== "object") return ""
        if (item.language) return `\`\`\`${item.language}\n${item.value || ""}\n\`\`\``
        return item.value || ""
      })
      return { value: blocks.filter(Boolean).join("\n\n") }
    }
    if (typeof value.value === "string") return { value: value.value }
    return undefined
  }

  function configurationValue(section) {
    if (!section) return PYRIGHT_SETTINGS
    return section.split(".").reduce((value, key) => value?.[key], PYRIGHT_SETTINGS) ?? null
  }

  function createCompletionKindMap(monaco) {
    const kind = monaco.languages.CompletionItemKind
    return [
      kind.Text, kind.Method, kind.Function, kind.Constructor, kind.Field,
      kind.Variable, kind.Class, kind.Interface, kind.Module, kind.Property,
      kind.Unit, kind.Value, kind.Enum, kind.Keyword, kind.Snippet,
      kind.Color, kind.File, kind.Reference, kind.Folder, kind.EnumMember,
      kind.Constant, kind.Struct, kind.Event, kind.Operator, kind.TypeParameter,
    ]
  }

  class PythonLspClient {
    constructor({ monaco, websocketUrl, statusChanged }) {
      this.monaco = monaco
      this.websocketUrl = websocketUrl
      this.statusChanged = statusChanged
      this.socket = null
      this.connectionPromise = null
      this.initialized = false
      this.activeModel = null
      this.documentOpen = false
      this.documentVersion = 0
      this.lastSyncedValue = ""
      this.documentUri = ""
      this.workspaceUri = ""
      this.nextRequestId = 1
      this.pendingRequests = new Map()
      this.changeTimer = null
      this.disposables = []
      this.completionKinds = createCompletionKindMap(monaco)
      this.registerProviders()
    }

    emitStatus(state, message) {
      this.statusChanged?.({ state, message })
    }

    registerProviders() {
      this.disposables.push(
        this.monaco.languages.registerCompletionItemProvider("python", {
          triggerCharacters: [".", "(", "[", "\"", "'"],
          provideCompletionItems: async (model, position, _context, token) => {
            if (!this.canRequest(model) || token.isCancellationRequested) return { suggestions: [] }
            try {
              this.syncDocumentNow()
              const response = await this.request("textDocument/completion", {
                textDocument: { uri: this.documentUri },
                position: toLspPosition(position),
                context: { triggerKind: 1 },
              })
              if (token.isCancellationRequested) return { suggestions: [] }
              const items = Array.isArray(response) ? response : response?.items || []
              return { suggestions: items.map((item) => this.toCompletionItem(item, model, position)) }
            } catch {
              return { suggestions: [] }
            }
          },
        }),
        this.monaco.languages.registerHoverProvider("python", {
          provideHover: async (model, position, token) => {
            if (!this.canRequest(model) || token.isCancellationRequested) return null
            try {
              this.syncDocumentNow()
              const response = await this.request("textDocument/hover", {
                textDocument: { uri: this.documentUri },
                position: toLspPosition(position),
              })
              if (!response || token.isCancellationRequested) return null
              const content = markdown(response.contents)
              return content ? { contents: [content], range: response.range ? toMonacoRange(response.range) : undefined } : null
            } catch {
              return null
            }
          },
        }),
        this.monaco.languages.registerSignatureHelpProvider("python", {
          signatureHelpTriggerCharacters: ["(", ","],
          signatureHelpRetriggerCharacters: [","],
          provideSignatureHelp: async (model, position, token) => {
            if (!this.canRequest(model) || token.isCancellationRequested) return null
            try {
              this.syncDocumentNow()
              const value = await this.request("textDocument/signatureHelp", {
                textDocument: { uri: this.documentUri },
                position: toLspPosition(position),
              })
              if (!value || token.isCancellationRequested) return null
              return {
                value: {
                  activeSignature: value.activeSignature || 0,
                  activeParameter: value.activeParameter || 0,
                  signatures: (value.signatures || []).map((signature) => ({
                    label: signature.label,
                    documentation: markdown(signature.documentation),
                    parameters: (signature.parameters || []).map((parameter) => ({
                      label: parameter.label,
                      documentation: markdown(parameter.documentation),
                    })),
                    activeParameter: signature.activeParameter,
                  })),
                },
                dispose() {},
              }
            } catch {
              return null
            }
          },
        }),
      )
    }

    toCompletionItem(item, model, position) {
      const word = model.getWordUntilPosition(position)
      let range = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      }
      let insertText = item.insertText || item.label
      if (item.textEdit) {
        const editRange = item.textEdit.range || item.textEdit.replace || item.textEdit.insert
        if (editRange) range = toMonacoRange(editRange)
        insertText = item.textEdit.newText
      }
      return {
        label: item.label,
        kind: this.completionKinds[(item.kind || 1) - 1] ?? this.monaco.languages.CompletionItemKind.Text,
        detail: item.detail,
        documentation: markdown(item.documentation),
        insertText,
        insertTextRules: item.insertTextFormat === 2 ? this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
        filterText: item.filterText,
        sortText: item.sortText,
        preselect: item.preselect,
        range,
        additionalTextEdits: (item.additionalTextEdits || []).map((edit) => ({ range: toMonacoRange(edit.range), text: edit.newText })),
      }
    }

    canRequest(model) {
      return this.initialized && this.documentOpen && this.activeModel === model && model.getLanguageId() === "python"
    }

    async activate(model) {
      this.activeModel = model
      this.emitStatus("connecting", "PYRIGHT CONNECTING")
      try {
        await this.connect()
        if (this.activeModel !== model) return
        this.openDocument()
        this.emitStatus("online", "PYRIGHT ONLINE")
      } catch (error) {
        this.emitStatus(error?.code === "pyright_missing" ? "missing" : "offline", error?.message || "PYRIGHT OFFLINE")
      }
    }

    deactivate() {
      window.clearTimeout(this.changeTimer)
      if (this.documentOpen && this.initialized) {
        this.notify("textDocument/didClose", { textDocument: { uri: this.documentUri } })
      }
      if (this.activeModel) this.monaco.editor.setModelMarkers(this.activeModel, "pyright", [])
      this.documentOpen = false
      this.activeModel = null
    }

    documentChanged() {
      if (!this.documentOpen || !this.activeModel) return
      window.clearTimeout(this.changeTimer)
      this.changeTimer = window.setTimeout(() => {
        this.syncDocumentNow()
      }, CHANGE_DEBOUNCE_MS)
    }

    syncDocumentNow() {
      window.clearTimeout(this.changeTimer)
      if (!this.documentOpen || !this.activeModel) return
      const value = this.activeModel.getValue()
      if (value === this.lastSyncedValue) return
      this.documentVersion += 1
      this.lastSyncedValue = value
      this.notify("textDocument/didChange", {
        textDocument: { uri: this.documentUri, version: this.documentVersion },
        contentChanges: [{ text: value }],
      })
    }

    openDocument() {
      if (!this.activeModel || this.documentOpen) return
      this.documentVersion += 1
      this.notify("textDocument/didOpen", {
        textDocument: {
          uri: this.documentUri,
          languageId: "python",
          version: this.documentVersion,
          text: this.activeModel.getValue(),
        },
      })
      this.lastSyncedValue = this.activeModel.getValue()
      this.documentOpen = true
    }

    connect() {
      if (this.initialized && this.socket?.readyState === WebSocket.OPEN) return Promise.resolve()
      if (this.connectionPromise) return this.connectionPromise
      if (!this.websocketUrl) return Promise.reject(new Error("PYRIGHT 未配置"))
      this.connectionPromise = new Promise((resolve, reject) => {
        const socket = new WebSocket(this.websocketUrl)
        this.socket = socket
        let settled = false
        socket.addEventListener("message", async (event) => {
          let message
          try {
            message = JSON.parse(event.data)
          } catch {
            return
          }
          if (message.method === "gateway/error") {
            const error = new Error(message.params?.message || "Pyright 不可用")
            error.code = message.params?.code
            if (!settled) {
              settled = true
              reject(error)
            }
            return
          }
          if (message.method === "gateway/ready") {
            this.workspaceUri = message.params.workspaceUri
            this.documentUri = message.params.documentUri
            try {
              await this.initializeServer()
              settled = true
              resolve()
            } catch (error) {
              settled = true
              reject(error)
            }
            return
          }
          this.handleMessage(message)
        })
        socket.addEventListener("error", () => {
          if (!settled) {
            settled = true
            reject(new Error("PYRIGHT 连接失败"))
          }
        })
        socket.addEventListener("close", () => {
          this.initialized = false
          this.documentOpen = false
          this.connectionPromise = null
          this.rejectPending(new Error("PYRIGHT 连接已关闭"))
          if (this.activeModel) {
            this.monaco.editor.setModelMarkers(this.activeModel, "pyright", [])
            this.emitStatus("offline", "PYRIGHT OFFLINE")
          }
        })
      })
      return this.connectionPromise
    }

    async initializeServer() {
      await this.request("initialize", {
        processId: null,
        clientInfo: { name: "AI Learning Starmap", version: "1.0" },
        locale: "zh-cn",
        rootUri: this.workspaceUri,
        workspaceFolders: [{ uri: this.workspaceUri, name: "code-workshop" }],
        capabilities: {
          workspace: { workspaceFolders: true, configuration: true },
          textDocument: {
            synchronization: { dynamicRegistration: false, didSave: false },
            completion: { completionItem: { snippetSupport: true, documentationFormat: ["markdown", "plaintext"] } },
            hover: { contentFormat: ["markdown", "plaintext"] },
            signatureHelp: { signatureInformation: { documentationFormat: ["markdown", "plaintext"], parameterInformation: { labelOffsetSupport: true } } },
            publishDiagnostics: { relatedInformation: true, tagSupport: { valueSet: [1, 2] } },
          },
        },
      })
      this.initialized = true
      this.notify("initialized", {})
      this.notify("workspace/didChangeConfiguration", {
        settings: PYRIGHT_SETTINGS,
      })
    }

    handleMessage(message) {
      if (Object.prototype.hasOwnProperty.call(message, "id") && !message.method) {
        const pending = this.pendingRequests.get(message.id)
        if (!pending) return
        this.pendingRequests.delete(message.id)
        window.clearTimeout(pending.timeout)
        if (message.error) pending.reject(new Error(message.error.message || "LSP request failed"))
        else pending.resolve(message.result)
        return
      }
      if (message.method === "textDocument/publishDiagnostics") this.publishDiagnostics(message.params)
      if (Object.prototype.hasOwnProperty.call(message, "id") && message.method) {
        const result = message.method === "workspace/configuration"
          ? (message.params?.items || []).map((item) => configurationValue(item.section))
          : null
        this.send({ jsonrpc: "2.0", id: message.id, result })
      }
    }

    publishDiagnostics(params) {
      if (!this.activeModel || normalizeDocumentUri(params.uri) !== normalizeDocumentUri(this.documentUri)) return
      if (Number.isInteger(params.version) && params.version !== this.documentVersion) return
      const severity = this.monaco.MarkerSeverity
      const severityMap = { 1: severity.Error, 2: severity.Warning, 3: severity.Info, 4: severity.Hint }
      const markers = (params.diagnostics || []).map((diagnostic) => ({
        ...toMonacoRange(diagnostic.range),
        severity: severityMap[diagnostic.severity] || severity.Info,
        message: diagnostic.message,
        source: diagnostic.source || "Pyright",
        code: diagnostic.code === undefined ? undefined : String(diagnostic.code),
        tags: diagnostic.tags,
      }))
      this.monaco.editor.setModelMarkers(this.activeModel, "pyright", markers)
    }

    request(method, params) {
      const id = this.nextRequestId++
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.pendingRequests.delete(id)
          reject(new Error(`${method} timed out`))
        }, REQUEST_TIMEOUT_MS)
        this.pendingRequests.set(id, { resolve, reject, timeout })
        try {
          this.send({ jsonrpc: "2.0", id, method, params })
        } catch (error) {
          window.clearTimeout(timeout)
          this.pendingRequests.delete(id)
          reject(error)
        }
      })
    }

    notify(method, params) {
      if (this.socket?.readyState === WebSocket.OPEN) this.send({ jsonrpc: "2.0", method, params })
    }

    send(payload) {
      if (this.socket?.readyState !== WebSocket.OPEN) throw new Error("PYRIGHT 尚未连接")
      this.socket.send(JSON.stringify(payload))
    }

    rejectPending(error) {
      this.pendingRequests.forEach((pending) => {
        window.clearTimeout(pending.timeout)
        pending.reject(error)
      })
      this.pendingRequests.clear()
    }

    dispose() {
      this.deactivate()
      this.disposables.forEach((disposable) => disposable.dispose())
      this.disposables = []
      this.socket?.close(1000, "page closed")
    }
  }

  window.AtlasPythonLsp = {
    create(options) {
      return new PythonLspClient(options)
    },
  }
})()
