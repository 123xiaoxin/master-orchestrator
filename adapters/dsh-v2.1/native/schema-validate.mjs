// 紧凑 JSON Schema 解释器 —— Layer 1 结构校验
//
// 设计约束（对应评审 P0-1）：结构事实来源只能是 .schema.json 文件本身。
// 本文件不包含任何 Master 字段名，只解释 JSON Schema 的一个受支持子集：
//   type (string | string[]), required, properties, additionalProperties:false,
//   items, enum, const, minLength, minimum, maximum
// 因此 schema 与校验器之间不存在双份字段定义，不会漂移。
import { readFileSync } from 'node:fs'

const typeOf = (v) => {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

const typeMatches = (expected, v) => {
  const actual = typeOf(v)
  if (expected === 'number') return actual === 'number' || actual === 'integer'
  if (expected === 'integer') return actual === 'integer'
  return actual === expected
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function walk(schema, value, path, errors) {
  if (schema === null || typeof schema !== 'object') return

  if ('const' in schema && !sameValue(value, schema.const)) {
    errors.push(`${path}: must equal ${JSON.stringify(schema.const)} (got ${JSON.stringify(value)})`)
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((c) => sameValue(value, c))) {
    errors.push(`${path}: must be one of ${schema.enum.map((c) => JSON.stringify(c)).join(' | ')} (got ${JSON.stringify(value)})`)
  }

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!expected.some((t) => typeMatches(t, value))) {
      errors.push(`${path}: type must be ${expected.join('|')} (got ${typeOf(value)})`)
      return
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path}: length must be >= ${schema.minLength}`)
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${path}: must be >= ${schema.minimum}`)
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${path}: must be <= ${schema.maximum}`)
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path}: must have at least ${schema.minItems} item(s) (got ${value.length})`)
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${path}: must have at most ${schema.maxItems} item(s) (got ${value.length})`)
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => walk(schema.items, item, `${path}[${i}]`, errors))
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties || {}
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${path}.${key}: missing required field`)
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}.${key}: unknown field (additionalProperties: false)`)
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) walk(sub, value[key], `${path}.${key}`, errors)
    }
  }
}

/** 按 schema 校验 value，返回错误字符串数组。 */
export function validateAgainstSchema(schema, value) {
  const errors = []
  walk(schema, value, '$', errors)
  return errors
}

/** 读取并解析 schema 文件。 */
export function loadSchema(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
