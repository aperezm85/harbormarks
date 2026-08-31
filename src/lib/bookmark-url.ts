const TRACKING_PARAM_PREFIXES = ["utm_"]
const TRACKING_PARAM_NAMES = new Set(["fbclid", "gclid"])

function normalizeProtocolPrefix(value: string) {
  const schemeMatch = value.match(/^([a-zA-Z][a-zA-Z\d+.-]*):(.+)$/)

  if (!schemeMatch) {
    return `https://${value}`
  }

  const scheme = schemeMatch[1].toLowerCase()
  const remainder = schemeMatch[2].replace(/^\/+/, "")

  if (scheme === "http" || scheme === "https") {
    return `${scheme}://${remainder}`
  }

  return value
}

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "")
  return normalized || "/"
}

function shouldDropSearchParam(name: string) {
  const normalizedName = name.toLowerCase()

  if (TRACKING_PARAM_NAMES.has(normalizedName)) {
    return true
  }

  return TRACKING_PARAM_PREFIXES.some((prefix) =>
    normalizedName.startsWith(prefix)
  )
}

export function normalizeBookmarkUrl(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(normalizeProtocolPrefix(trimmed))

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")

    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = ""
    }

    parsed.pathname = normalizePathname(parsed.pathname)

    const remainingParams = [...parsed.searchParams.entries()]
      .filter(([name]) => !shouldDropSearchParam(name))
      .sort(([leftName, leftValue], [rightName, rightValue]) => {
        const nameComparison = leftName.localeCompare(rightName)

        if (nameComparison !== 0) {
          return nameComparison
        }

        return leftValue.localeCompare(rightValue)
      })

    parsed.search = ""
    for (const [name, paramValue] of remainingParams) {
      parsed.searchParams.append(name, paramValue)
    }

    return parsed.toString()
  } catch {
    return null
  }
}
