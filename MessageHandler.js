const Lobby = require('./Lobby')
let gb = 40;

let ID = 0;

function mes(code, payload) {
    return JSON.stringify({code: code, payload: payload})
}

function err(msg) {
    return JSON.stringify({code: 'err', payload: msg})
}

setTimeout(() => {
    gb = require('./Globals').gb
}, 0)

class MessageHandler {
    handle(msg, socket, context) {
        if (context.id === null && msg.code !== 'nick') {
            socket.send(JSON.stringify({code: 'err', payload: 'Registration not complete! Nick not yet supplied.'}));
            context._close()
        }
        switch (msg.code) {
            case 'nick':
                if (context.id === null) {
                    if (msg.payload) {
                        if (gb.users[msg.payload] === undefined) {
                            gb.users[msg.payload] = context
                            context.id = msg.payload
                            socket.send(JSON.stringify({code: 'regsucc', payload: msg.payload}))
                        }
                        else {socket.send(JSON.stringify({code: 'err', payload: 'Name already taken'}))}
                    }
                    else {
                        socket.send(JSON.stringify({code: 'err', payload: 'Name not specified'}))
                    }
                }
                else {
                    socket.send(JSON.stringify({code: 'err', payload: 'Cannot re-register your name!'}))
                    context._close()
                }
                break;
            case 'host':
                if (context.lobby === null) {
                    let id = 'g_' + (++ID)
                    let lobby = new Lobby(id, msg.payload)
                    lobby.host = context
                    lobby.connect(context)
                    context.state = 'lobby'
                    gb.lobbies[id] = lobby

                    socket.send(JSON.stringify({code: 'hosted', payload: id}))
                }
                else {
                    socket.send(JSON.stringify({code: 'err', payload: 'Can\'t host a lobby while inside one!'}))
                }
                break;
            case 'connect':
                if (context.lobby === null) {
                    if (msg.payload && gb.lobbies[msg.payload]) {
                        if (gb.lobbies[msg.payload].connections.length < 2) {
                            if (!gb.lobbies[msg.payload].inGame) {
                                gb.lobbies[msg.payload].connect(context)
                                gb.lobbies[msg.payload].other = context
                                socket.send(JSON.stringify({
                                    code: 'joined', payload: {
                                        lobby: msg.payload,
                                        plr1Name: gb.lobbies[msg.payload].host.id,
                                        plr2Name: gb.lobbies[msg.payload].other.id,
                                        startingPlr: gb.lobbies[msg.payload].game.startingPlr,
                                    }
                                }))
                                gb.lobbies[msg.payload].host.socket.send(mes('otherJoined', context.id))
                            }
                            else {
                                socket.send(JSON.stringify({code: 'err', payload: 'Lobby has already started!'}))
                            }
                        }
                        else {
                            socket.send(JSON.stringify({code: 'err', payload: 'Lobby is full!'}))
                        }
                    }
                    else {
                        socket.send(err('Lobby does not exist'))
                    }
                }
                else {
                    socket.send(JSON.stringify({code: 'err', payload: 'You already are in a lobby!'}))
                }
                break;
            case 'config':
                break;
            case 'lobbies':
                let lobs = Object.keys(gb.lobbies).map(value => {
                    value = gb.lobbies[value]
                    return {
                        name: value.name,
                        id: value.id,
                        author: value.host ? value.host.id : 'no host (wtf)', players: value.connections.length
                    }
                }).filter((v) => {
                    return gb.lobbies[v.id].inGame == false
                })
                socket.send(JSON.stringify({code: 'lobbies', payload: lobs}))
                break;
            case 'debug':
                let users = []
                for (let k in gb.users) {
                    let lobby = 'nope'
                    if (gb.users[k].lobby !== null) lobby = gb.users[k].lobby.id
                    users.push({
                        id: gb.users[k].id,
                        lobby: lobby,
                        state: gb.users[k].state
                    })
                }
                let lobbies = []
                for (let k in gb.lobbies) {
                    let lobby = gb.lobbies[k]
                    let host = lobby.host ? lobby.host.id : 'nope'
                    let connections = []
                    for (let c of lobby.connections) {
                        connections.push(c.id)
                    }

                    lobbies.push({
                        name: lobby.name,
                        host: host,
                        players: connections,
                        inGame: lobby.ingame
                    })
                }
                socket.send(JSON.stringify({
                    code: 'debug', payload: {
                        users, lobbies
                    }
                }))
                break;
            case 'swapStartingPlayer':
                if (context.lobby) {
                    if (context.lobby.host == context) {
                        let startingPlr = context.lobby.game.swapStartingPlayer()
                        for (let c of context.lobby.connections) {
                            c.socket.send(mes('startingPlayer', startingPlr))
                        }
                    }
                    else {
                        socket.send(err('You are not the host bruv!'))
                    }
                }
                else {
                    socket.send(err('You are not in a lobby bruv!'))
                }
                break;
            case 'start':
                if (context.lobby) {
                    if (context.lobby.host == context) {
                        if (context.lobby.connections.length >= 2) {
                            let game = context.lobby.game
                            context.lobby.start()
                            for (let c of context.lobby.connections) {
                                c.socket.send(mes('started', {
                                    turn: game.turn,
                                    localPlayerId: c == c.lobby.host ? 1 : 2
                                }))
                            }
                        }
                        else {
                            socket.send(err('Not enough players to start the lobby!'))
                        }
                    }
                    else {
                        socket.send(err('You are not the host of the lobby!'))
                    }
                }
                else {
                    socket.send(err('You are not in a lobby!'))
                }
                break;
            case 'disconnect':
                if (context.lobby) {
                    context.lobby.disconnect(context)
                }
                else {
                    socket.send(err('You are not in a lobby!'))
                }
                break;
            case 'play':
                if (context.lobby && context.lobby.game.started) {
                    let game = context.lobby.game
                    if (game.turn == 2 && context.lobby.other == context ||
                        game.turn == 1 && context.lobby.host == context) {

                        let plr = game.turn
                        let {x, y} = msg.payload
                        let result = game.play(x, y)

                        if (result === false) {
                            socket.send(err('Invalid move!'))
                        }
                        else if (result.win) {
                            for (let c of context.lobby.connections) {
                                c.socket.send(mes('played', {x, y, plr, next: plr}))
                                c.socket.send(mes('highlight', result.highlight))
                                c.socket.send(mes('winner', context.lobby.game.turn))
                            }
                        }
                        else {
                            for (let c of context.lobby.connections) {
                                c.socket.send(mes('played', {x, y, plr, next: game.turn}))
                                c.socket.send(mes('highlight', result.highlight))
                            }
                        }
                    }
                    else {
                        socket.send(err('Not your turn hombre!'))
                    }
                }
                break;
            case 'rematch':
                if (context.lobby && context.lobby.inGame && context.lobby.host && context.lobby.other) {
                    let l = context.lobby
                    console.log(`host id: ${l.host.id} other id: ${l.other.id}`);
                    if (l.host == context && l.hostRematch == false) {
                        console.log('host wants rematch');
                        l.hostRematch = true
                    }
                    else if (l.other == context && l.otherRematch == false) {
                        console.log('other wants rematch');
                        l.otherRematch = true
                    }
                    if (l.otherRematch && l.hostRematch) {
                        console.log('both want rematch');
                        let game = context.lobby.game
                        context.lobby.start()
                        context.lobby.hostRematch = false
                        context.lobby.otherRematch = false
                        for (let c of context.lobby.connections) {
                            c.socket.send(mes('highlight', {}))
                            c.socket.send(mes('started', {
                                turn: game.turn,
                                localPlayerId: c == c.lobby.host ? 1 : 2
                            }))
                        }
                    }
                    else {
                        if (!l.otherRematch) {
                            console.log('annoying other');
                            context.lobby.other.socket.send(mes('rematch'), '')
                        }
                        else {
                            console.log('annoying host');
                            context.lobby.host.socket.send(mes('rematch'), '')
                        }
                    }
                }
                break;
            case 'surrender':
                if (context.lobby && context.lobby.inGame && context.lobby.game.winner == null) {
                    if (context.lobby.host == context) {
                        context.lobby.game.winner = 2
                    }
                    else {
                        context.lobby.game.winner = 1
                    }
                    if (context.lobby.host) {context.lobby.host(mes('winner', context.lobby.game.winner))}
                    if (context.lobby.other) {context.other.host(mes('winner', context.lobby.game.winner))}
                }
                break;
            default:
                console.log('Unknown message code:\n', msg);
        }
    }
}

module.exports = MessageHandler
