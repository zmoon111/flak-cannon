pick = require '../lib/pick'

class LoginButtonExperiment
  params: ['login_button']
  assign: (userId) ->
    login_button: pick.uniformChoice(userId, ['orange', 'purple', 'cyan'])


module.exports = new LoginButtonExperiment()