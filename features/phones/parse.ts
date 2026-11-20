/** Login numbers we accept while testing: US and Canada share +1, Peru mobiles are +51. */
export type PhoneCountry = 'US' | 'CA' | 'PE'

export function toE164(input: string, country: PhoneCountry): string | null {
  const digits = input.replace(/\D/g, '')
  return country === 'PE' ? peruMobile(digits) : nanp(digits)
}

function nanp(digits: string): string | null {
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null
  return `+1${national}`
}

/** Peru mobile: 9 digits starting with 9. A leading 51 or a trunk 0 is stripped. */
function peruMobile(digits: string): string | null {
  let national = digits
  if (national.startsWith('51') && national.length === 11) national = national.slice(2)
  national = national.replace(/^0+/, '')
  if (!/^9\d{8}$/.test(national)) return null
  return `+51${national}`
}
