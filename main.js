const WebSocket = require('ws');
let config = require('./config')

try {
    localConfig = require('./config.local')
    config = {...config, ... localConfig}
}
catch (e) {
    console.info('No local configuration file found. (If you wish to create one, name it config.local.js)');
}
const port = process.env.PORT || config.PORT
const wss = new WebSocket.Server({port: port});

const GameBank = new (require('./GameBank'))()
const MessageHandler = new (require('./MessageHandler'))
let globals = require('./Globals')

globals.gb = GameBank

console.log(`Started server on port ${port}`);

wss.on('connection', function connection(ws) {
    let context = {
        lobby: null,
        socket: ws,
        state: 'lobbies',
        id: null,
        _close() {
            this.socket.close();
            if (this.id !== null) {
                delete globals.gb.users[this.id]
            }
            if (this.lobby !== null) {
                this.lobby.disconnect(this)
            }
        }
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message)
            MessageHandler.handle(data, ws, context)
        } catch (Error) {
            console.log(Error);
            this.close()
        }
    });
    ws.on('close', () => {
        console.log('rip close', context.id);
        context._close()
    })
    ws.on('error', () => {
        console.log('rip error', context.id);
        context._close()
    })

    ws.send(JSON.stringify({code: 'motd', payload: 'u suck xd'}));
})
;
