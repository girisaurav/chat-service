
const ChatServiceError = require('./ChatServiceError')
const Promise = require('bluebird')
const { mix } = require('./utils')

// @private
// @mixin
// @nodoc
//
// Implements direct messaging permissions checks. Required existence
// of userName, directMessagingState and in extented classes.
let DirectMessagingPermissions = {

  // @private
  checkList (author, listName) {
    return this.directMessagingState.checkList(listName)
  },

  // @private
  checkListValues (author, listName, values) {
    return this.checkList(author, listName).then(() => {
      for (let i = 0; i < values.length; i++) {
        let name = values[i]
        if (name === this.userName) {
          return Promise.reject(new ChatServiceError('notAllowed'))
        } else {
          return Promise.resolve()
        }
      }
    })
  },

  // @private
  checkAcess (userName, bypassPermissions) {
    if (userName === this.userName) {
      return Promise.reject(new ChatServiceError('notAllowed'))
    }
    if (bypassPermissions) { return Promise.resolve() }
    return this.directMessagingState.hasInList('blacklist', userName)
      .then(blacklisted => {
        if (blacklisted) {
          return Promise.reject(new ChatServiceError('notAllowed'))
        }
        return this.directMessagingState.whitelistOnlyGet()
          .then(whitelistOnly => {
            if (!whitelistOnly) { return Promise.resolve() }
            return this.directMessagingState.hasInList('whitelist', userName)
              .then(whitelisted => {
                if (whitelisted) { return Promise.resolve() }
                return Promise.reject(new ChatServiceError('notAllowed'))
              })
          })
      })
  }
}

// @private
// @nodoc
//
// @extend DirectMessagingPermissions
// Implements direct messaging state manipulations with the respect to
// user's permissions.
class DirectMessaging {

  // @private
  constructor (server, userName) {
    this.server = server
    this.userName = userName
    let State = this.server.state.DirectMessagingState
    this.directMessagingState = new State(this.server, this.userName)
  }

  // @private
  initState (state) {
    return this.directMessagingState.initState(state)
  }

  removeState () {
    return this.directMessagingState.removeState()
  }

  // @private
  message (author, msg, bypassPermissions) {
    return this.checkAcess(author, bypassPermissions)
  }

  // @private
  getList (author, listName) {
    return this.checkList(author, listName)
      .then(() => this.directMessagingState.getList(listName))
  }

  // @private
  addToList (author, listName, values) {
    return this.checkListValues(author, listName, values)
      .then(() => this.directMessagingState.addToList(listName, values))
  }

  // @private
  removeFromList (author, listName, values) {
    return this.checkListValues(author, listName, values)
      .then(() => this.directMessagingState.removeFromList(listName, values))
  }

  // @private
  getMode (author) {
    return this.directMessagingState.whitelistOnlyGet()
  }

  // @private
  changeMode (author, mode) {
    return this.directMessagingState.whitelistOnlySet(mode)
  }
}

mix(DirectMessaging, DirectMessagingPermissions)

module.exports = DirectMessaging
