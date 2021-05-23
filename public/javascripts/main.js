import Vector from './models/vector.js'
import FourByFour from './models/four_by_four.js'
import Camera from './models/orthographic.js'
import angles from './isomorphisms/angles.js'
import renderLine from './views/line.js'
import renderCircle from './views/circle.js'
import renderPolygon from './views/polygon.js'
import { seed, noise } from './utilities/noise.js'
import { remap, grid, sample } from './utilities/index.js'
import { BACKGROUND, WATER, DOT } from './constants/colors.js'
import {
  ZOOM, FPS, FREQUENCY, Δt, TIME_THRESHOLD, XMIN, YMIN, ZMIN, XMAX, YMAX, ZMAX,
  DROPLET_THRESHOLD, PLANE, Δr, RADIUS_THRESHOLD, GRAVITY, Δθ, PLANE_OPACITY
} from './constants/dimensions.js'

// Copyright (c) 2020 Nathaniel Wroblewski
// I am making my contributions/submissions to this project solely in my personal
// capacity and am not conveying any rights to any intellectual property of any
// third parties.

const canvas = document.querySelector('.canvas')
const context = canvas.getContext('2d')

const perspective = FourByFour.identity()
  .rotX(angles.toRadians(-50))
  .rotY(angles.toRadians(40))

const camera = new Camera({
  position: Vector.zeroes(),
  direction: Vector.zeroes(),
  up: Vector.from([0, 1, 0]),
  width: canvas.width,
  height: canvas.height,
  zoom: ZOOM
})

let droplets = {}
let waves = {}

const from = Vector.from([XMIN, ZMIN])
const to = Vector.from([XMAX, ZMAX])
const by = Vector.from([1, 1])

const points = grid({ from, to, by }, ([x, z]) => {
  droplets[x] ||= {}
  droplets[x][z] ||= []

  waves[x] ||= {}
  waves[x][z] ||= 0

  return Vector.from([x, YMAX, z])
})

const render = () => {
  context.clearRect(0, 0, canvas.width, canvas.height)

  perspective.rotY(angles.toRadians(Δθ))

  points.forEach(point => {
    const [x, y, z] = point
    const distortion = noise(x * FREQUENCY, z * FREQUENCY, time * FREQUENCY)
    const maxDroplets = sample(DROPLET_THRESHOLD)

    if (distortion <= 0 && droplets[x][z].length < maxDroplets) droplets[x][z].push(point)

    droplets[x][z] = droplets[x][z].reduce((memo, droplet) => {
      const dropIndex = 40 - droplet.y + 20 + 1
      const translated = droplet.add(Vector.from([0, -dropIndex * GRAVITY, 0]))

      const source = camera.project(droplet.transform(perspective))
      const destination = camera.project(translated.transform(perspective))

      const opacity = 0.3 - remap(droplet.y, [YMIN, YMAX + 2], [0, 0.3])

      renderLine(context, source, destination, WATER, 1, opacity)

      if (translated.y < (YMIN + 1) && waves[x][z] === 0) waves[x][z] = 1

      return translated.y > YMIN ? memo.concat([translated]) : memo
    }, [])

    if (waves[x][z] > RADIUS_THRESHOLD) waves[x][z] = 0
    if (waves[x][z] > 0) {
      const center = camera.project(Vector.from([x, YMIN, z]).transform(perspective))
      const opacity = 0.4 - remap(waves[x][z], [1, RADIUS_THRESHOLD + 1], [0, 0.4])

      renderCircle(context, center, waves[x][z], WATER, null, opacity)
      waves[x][z] = waves[x][z] + Δr
    }

    if (distortion > 0) {
      renderCircle(context, camera.project(point.transform(perspective)), 2, DOT, DOT)
    }
  })

  const plane = PLANE.map(([offsetx, offsetz]) => (
    camera.project(Vector.from([offsetx, YMAX, offsetz]).transform(perspective))
  ))

  renderPolygon(context, plane, null, BACKGROUND, 1, PLANE_OPACITY)

  if (time > TIME_THRESHOLD) time = 0
  time += Δt
}

let time = 0
let prevTick = 0

const step = () => {
  window.requestAnimationFrame(step)

  const now = Math.round(FPS * Date.now() / 1000)
  if (now === prevTick) return
  prevTick = now

  render()
}

seed(Math.random())

step()
