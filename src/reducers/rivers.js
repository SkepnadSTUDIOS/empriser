import sha1 from 'sha-1'
import MersenneTwister from 'mersenne-twister'
import {hex_neighbors} from '../util'
import {Set,List} from 'immutable'
import _ from 'underscore'

import {ARCTIC} from './climate'

const min_dense = 1/10000
const max_dense = 1/100
const max_momentum = Math.log(1/5)
const min_momentum = Math.log(1/100)

const weight_sigma_max = 50
const π = Math.PI
const reached_ocean_bit = 7

export default function geenerate_rivers(state){
  let width = Number(state.settings.getIn(['terrain','width']))
  let height = Number(state.settings.getIn(['terrain','height']))
  let relative_density = state.settings.getIn(['rivers','density'])
  let randomness = state.settings.getIn(['rivers','randomness'])
  let momentum_dial = state.settings.getIn(['rivers','momentum'])
  let seed_start = state.settings.getIn(['rivers','seed'])
  let seed = parseInt(sha1(seed_start).slice(8))
  let rng = new MersenneTwister(seed)

  let min_rivers = min_dense*width*height
  let max_rivers = max_dense*width*height

  let num_rivers = Math.floor(min_rivers + (max_rivers-min_rivers)*relative_density)

  let rivers = new Int8Array(width*height)
  for(let i=0;i<rivers.length;i++) rivers[i] = 0

  let momentum = Math.exp((max_momentum - min_momentum)*momentum_dial +
                          min_momentum)
  let map_indices = _.shuffle(_.filter(_.range(width*height),i =>
    state.data.terrain_zones.types[i] == 3))

  for(let i=0;i<num_rivers;i++){
    if(i > map_indices.length) break;
    let map_index = map_indices[i];
    let yi = Math.floor(map_index / width)
    let xi = map_index % width

    // keep track of where the river came from
    let river_from = -1
    // cotinue river as long as there is no water in the current tile

    let river = new Array();
    let riverSet = new Set().asMutable();
    while(state.data.terrain_zones.types[yi*width+xi] > 0){
      // if the river joins itself, just remove it
      // and try again
      if(riverSet.contains(List([xi,yi]))){
        river = new Array();
        /* num_rivers++;*/
        break
      }

      //mark entrance of river
      if(river_from >= 0){
        river.push({pos: [xi,yi], dir: river_from});
        riverSet = riverSet.add(List([xi,yi]))
      }

      // if we've joined a river stop here
      if(rivers[yi*width+xi] > 0) break;

      // get all of the neighbors
      let n = hex_neighbors(xi,yi,[width,height])

      // weight each direction based on the gradient
      // and the last direction the river came from
      let weight_total = 0
      let cum_weights = new Float64Array(6)
      for(let j=0;j<6;j++){
        let max_terrain = 0
        if(river_from != j){
          let tgradient = state.data.terrain[yi*width+xi] -
                          state.data.terrain[n[j*2+1]*width+n[j*2+0]]

          let mgradient = state.data.moist[n[j*2+1]*width+n[j*2+0]] -
                          state.data.moist[yi*width+xi]

          let strength = tgradient + mgradient
          if(river_from >= 0)
            strength += momentum*Math.cos(π/3 * (j-(river_from+3)))/2

          cum_weights[j] = weight_total +=
            Math.exp(weight_sigma_max * (1-randomness) * strength)
        }else cum_weights[j] = weight_total
      }

      // probabilisticaly select a direction based
      // on the weights
      let selection = weight_total*rng.random()
      let next_tile = 5
      for(let j=0;j<6;j++){
        if(cum_weights[j] > selection){
          next_tile = j
          break
        }
      }

      // mark the exit of the river
      river.push({pos: [xi,yi], dir: next_tile})
      riverSet = riverSet.add(List([xi,yi]))

      // move to the next tile
      xi = n[next_tile*2+0]
      yi = n[next_tile*2+1]

      if(xi === 0){
        console.log("near edge!")
      }

      // remember the entrance of the river
      river_from = ((next_tile+3) % 6)

      // if we've reached the end of the map, just let the river run off of it.
      if(yi <= 0 || yi >= height){
        river.push({pos: [xi,yi], dir: next_tile})
        break
      }
    }

    for(let r of river){
      rivers[r.pos[1]*width + r.pos[0]] |= 2**r.dir
    }
  }

  return {
    ...state,
    data: {
      ...state.data,
      rivers: {sides: rivers}
    }
  }
}
