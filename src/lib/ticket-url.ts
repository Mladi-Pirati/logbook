const ticketKeyPattern = /^([A-Z][A-Z0-9]{0,9})-([1-9]\d*)$/

export function getTicketKey(projectKey: string, ticketNumber: number) {
  return `${projectKey}-${ticketNumber}`
}

export function getTicketPath(projectKey: string, ticketNumber: number) {
  return `/tickets/${getTicketKey(projectKey, ticketNumber)}`
}

export function getCanonicalTicketUrl(
  baseUrl: string,
  projectKey: string,
  ticketNumber: number,
) {
  return `${baseUrl.replace(/\/$/, "")}${getTicketPath(projectKey, ticketNumber)}`
}

export function parseTicketKey(value: string) {
  const match = ticketKeyPattern.exec(value.toUpperCase())
  if (!match) return null

  const number = Number(match[2])
  if (!Number.isSafeInteger(number)) return null
  return { projectKey: match[1], number }
}
