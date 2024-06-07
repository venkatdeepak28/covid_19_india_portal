let express = require('express')
let app = express()

app.use(express.json())

let {open} = require('sqlite')
let sqlite3 = require('sqlite3')
let path = require('path')
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')

let dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

let initalizeDbandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started')
    })
  } catch (e) {
    console.log(`Error: "${e.message}"`)
  }
}

module.exports = app

initalizeDbandServer()

let convertObjProp = givenValue => {
  return {
    stateId: givenValue.state_id,
    stateName: givenValue.state_name,
    population: givenValue.population,
  }
}

let convertDistrictProp = valueIs => {
  return {
    districtId: valueIs.district_id,
    districtName: valueIs.district_name,
    stateId: valueIs.state_id,
    cases: valueIs.cases,
    cured: valueIs.cured,
    active: valueIs.active,
    deaths: valueIs.deaths,
  }
}

let totalStats = statsValue => {
  return {
    totalCases: statsValue.SUM(cases),
    totalcured: statsValue.SUM(cured),
    totalActive: statsValue.SUM(active),
    totalDeaths: statsValue.SUM(deaths),
  }
}

let authenticationUser = (request, response, next) => {
  let jwtValue
  let authHeader = request.header('authorization')
  if (authHeader !== undefined) {
    jwtValue = authHeader.split(' ')[1]
  }
  if (jwtValue === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtValue, 'kirramaskiloriparri', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// API 1

app.post('/login', async (request, response) => {
  let {username, password} = request.body
  const checkUserQuery = `SELECT * FROM user WHERE username = "${username}";`
  let checkUser = await db.get(checkUserQuery)
  if (checkUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    let isPasswordTrue = await bcrypt.compare(password, checkUser.password)
    if (isPasswordTrue === false) {
      response.status(400)
      response.send('Invalid password')
    } else {
      let payload = {username}
      let jwtToken = await jwt.sign(payload, 'kirramaskiloriparri')
      response.send({jwtToken})
    }
  }
})

//API 2

app.get('/states/', authenticationUser , async (request, response) => {
  const listStateQuery = `SELECT * FROM state;`
  let stateValue = await db.all(listStateQuery)
  response.send(stateValue.map(eachValue => convertObjProp(eachValue)))
})

//API 3

app.get('/states/:stateId', authenticationUser, async (request, response) => {
  let {stateId} = request.params
  const singleQueryValue = `SELECT * FROM state WHERE state_id = ${stateId};`
  let getQueryValue = await db.get(singleQueryValue)
  response.send(convertObjProp(getQueryValue))
})

//API 4

app.post('/districts/', authenticationUser, async (request, response) => {
  let {districtName, stateId, cases, cured, active, deaths} = request.body
  const districtQueryValue = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  values("${districtName}",${stateId},${cases},${cured},${active},${deaths});`
  let createDistrict = await db.run(districtQueryValue)
  response.send('District Successfully Added')
})

// API 5

app.get(
  '/districts/:districtId',
  authenticationUser,
  async (request, response) => {
    let {districtId} = request.params
    const districtQueryValue = `SELECT * FROM district WHERE district_id = ${districtId};`
    let getQueryValue = await db.get(districtQueryValue)
    response.send(convertDistrictProp(getQueryValue))
  },
)

// API 6

app.delete(
  '/districts/:districtId',
  authenticationUser,
  async (request, response) => {
    let {districtId} = request.params
    const deleteQueryValue = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(deleteQueryValue)
    response.send('District Removed')
  },
)

// API 7

app.put(
  '/districts/:districtId',
  authenticationUser,
  async (request, response) => {
    let {districtId} = request.params
    let {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQueryValue = `UPDATE district 
  SET district_name = "${districtName}",state_id = ${stateId}, cases = ${cases},cured = ${cured},active = ${active},deaths = ${deaths}
  WHERE district_id = ${districtId};`
    let updateDistrictQueryValue = await db.run(updateQueryValue)
    response.send('District Details Updated')
  },
)

// API 8

app.get(
  '/states/:stateId/stats',
  authenticationUser,
  async (request, response) => {
    let {stateId} = request.params
    const statsQuery = `SELECT SUM(cases) as totalCases,SUM(cured) as totalCured,SUM(active) as totalActive,SUM(deaths) as totalDeaths FROM district where state_id = ${stateId};`
    let queryResult = await db.all(statsQuery)
    response.send(queryResult[0])
  },
)
