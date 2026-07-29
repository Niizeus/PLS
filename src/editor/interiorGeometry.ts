import { type InteriorRemovedWall, type InteriorRoom, type InteriorWallSide } from '../data/interiors'

export interface InteriorWallSegment {
  id: string
  roomId: string
  side: InteriorWallSide
  x: number
  z: number
  w: number
  d: number
  orientation: 'horizontal' | 'vertical'
}

const EDGE_EPSILON = 0.001

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > EDGE_EPSILON
}

function oppositeSide(side: InteriorWallSide): InteriorWallSide {
  if (side === 'top') return 'bottom'
  if (side === 'bottom') return 'top'
  if (side === 'left') return 'right'
  return 'left'
}

function hasNeighbourOnEdge(room: InteriorRoom, rooms: InteriorRoom[], side: InteriorWallSide) {
  return rooms.some((other) => {
    if (other.id === room.id) return false
    if (side === 'top') {
      return Math.abs(other.z + other.d - room.z) <= EDGE_EPSILON && rangesOverlap(room.x, room.x + room.w, other.x, other.x + other.w)
    }
    if (side === 'bottom') {
      return Math.abs(other.z - (room.z + room.d)) <= EDGE_EPSILON && rangesOverlap(room.x, room.x + room.w, other.x, other.x + other.w)
    }
    if (side === 'left') {
      return Math.abs(other.x + other.w - room.x) <= EDGE_EPSILON && rangesOverlap(room.z, room.z + room.d, other.z, other.z + other.d)
    }
    return Math.abs(other.x - (room.x + room.w)) <= EDGE_EPSILON && rangesOverlap(room.z, room.z + room.d, other.z, other.z + other.d)
  })
}

function isRemovedWall(room: InteriorRoom, rooms: InteriorRoom[], side: InteriorWallSide, removedWalls: InteriorRemovedWall[]) {
  if (removedWalls.some((wall) => wall.roomId === room.id && wall.side === side)) return true
  const neighbourSide = oppositeSide(side)
  return rooms.some((other) => {
    if (!hasNeighbourOnEdge(room, [other], side)) return false
    return removedWalls.some((wall) => wall.roomId === other.id && wall.side === neighbourSide)
  })
}

export function getWallSegments(room: InteriorRoom, thickness: number): InteriorWallSegment[] {
  return [
    { id: `${room.id}:top`, roomId: room.id, side: 'top', x: room.x + room.w / 2, z: room.z, w: room.w, d: thickness, orientation: 'horizontal' },
    {
      id: `${room.id}:bottom`,
      roomId: room.id,
      side: 'bottom',
      x: room.x + room.w / 2,
      z: room.z + room.d,
      w: room.w,
      d: thickness,
      orientation: 'horizontal',
    },
    { id: `${room.id}:left`, roomId: room.id, side: 'left', x: room.x, z: room.z + room.d / 2, w: thickness, d: room.d, orientation: 'vertical' },
    {
      id: `${room.id}:right`,
      roomId: room.id,
      side: 'right',
      x: room.x + room.w,
      z: room.z + room.d / 2,
      w: thickness,
      d: room.d,
      orientation: 'vertical',
    },
  ]
}

export function getVisibleWallSegments(
  room: InteriorRoom,
  rooms: InteriorRoom[],
  thickness: number,
  removedWalls: InteriorRemovedWall[] = [],
): InteriorWallSegment[] {
  const walls: InteriorWallSegment[] = []
  if (!isRemovedWall(room, rooms, 'top', removedWalls)) {
    walls.push({ id: `${room.id}:top`, roomId: room.id, side: 'top', x: room.x + room.w / 2, z: room.z, w: room.w, d: thickness, orientation: 'horizontal' })
  }
  if (!isRemovedWall(room, rooms, 'bottom', removedWalls)) {
    walls.push({ id: `${room.id}:bottom`, roomId: room.id, side: 'bottom', x: room.x + room.w / 2, z: room.z + room.d, w: room.w, d: thickness, orientation: 'horizontal' })
  }
  if (!isRemovedWall(room, rooms, 'left', removedWalls)) {
    walls.push({ id: `${room.id}:left`, roomId: room.id, side: 'left', x: room.x, z: room.z + room.d / 2, w: thickness, d: room.d, orientation: 'vertical' })
  }
  if (!isRemovedWall(room, rooms, 'right', removedWalls)) {
    walls.push({ id: `${room.id}:right`, roomId: room.id, side: 'right', x: room.x + room.w, z: room.z + room.d / 2, w: thickness, d: room.d, orientation: 'vertical' })
  }
  return walls
}

export function isWallRemoved(room: InteriorRoom, rooms: InteriorRoom[], side: InteriorWallSide, removedWalls: InteriorRemovedWall[]) {
  return isRemovedWall(room, rooms, side, removedWalls)
}
