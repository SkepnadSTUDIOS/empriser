import {MAP_UPDATE_BEGIN, MAP_COMMAND, LOADING, MAP_UPDATE_PROGRESS} from './index.js'

let map_worker = undefined

export default function map_update(dispatch,state,action){
  if(!map_worker){
    map_worker = new window.Worker('worker.bundle.js');
  }

  if(state.data == LOADING){
    console.warn("A map load is pending, new changes will fail.")
    return
  }
  dispatch({type: MAP_UPDATE_BEGIN})

  let processing = true
  let step = 0
  let tick = () => {
    dispatch({type: MAP_UPDATE_PROGRESS, value: step++})
    if(processing)
      setTimeout(tick,100)
  }
  setTimeout(tick,100)

  map_worker.onmessage = event => {
    processing = false
    dispatch(event.data)
  }

  map_worker.postMessage({
    type: MAP_COMMAND,
    settings: state.settings.toJS(),
    action
  });
}
