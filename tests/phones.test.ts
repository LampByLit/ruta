import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toE164 } from '../features/phones/parse'

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
})
