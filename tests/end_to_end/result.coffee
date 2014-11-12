Flare = require 'flare-gun'
Joi = require 'joi'

app = require '../../'
Conversion = require '../../models/conversion'

flare = new Flare().express(app)

describe 'Result Routes', ->
  it '[legacy] gets results', ->
    for i in [1..30]
      flare = flare
        .post '/conversions', {event: 'event_name', data: id: i}
        .expect 200


    from = new Date()
    from.setDate(from.getDate() - 7)
    to = new Date()
    to.setDate(to.getDate() + 1)

    queryParams = "event=signup&param=login_button&from=#{from}&to=#{to}"
    flare
      .get "/results?#{queryParams}"
      .expect 200, Joi.object().keys
        views: Joi.array().includes Joi.object().keys
          param: Joi.string()
          count: Joi.number()
        counts: Joi.array().includes(
          Joi.array().includes(
            Joi.object().keys
              date: Joi.string()
              value: Joi.string()
              count: Joi.number()
            )
          )

  it 'supports uniq conversions', ->
    from = new Date()
    from.setDate(from.getDate() - 7)
    to = new Date()
    to.setDate(to.getDate() + 1)

    queryParams = "event=only_one&param=login_button&from=#{from}&to=#{to}"
    flare
      .post '/conversions', {event: 'only_one', uniq: '123', userId: 123}
      .expect 200
      .post '/conversions', {event: 'only_one', uniq: '123', userId: 123}
      .expect 200
      .get "/results?#{queryParams}"
      .expect 200, Joi.object().keys
        views: Joi.array().includes
          param: Joi.string()
          count: Joi.number()
        counts: Joi.array().includes(
          Joi.array().includes
            date: Joi.string()
            value: Joi.string()
            count: 1
        )

  describe 'supports custom d7 view counter', ->
    before ->
      Conversion.remove().exec()

    it 'counts' , ->
      from = new Date()
      from.setDate(from.getDate() - 7)
      to = new Date()
      to.setDate(to.getDate() + 1)

      queryParams = "event=d7&param=login_button&from=#{from}&to=#{to}" +
                    '&viewCounter=d7'

      # 2 people (1 per param) converted D7
      # there were 4 people who signed up 10 days ago (2 that converted D7)
      timestamp = new Date() # 10 days ago
      timestamp.setDate(timestamp.getDate() - 10)
      flare
        .post '/conversions', {event: 'signup', userId: 1, timestamp}
        .expect 200
        .post '/conversions', {event: 'signup', userId: 1, timestamp}
        .expect 200
        .post '/conversions', {event: 'signup', userId: 2, timestamp}
        .expect 200
        .post '/conversions', {event: 'signup', userId: 2, timestamp}
        .expect 200
        .post '/conversions', {event: 'signup', userId: 2, timestamp}
        .expect 200
        .post '/conversions', {event: 'signup', userId: 2, timestamp}
        .expect 200
        .post '/conversions', {event: 'signup', userId: 2, from}
        .expect 200
        .post '/conversions', {event: 'd7', userId: 1}
        .expect 200
        .post '/conversions', {event: 'd7', userId: 2}
        .expect 200
        .get "/results?#{queryParams}"
        #.flare (x) -> console.log x.res.body.views
        .expect 200, Joi.object().keys
          views: Joi.array().min(2).includes
            param: Joi.string()
            count: Joi.number().valid(2, 4)
          counts: Joi.array().includes(
            Joi.array().includes
              date: Joi.string()
              value: Joi.string()
              count: Joi.number()
          )

  describe 'supports custom dau view counter', ->
    before ->
      Conversion.remove().exec()

    it 'counts', ->
      from = new Date()
      from.setDate(from.getDate() - 7)
      to = new Date()
      to.setDate(to.getDate() + 1)

      queryParams = "event=engaged_gameplay&param=login_button&from=#{from}" +
                    "&to=#{to}&viewCounter=dau"

      yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      flare
        .post '/experiments', {id: 123, timestamp: yesterday}
        .expect 200
        .post '/experiments', {id: 123}
        .expect 200
        .post '/experiments', {id: 123}
        .expect 200
        .post '/experiments', {id: 124, timestamp: yesterday}
        .expect 200
        .post '/experiments', {id: 124}
        .expect 200
        .post '/conversions', {event: 'engaged_gameplay', userId: 123}
        .expect 200
        .get "/results?#{queryParams}"
        #.flare (x) -> console.log x.res.body.views
        .expect 200, Joi.object().keys
          views: Joi.array().min(2).includes
            param: Joi.string()
            count: Joi.number().valid(2)
          counts: Joi.array().includes(
            Joi.array().includes
              date: Joi.string()
              value: Joi.string()
              count: Joi.number()
          )