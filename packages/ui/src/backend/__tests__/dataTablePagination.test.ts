import { buildPageItems } from '../dataTablePagination'

describe('buildPageItems', () => {
  it('returns all pages when totalPages is small', () => {
    expect(buildPageItems(1, 1)).toEqual([1])
    expect(buildPageItems(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('adds ellipsis for larger ranges around the current page', () => {
    expect(buildPageItems(1, 20)).toEqual([1, 2, 'ellipsis', 20])
    expect(buildPageItems(2, 20)).toEqual([1, 2, 3, 'ellipsis', 20])
    expect(buildPageItems(5, 20)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 20])
    expect(buildPageItems(19, 20)).toEqual([1, 'ellipsis', 18, 19, 20])
    expect(buildPageItems(20, 20)).toEqual([1, 'ellipsis', 19, 20])
  })

  it('clamps invalid page and totalPages values', () => {
    expect(buildPageItems(0, 10)).toEqual([1, 2, 'ellipsis', 10])
    expect(buildPageItems(99, 10)).toEqual([1, 'ellipsis', 9, 10])
    expect(buildPageItems(1, 0)).toEqual([1])
  })
})
