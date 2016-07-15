
const ChatServiceError = require('./ChatServiceError')
const ExecInfo = require('./ExecInfo')
const Promise = require('bluebird')
const _ = require('lodash')
const { debuglog, execHook, possiblyCallback } = require('./utils')

// @private
// @mixin
// @nodoc
//
// Implements command implementation functions binding and wrapping.
// Required existence of server in extented classes.
let CommandBinder = {

  // @private
  bindAck (cb) {
    let { useRawErrorObjects } = this.server
    return function (error, data, ...rest) {
      if ((error != null) && !(error instanceof ChatServiceError)) {
        debuglog(error)
      }
      if (error == null) { error = null }
      if (data == null) { data = null }
      if ((error != null) && !useRawErrorObjects) {
        error = error.toString()
      }
      return cb(error, data, ...rest)
    }
  },

  // @private
  commandWatcher (id, name) {
    this.server.runningCommands++
    return Promise.resolve().disposer(() => {
      this.server.runningCommands--
      if (this.transport.closed && this.server.runningCommands <= 0) {
        this.server.emit('commandsFinished')
      }
    })
  },

  // @private
  makeCommand (name, fn) {
    let self = this
    let { validator } = this.server
    let beforeHook = this.server.hooks[`${name}Before`]
    let afterHook = this.server.hooks[`${name}After`]
    return (args, info, cb) => {
      info = info || {}
      if (cb) {
        var ack = this.bindAck(cb)
      }
      let execInfo = new ExecInfo()
      _.assignIn(execInfo, { server: this.server, userName: this.userName })
      _.assignIn(execInfo, info)
      _.assignIn(execInfo, validator.splitArguments(name, args))
      return Promise.using(
        this.commandWatcher(info.id, name),
        () => validator.checkArguments(name, ...execInfo.args)
          .then(() => {
            if (beforeHook && !execInfo.bypassHooks) {
              return execHook(beforeHook, execInfo)
            } else {
              return Promise.resolve()
            } })
          .then(results => {
            if (results && results.length) { return results }
            return fn.apply(self, [...execInfo.args, execInfo])
              .then(result => { execInfo.results = [result] },
                    error => { execInfo.error = error })
              .then(() => {
                if (afterHook && !execInfo.bypassHooks) {
                  return execHook(afterHook, execInfo)
                } else {
                  return Promise.resolve()
                } })
              .then(results => {
                if (results && results.length) {
                  return results
                } else if (execInfo.error) {
                  return Promise.reject(execInfo.error)
                } else {
                  return execInfo.results
                }
              })
          })
      ).asCallback(ack, { spread: true })
    }
  },

  // @private
  bindCommand (id, name, fn) {
    let cmd = this.makeCommand(name, fn)
    let info = {id}
    return this.transport.bindHandler(id, name, function () {
      let [args, cb] = possiblyCallback(arguments)
      return cmd(args, info, cb)
    })
  }

}

module.exports = CommandBinder
