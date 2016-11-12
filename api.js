'use strict'

import {struct, refinement, String, Number} from 'tcomb'
import rp from 'request-promise'
import {castArray} from 'lodash'

const Station = struct({
  name: String,
  lon: String,
  lat: String,
  id: String
}, 'Station')

const Timestamp = refinement(Number, (n) => n % 1 === 0 && n > 0, 'Timestamp')

function DBFahrplanAPI (apiKey, lang) {
  lang = lang || 'en'
  String(apiKey)
  String(lang)
  this.apiKey = apiKey
  this.lang = lang
}

DBFahrplanAPI.prototype.findStationByName = function (search) {
  String(search)
  const self = this
  return rp({
    method: 'GET',
    uri: 'https://open-api.bahn.de/bin/rest.exe/location.name',
    qs: {
      format: 'json',
      lang: self.lang,
      input: search,
      authKey: self.apiKey
    },
    json: true
  })
    .then(response => response.LocationList.StopLocation[0])
}

DBFahrplanAPI.prototype.getStationDepartureBoard = function (station, time) {
  Station(station)
  Timestamp(time)
  const self = this
  return rp({
    method: 'GET',
    uri: 'https://open-api.bahn.de/bin/rest.exe/departureBoard',
    qs: {
      format: 'json',
      lang: self.lang,
      id: station.id,
      authKey: self.apiKey
    },
    json: true
  })
    .then(response => castArray(response.DepartureBoard.Departure))
    .map(trainJourney => rp({uri: trainJourney.JourneyDetailRef.ref, json: true}).then(journeyDetail => {
      trainJourney.stops = journeyDetail.JourneyDetail && journeyDetail.JourneyDetail.Stops ? journeyDetail.JourneyDetail.Stops.Stop : []
      return trainJourney
    }))
}

export default DBFahrplanAPI
