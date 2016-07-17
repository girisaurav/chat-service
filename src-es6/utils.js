
const ChatServiceError = require('./ChatServiceError')
const Promise = require('bluebird')
const _ = require('lodash')
const util = require('util')

let debuglog = util.debuglog('ChatService')

let asyncLimit = 32

let nameChecker = /^[^\u0000-\u001F:{}\u007F]+$/

let mix = function (c, ...mixins) {
  for (let i = 0; i < mixins.length; i++) {
    let mixin = mixins[i]
    for (let name in mixin) {
      let method = mixin[name]
      if (!c.prototype[name]) {
        c.prototype[name] = method
      }
    }
  }
}

let possiblyCallback = function (args) {
  let cb = _.last(args)
  if (_.isFunction(cb)) {
    args = _.slice(args, 0, -1)
  } else {
    cb = null
  }
  return [args, cb]
}

let checkNameSymbols = function (name) {
  if (_.isString(name) && nameChecker.test(name)) {
    return Promise.resolve()
  } else {
    return Promise.reject(new ChatServiceError('invalidName', name))
  }
}

let execHook = function (hook, ...args) {
  if (!hook) { return Promise.resolve() }
  let cb = null
  let callbackData = null
  let wrapper = function (...data) {
    callbackData = data
    if (cb) { cb(...data) }
  }
  let res = hook(...args, wrapper)
  if (callbackData) {
    return Promise.fromCallback(
      fn => { fn(...callbackData) },
      {multiArgs: true})
  } else if ((res != null) && typeof res.then === 'function') {
    return res
  } else {
    return Promise.fromCallback(fn => { cb = fn }, {multiArgs: true})
  }
}

let run = function (self, gen) {
  return Promise.coroutine(gen).call(self)
}

module.exports = {
  asyncLimit,
  checkNameSymbols,
  debuglog,
  execHook,
  mix,
  nameChecker,
  possiblyCallback,
  run
}
