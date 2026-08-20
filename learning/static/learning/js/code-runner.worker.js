function deepEqual(actual, expected) {
  if (Object.is(actual, expected)) return true
  if (typeof actual !== typeof expected || actual === null || expected === null) return false
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (typeof actual !== "object") return false
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => deepEqual(actual[key], expected[key]))
}

function printable(value) {
  if (typeof value === "string") return value
  if (typeof value === "undefined") return "undefined"
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

self.onmessage = async ({ data }) => {
  const startedAt = performance.now()
  const logs = []
  const consoleProxy = {}

  if (data.language !== "javascript") {
    self.postMessage({ ok: false, logs, error: "RuntimeError: 当前 Worker 只接受 JavaScript 任务。" })
    return
  }

  for (const level of ["log", "info", "warn", "error"]) {
    consoleProxy[level] = (...values) => logs.push({ level, message: values.map(printable).join(" ") })
  }

  const networkDisabled = () => Promise.reject(new Error("代码工坊已关闭网络访问"))

  try {
    const buildSolution = new Function(
      "console",
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      `"use strict";\n${data.source}\nif (typeof ${data.entryPoint} !== "function") { throw new Error("请定义函数 ${data.entryPoint}"); }\nreturn ${data.entryPoint};`,
    )
    const solution = buildSolution(consoleProxy, networkDisabled, undefined, undefined, undefined)
    const results = []

    for (const test of data.tests) {
      try {
        const args = structuredClone(test.args)
        const actual = await solution(...args)
        results.push({
          label: test.label,
          pass: deepEqual(actual, test.expected),
          actual: printable(actual),
          expected: printable(test.expected),
        })
      } catch (error) {
        results.push({ label: test.label, pass: false, actual: `Error: ${error.message}`, expected: printable(test.expected) })
      }
    }

    self.postMessage({
      ok: true,
      logs,
      results,
      duration: Math.max(1, Math.round(performance.now() - startedAt)),
    })
  } catch (error) {
    self.postMessage({
      ok: false,
      logs,
      error: `${error.name}: ${error.message}`,
      duration: Math.max(1, Math.round(performance.now() - startedAt)),
    })
  }
}
