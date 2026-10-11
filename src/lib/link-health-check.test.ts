import { afterEach, describe, expect, it, vi } from "vitest"

describe("classifyLinkHealthResponse", () => {
  it("treats redirects as healthy and rejects broken HTTP failures", async () => {
    const { classifyLinkHealthResponse } = await import("./link-health-check")

    expect(classifyLinkHealthResponse(200)).toBe(true)
    expect(classifyLinkHealthResponse(301)).toBe(true)
    expect(classifyLinkHealthResponse(302)).toBe(true)
    expect(classifyLinkHealthResponse(404)).toBe(false)
    expect(classifyLinkHealthResponse(500)).toBe(false)
  })
})

describe("checkUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetchOnce(status: number) {
    return vi.fn().mockResolvedValueOnce({
      status,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
  }

  it("recovers when HEAD is 403-blocked but GET serves the page (Medium false positive)", async () => {
    const { checkUrl } = await import("./link-health-check")
    const fetchMock = mockFetchOnce(403).mockResolvedValueOnce({
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(checkUrl("https://medium.com/@user/post")).resolves.toBe(
      true
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "HEAD" })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      redirect: "follow",
    })
    // Browser UA on both attempts so Cloudflare doesn't 403 us.
    for (const call of fetchMock.mock.calls) {
      expect(
        (call[1] as { headers: Record<string, string> }).headers["User-Agent"]
      ).toContain("Mozilla/5.0")
    }
  })

  it("still marks genuinely dead links as broken after the GET fallback", async () => {
    const { checkUrl } = await import("./link-health-check")
    const fetchMock = mockFetchOnce(403).mockResolvedValueOnce({
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(checkUrl("https://example.com/gone")).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("syncBrokenTagState", () => {
  it("keeps a single broken tag and removes it when the page is healthy", async () => {
    const { syncBrokenTagState } = await import("./link-health-check")

    expect(syncBrokenTagState(["broken", "dev", "broken"], false)).toEqual([
      "dev",
      "broken",
    ])
    expect(syncBrokenTagState(["dev", "broken", "broken"], true)).toEqual([
      "dev",
    ])
  })
})
