let gb;

const ServerGame = require('./ServerGame')

setTimeout(() => {
    gb = require('./Globals').gb
}, 0)

class Lobby {
    constructor(id, name) {
        this.id = id;
        this.inGame = false;
        this.game = new ServerGame
        this.host = null
        this.other = null
        this.name = name
        this.connections = []
        this.hostRematch = false
        this.otherRematch = false
    }

    start() {
        this.inGame = true
        this.game.initBoard()
        this.game.initStartingPlr()
    }

    connect(connection) {
        if (this.connections.length < 2)
            this.connections.push(connection)
        connection.lobby = this;
        connection.state = 'lobby'

        return true
    }

    shutDown() {
        for (let c of this.connections) {
            c.socket.send(JSON.stringify({code: 'hostLeft', payload: 'Host has left the lobby.'}))
            c.lobby = null
        }
        if (this.host) {
            this.host.lobby = null
            this.host = null
        }
        if (this.other) {
            this.other.lobby = null
            this.other = null
        }
        this.connections = []
        delete gb.lobbies[this.id]
    }

    disconnect(connection) {
        this.connections = this.connections.filter(value => value != connection)
        if (this.connections.length === 0) {
            this.shutDown();
        }
        else if (this.inGame) {
            for (let c of this.connections) {
                c.socket.send(JSON.stringify({code: 'ingameLeft'}))
            }
        }
        else {
            if (this.host == connection) {
                for (let c of this.connections) {
                    c.socket.send(JSON.stringify({code: 'hostLeft'}))
                    this.shutDown()
                }
            }
            else {
                this.host.socket.send(JSON.stringify({code: 'otherLeft'}))
            }
        }
        if (this.other == connection) {this.other.lobby = null; this.other = null; }
        if (this.host == connection) {this.host.lobby = null; this.host = null;}
    }
}

module.exports = Lobby
