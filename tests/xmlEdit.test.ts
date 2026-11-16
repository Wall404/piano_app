// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { countMeasures, mergeXml, splitXml } from '../src/import/xmlEdit'

const measure = (n: number, attrs = '') => `<measure number="${n}">${attrs}<note><rest/><duration>4</duration></note></measure>`
const START = '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>'
const part = (id: string, change = '') => `<part id="${id}">${measure(1, START)}${measure(2, change)}${measure(3)}${measure(4)}</part>`
const score = (parts: string) => `<?xml version="1.0"?><score-partwise version="3.1"><part-list/>${parts}</score-partwise>`
// En el compás 2 cambia la armadura y la clave de abajo.
const XML = score(part('P1', '<attributes><key><fifths>2</fifths></key><clef number="2"><sign>G</sign><line>2</line></clef></attributes>') + part('P2'))

const doc = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml')
const numbers = (xml: string) => [...doc(xml).querySelectorAll('part')].map((p) => [...p.querySelectorAll('measure')].map((m) => m.getAttribute('number')))

describe('unir obras', () => {
  it('suma los compases de cada parte y los renumera', () => {
    const merged = mergeXml(XML, XML)
    expect(countMeasures(merged)).toBe(8)
    expect(numbers(merged)).toEqual([['1', '2', '3', '4', '5', '6', '7', '8'], ['1', '2', '3', '4', '5', '6', '7', '8']])
  })

  it('no une obras con distinta cantidad de partes', () => {
    expect(() => mergeXml(XML, score(part('P1')))).toThrow('distinta cantidad de partes')
  })
})

describe('separar obras', () => {
  it('lleva los atributos vigentes al primer compás de la segunda', () => {
    const [a, b] = splitXml(XML, 3)
    expect(countMeasures(a)).toBe(2)
    expect(numbers(b)).toEqual([['1', '2'], ['1', '2']])
    const attrs = doc(b).querySelector('part measure attributes')!
    expect([...attrs.children].map((e) => e.tagName)).toEqual(['divisions', 'key', 'time', 'staves', 'clef', 'clef'])
    expect(attrs.querySelector('fifths')!.textContent).toBe('2') // la del compás 2, no la del 1
    const clefs = [...attrs.querySelectorAll('clef')].map((c) => `${c.getAttribute('number')}${c.querySelector('sign')!.textContent}`)
    expect(clefs.sort()).toEqual(['1G', '2G']) // clef 1 viene del compás 1
  })

  it('no pisa lo que el compás de corte ya declara', () => {
    const [, b] = splitXml(XML, 2)
    const attrs = doc(b).querySelector('part measure attributes')!
    expect(attrs.querySelectorAll('key').length).toBe(1)
    expect(attrs.querySelector('fifths')!.textContent).toBe('2')
    expect([...attrs.children].map((e) => e.tagName)).toEqual(['divisions', 'key', 'time', 'staves', 'clef', 'clef'])
  })

  it('pasa el tempo vigente a la segunda, solo en la primera parte', () => {
    const tempo = '<direction placement="above"><direction-type><words/></direction-type><sound tempo="90"/></direction>'
    const xml = XML.replace(`<measure number="2">`, `<measure number="2">${tempo}`)
    const [, b] = splitXml(xml, 3)
    const [p1, p2] = doc(b).querySelectorAll('part')
    const head = p1.querySelector('measure')!
    expect([...head.children].map((e) => e.tagName).slice(0, 2)).toEqual(['attributes', 'direction'])
    expect(head.querySelector('sound')!.getAttribute('tempo')).toBe('90')
    expect(p2.querySelector('sound')).toBeNull()
    // Si el compás de corte ya trae tempo, no se agrega otro.
    expect(doc(splitXml(xml, 2)[1]).querySelectorAll('sound').length).toBe(1)
  })

  it('rechaza compases fuera de rango', () => {
    for (const bad of [1, 5, 2.5]) expect(() => splitXml(XML, bad)).toThrow('entre 2 y 4')
  })
})
