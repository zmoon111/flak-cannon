/*eslint no-console:0*/
'use strict'
var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var useragent = require('express-useragent')
var database = process.env.NODE_ENV === 'test' ? 'flak_cannon_test' : 'flak_cannon'
var mongoose = require('mongoose')
var sensitive = require('./sensitive')
var mongoHost = sensitive.mongo.host || 'localhost'
var mongoPort = sensitive.mongo.port || 27017
var mongoUser = sensitive.mongo.user
var mongoPass = sensitive.mongo.pass
mongoose.connect(sensitive.mongo.user ?
  'mongodb://' + mongoUser + ':' + mongoPass + '@' + mongoHost + ':' + mongoPort + '/' + database :
  'mongodb://' + mongoHost + ':' + mongoPort + '/' + database)
var uuid = require('node-uuid')
var _ = require('lodash')
var basicAuth = require('basic-auth-connect')


app.use(bodyParser())
app.use(useragent.express())

var port = process.env.PORT || 3000
var router = express.Router()

var User = require('./models/user')
var Experiment = require('./models/experiment')
var Conversion = require('./models/conversion')

var isAdmin = basicAuth('admin', sensitive.adminPassword)

if (process.env.NODE_ENV === 'test') {
  router.put('/_tests/reset', function (req, res) {
    User.remove(function (err) {
      if (err) {
        return res.send(err)
      }
      Experiment.remove(function (err) {
        if (err) {
          return res.send(err)
        }

        res.json({success: true})
      })
    })
  })
}

router.post('/users', function (req, res) {
  var defaultInfo = {
    ip: req.ip
  }

  if (req.headers['user-agent']) {

    // merge in user agent based info
    _.merge(defaultInfo, _.transform(req.useragent, function (obj, val, key) {
        if(val) {
          obj[key] = val
        }
    }))
  }

  var defaultUser = {
    id: uuid.v4(),
    info: defaultInfo
  }

  var user = new User(_.defaults(req.body, defaultUser))

  User.findOne({clientId: user.clientId}, function (err, member) {
    if (err) {
      return res.send(err)
    }
    if (user.clientId && member) {
      user.experiments = member.experiments
      return user.save(function (err, user) {
        if (err) {
          return res.send(err)
        }

        res.json(user)
      })
    }
  User.findOne({group: user.group}, function (err, member) {
    if (err) {
      return res.send(err)
    }

    if (user.group && member) {
      user.experiments = member.experiments
      return user.save(function (err, user) {
        if (err) {
          return res.send(err)
        }

        res.json(user)
      })
    }

    Experiment.find(function (err, experiments) {
      var experiment = _.sample(experiments)
      if (experiment) {
        var val = _.sample(experiment.values)

        if (!user.experiments) {
          user.experiments = {}
        }

        user.experiments[experiment.name] = val
      }

      user.save(function (err, user) {
        if (err) {
          return res.send(err)
        }

        res.json(user)
      })
    })
  })
})
})

router.get('/users/:id', function (req, res) {
  var id = req.params.id

  User.findOne({id: id}, function (err, user) {
    if (err) {
      return res.send(err)
    }

    res.json(user)
  })
})

router.delete('/users/:id/experiments/:name', isAdmin, function (req, res) {
  var id = req.params.id
  var name = req.params.name

  User.findOne({id: id}, function (err, user) {
    if (err) {
      return res.send(err)
    }

    delete user.experiments[name]
    user.save(function (err, user) {
      if (err) {
        return res.send(err)
      }

      res.json(user)
    })
  })
})

router.put('/users/:id/group/:group', isAdmin, function (req, res) {
  var id = req.params.id
  var group = req.params.group

  User.findOne({id: id}, function (err, user) {
    if (err) {
      return res.send(err)
    }

    user.group = group
    user.save(function (err, user) {
      if (err) {
        return res.send(err)
      }

      res.json(user)
    })
  })
})

router.put('/users/:id/experiments/:name/:val?', isAdmin, function (req, res) {
  var id = req.params.id
  var expName = req.params.name
  var val = req.params.val

  Experiment.findOne({name: expName}, function (err, experiment) {
    if (err) {
      return res.send(err)
    }

    if (!experiment) {
      return res.send(404)
    }

    User.findOne({id: id}, function (err, user) {
      if (err) {
        return res.send(err)
      }

      if (!user) {
        return res.send(404)
      }

      val = val || _.sample(experiment.values)
      user.experiments = user.experiments || {}
      user.experiments[expName] = val

      user.save(function (err, user) {
        if (err) {
          return res.send(err)
        }

        res.json(user)
      })
    })
  })
})

router.put('/users/:userId/convert/:name', function (req, res) {
  var userId = req.params.userId
  var name = req.params.name
  var timestamp

  // TODO: abstract this out
  if (process.env.NODE_ENV === 'test') {
    timestamp = req.params.timestamp
  }

  User.findOne({id: userId}, function (err, user) {
    if (err) {
      return res.send(err)
    }

    var conversionConstructor = {
      name: name,
      userId: userId,
      experiments: user.experiments
    }

    if (timestamp) {
      conversionConstructor.timestamp = timestamp
    }

    var conversion = new Conversion(conversionConstructor)

    conversion.save(function (err, conversion) {
      if (err) {
        return res.send(err)
      }

      res.json(conversion)
    })
  })
})

router.post('/experiments', isAdmin, function (req, res) {
  var experiment = new Experiment(req.body)

  experiment.save(function (err, experiment) {
    if (err) {
      return res.send(err)
    }

    res.json(experiment)
  })
})

router.delete('/experiments/:name', isAdmin, function (req, res) {
  var name = req.params.name
  Experiment.remove({name: name}, function (err) {
    if (err) {
      return res.send(err)
    }

    res.json({success: true})
  })
})

router.get('/experiments/:name/results', isAdmin, function (req, res) {
  var name = req.params.name
  var query = {}
  /*
  [{
    // experiment test key
    expVal1: {

      // split : signups
      'platform1:browser1': 10,
      'platform2:browser1': 20,
      'platform1:browser2': 100
    },
    expVal2: {
      // ...
    }
    // ...
  }]*/
  query['experiments.' + name] = {$exists: true}
  User.find(query, function (err, users) {
    if (err) {
      return res.send(err)
    }

    res.json(users)
  })
})

app.use('/api', router)
module.exports = app
