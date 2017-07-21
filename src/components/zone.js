import React from 'react'
import {connect} from 'react-redux'
import _ from 'underscore'

import {Table,TableBody,TableHeader,TableHeaderColumn,
        TableRow,TableRowColumn} from 'material-ui/Table';
import TextField from 'material-ui/TextField'
import Slider from 'material-ui/Slider'
import Paper from 'material-ui/Paper'
import IconButton from 'material-ui/IconButton'
import FlatButton from 'material-ui/FlatButton'
import RaisedButton from 'material-ui/RaisedButton'

import ViewIcon from 'material-ui/svg-icons/image/remove-red-eye'

import {ZONE_UPDATE} from '../actions'
import {checkNumber, DEFAULT_COLORBY} from '../util'

const zones = ["Ocean","Land","Hills","Mountains"]

function updatePercentsFn(index,value){
  let bValue = Math.min(1,Math.max(0,value))
  return (percents) => {
    return percents.withMutations(percents => {
      percents = percents.set(index,bValue)
      let delta = (1 - percents.reduce((x,y) => x+y))/(percents.count()-1)
      
      for(let i=0;i<percents.count();i++){
        if(i != index){
          percents = percents.update(i,x => Math.min(1,Math.max(0,x + delta)))
        }
      }
      return percents
    })
  }
}

class ZoneDialog extends React.Component{
  constructor(props){
    super(props)
    this.state = {zones: this.props.zones, colorby: this.props.colorby}
  }
  componentWillMount(){
    this.setState({zones: this.props.zones, colorby: this.props.colorby})
  }

  setZone(keys,value){
    if(keys[0] == 'percent')
      this.setState({
        zones: this.state.zones.update('percent',
                                       updatePercentsFn(keys[1],value)),
        colorby: "zones"
      })
    else
      this.setState({
        zones: this.state.zones.setIn(keys,value),
        colorby: "zones"
      })
  }
  zone(keys){
    return this.state.zones.getIn(keys)
  }

  setActive(str){
    this.setState(state => this.state.colorby !== str ?
                         {colorby: str} : {colorby: DEFAULT_COLORBY})
  }
  iconColor(str){
    return str === this.state.colorby ? "black" : "darkgray"
  }


  render(){
    return (
      <Paper zDepth={2} className={"terrain-view"}>
        <div style={{padding: "12pt"}}>
          <h3 style={{margin: 0, marginBottom: "1em"}}>Terrain Zones</h3>
          <FlatButton onClick={() => this.setActive("zones")}
                      label="Display" icon={<ViewIcon/>}
                      style={{color: this.iconColor("zones")}}/>
          <Table selectable={false}>

            <TableHeader displaySelectAll={false} adjustForCheckbox={false}>
              <TableRow>
                <TableHeaderColumn>Zone</TableHeaderColumn>
                <TableHeaderColumn>% of map</TableHeaderColumn>
                <TableHeaderColumn>depth</TableHeaderColumn>
              </TableRow>
            </TableHeader>

            <TableBody displayRowCheckbox={false}>
              {(_.map(zones,(zone,index) => 
                <TableRow key={index}>
                  <TableRowColumn>{zone}</TableRowColumn>

                  <TableRowColumn>
                    <Slider key={"pslider"} value={this.zone(["percent",index])}
                            sliderStyle={{margin: "0.2em"}}
                            onChange={(e,v) =>
                              this.setZone(['percent',index],v)}/>
                  </TableRowColumn>

                  <TableRowColumn>
                    <Slider key={"dslider"} value={this.zone(["depth",index])}
                            sliderStyle={{margin: "0.2em"}}
                            onChange={(e,v) =>
                              this.setZone(['depth',index],v)}/>
                  </TableRowColumn>
                </TableRow>))}
            </TableBody>
          </Table>

          <div style={{width: "1em", height: "3em"}}/>

          <RaisedButton style={{position: "absolute",
                                bottom: "1em", right: "1em"}}
                        primary={true}
                        onClick={() =>
                          this.props.onZoneUpdate(this.state)}>
            Render
          </RaisedButton>
        </div>
      </Paper>
    )
  }
}

export default connect(state => {
  return {
    zones: state.map.settings.get('zones'),
    colorby: state.map.settings.get('colorby')
  }
},dispatch => {
  return {
    onZoneUpdate: (state) => {
      dispatch({type: ZONE_UPDATE, value: state.zones, colorby: state.colorby})
    }
  }
})(ZoneDialog)
