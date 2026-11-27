/**
 * Philippine mobile numbers, normalised to E.164 (`+639XXXXXXXXX`).
 * Accepts `09XXXXXXXXX`, `9XXXXXXXXX`, `+639XXXXXXXXX` and spaced/dashed forms.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s().-]/g, '')
  let local: string

  if (digits.startsWith('+63')) {
    local = digits.slice(3)
  } else if (digits.startsWith('63') && digits.length === 12) {
    local = digits.slice(2)
  } else if (digits.startsWith('09') && digits.length === 11) {
    local = digits.slice(1)
  } else if (digits.startsWith('9') && digits.length === 10) {
    local = digits
  } else {
    return null
  }

  if (!/^9\d{9}$/.test(local)) return null
  return `+63${local}`
}

export function maskPhone(phone: string): string {
  return phone.length >= 6 ? `${phone.slice(0, 5)}****${phone.slice(-2)}` : '***'
}
