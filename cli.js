#!/usr/bin/env node
'use strict'

import program from 'commander'
import DBFarhplanAPI from './api'
import Promise from 'bluebird'
import moment from 'moment'
import {sortBy, trimCharsStart, map} from 'lodash/fp'
import colors from 'colors'

const knownStopIds = {}
const stopsInRange = []

const findStationsInRange = (api, distance, start, legs) => {
  const previousLeg = legs[legs.length - 1]
  const startStation = previousLeg.station
  const travelTime = previousLeg.travelTime
  console.log(colors.yellow('Search from', startStation.name, 'starting at', moment(start).format(), 'within', distance))
  return api.getStationDepartureBoard(startStation, start)
    .map(connection => {
      const connectionStart = moment(connection.date + 'T' + connection.time)
      return Promise
        .filter(connection.stops, stop => trimCharsStart(['0'])(startStation.id) !== stop.id)
        .map(stop => {
          const arrival = stop.arrTime ? moment(stop.arrDate + 'T' + stop.arrTime) : moment(stop.depDate + 'T' + stop.depTime)
          const diff = moment.duration(arrival.diff(connectionStart))
          const diffInMinutes = diff.asMinutes()
          if (diffInMinutes < 0) return // stop is behind
          if (diffInMinutes < distance) {
            if (knownStopIds[stop.id]) return
            knownStopIds[stop.id] = true
            stopsInRange.push({
              connection,
              stop,
              diffInMinutes: diffInMinutes + travelTime,
              legs
            })
            return findStationsInRange(api, distance - diffInMinutes, arrival.valueOf(), [...legs, {travelTime: diffInMinutes, station: stop}])
          }
        })
    })
}

program
  .command('rangefinder')
  .option('-k, --key [key]', 'API key')
  .option('-d, --distance <minutes>', 'Distance in minutes', '45')
  .option('-s, --station <station>', 'The station station', 'Frankfurt(Main)Hbf')
  .option('-s, --time <time>', 'The start time', new Date())
  .description('search DB stations within a range of')
  .action(
    options => {
      const start = Date.parse(options.time)
      const api = new DBFarhplanAPI(options.key)
      const minutes = parseInt(options.distance, 10)
      console.log(colors.cyan('Searching for stops in range of', minutes, 'minutes around', options.station, '…'))
      return api.findStationByName(options.station)
        .then(startStation => findStationsInRange(api, minutes, start, [{travelTime: 0, station: startStation}]))
        .then(() => Promise
          .map(sortBy('diffInMinutes')(stopsInRange), stop => {
            console.log(colors.blue('-', Math.round(stop.diffInMinutes) + 'min', stop.stop.name))
            map(leg => {
              let arrTime
              if (leg.station.depTime) arrTime = leg.station.depTime
              if (leg.station.arrTime) arrTime = leg.station.arrTime
              if (arrTime) {
                console.log(colors.green('    via', leg.station.name, arrTime))
              }
            })(stop.legs)
          })
        )
    }
  )

program.parse(process.argv)
