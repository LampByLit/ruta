import { test } from 'node:test'
import assert from 'node:assert/strict'
import { messages, translate } from '../features/i18n/messages'

test('English and Spanish catalogs have the same keys', () => {
  assert.deepEqual(Object.keys(messages.es).sort(), Object.keys(messages.en).sort())
})

test('placeholders are filled', () => {
  assert.equal(translate('es', 'menu.ridingWith', { name: 'Ruta' }), 'Viajas con Ruta')
})
