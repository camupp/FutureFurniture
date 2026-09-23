import { describe, expect, it } from 'vitest'
import { wallJunctionProfile } from '@/domain/geometry/wallJunctions'
import { makePartitionedRoom, makeRoom } from '../../../fixtures'

describe('wallJunctionProfile', () => {
  it('miters two exterior walls into the same 90-degree corner', () => {
    const { walls } = makeRoom()
    const top = wallJunctionProfile(walls[0]!, walls)
    const right = wallJunctionProfile(walls[1]!, walls)

    expect(top.end).toEqual({ left: -50, right: 50 })
    expect(right.start).toEqual({ left: 50, right: -50 })
  })

  it('butts a partition against the face of a through-wall', () => {
    const { walls } = makePartitionedRoom()
    const vertical = wallJunctionProfile(walls[4]!, walls)
    const bottom = wallJunctionProfile(walls[2]!, walls)

    expect(vertical.start).toEqual({ left: 50, right: 50 })
    expect(bottom.start).toEqual({ left: 50, right: -50 })
    expect(bottom.end).toEqual({ left: -50, right: 50 })
  })

  it('miters the free corner between two partition ends', () => {
    const { walls } = makePartitionedRoom()
    const vertical = wallJunctionProfile(walls[4]!, walls)
    const horizontal = wallJunctionProfile(walls[5]!, walls)

    expect(vertical.end).toEqual({ left: -50, right: 50 })
    expect(horizontal.start).toEqual({ left: 50, right: -50 })
  })
})
