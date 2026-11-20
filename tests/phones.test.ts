import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLoginPhone, toE164 } from '../features/phones/parse'
import { nextPinState, PIN_ATTEMPTS } from '../features/keystone/domain/pinGate'

test('US and Canada numbers become +1', () => {
  assert.equal(toE164('(415) 555-2671', 'US'), '+14155552671')
  assert.equal(toE164('+1 604 555 0134', 'CA'), '+16045550134')
  assert.equal(toE164('16045550134', 'CA'), '+16045550134')
})

test('a short or invalid North American number is rejected', () => {
  assert.equal(toE164('555-2671', 'US'), null)
  assert.equal(toE164('015 555 2671', 'US'), null)
})

test('Peru mobiles become +51', () => {
  assert.equal(toE164('987 654 321', 'PE'), '+51987654321')
  assert.equal(toE164('+51 987 654 321', 'PE'), '+51987654321')
  assert.equal(toE164('0987654321', 'PE'), '+51987654321')
})

test('a Peru landline is not accepted as a mobile', () => {
  assert.equal(toE164('01 1234567', 'PE'), null)
  assert.equal(isLoginPhone('+51987654321'), true)
  assert.equal(isLoginPhone('+14155552671'), true)
  assert.equal(isLoginPhone('4155552671'), false)
})

test('the fifth wrong PIN locks the number', () => {
  let failures = 0
  let locked: Date | null = null
  for (let i = 0; i < PIN_ATTEMPTS - 1; i++) ({ pinFailures: failures, pinLockedUntil: locked } = nextPinState(failures, false, 1_000))
  assert.equal(locked, null)
  const blocked = nextPinState(failures, false, 1_000)
  assert.equal(blocked.pinFailures, 0)
  assert.equal(blocked.pinLockedUntil?.getTime(), 1_000 + 15 * 60 * 1000)
  assert.deepEqual(nextPinState(3, true), { pinFailures: 0, pinLockedUntil: null })
})
