const Player = require('./Player')

class ServerGame {
    plr1 = new Player();
    plr2 = new Player();
    width = 15;
    height = 15;
    board = [];
    turn = 0; // current player id
    round = 0;
    started = false;
    startingPlr = 'Player 1';
    history = [];
    winner = null;
    highlight = {}

    constructor() {
    }

    swapStartingPlayer() {
        if (this.startingPlr == 'Player 1') {
            this.startingPlr = 'Player 2'
        }
        else if (this.startingPlr == 'Player 2') {
            this.startingPlr = 'Random'
        }
        else {
            this.startingPlr = 'Player 1'
        }
        return this.startingPlr
    }

    reset() {
        this.turn = 0
        this.round = 0
        this.started = false
        this.history = null
        this.winner = null
        this.highlight = {}
        this.initBoard()
        this.initStartingPlr()
    }

    initBoard() {
        this.winner = null
        this.board = []
        if (this.width < 5) this.width = 5;
        if (this.height < 5) this.height = 5;
        for (let i = 0; i < this.width; i++) {
            this.board[i] = []
            for (let j = 0; j < this.height; j++) {
                this.board[i][j] = 0;
            }
        }
    }

    initStartingPlr() {
        switch (this.startingPlr) {
            case "Player 1":
                this.turn = 1;
                break;
            case "Player 2":
                this.turn = 2;
                break;
            default:
                this.turn = Math.random() > 0.5 ? 1 : 2;
        }
        this.started = true;
    }

    isFieldEmpty(x,y) {
        return this.board[y][x] === 0
    }

    fieldOwner(x,y) {
        return this.board[y][x]
    }

    play(x,y) {
        if (this.winner !== null) return false; // prevent malicious stuff from happening

        if (this.isFieldEmpty(x,y)) {
            // let tmp = this.board[y]
            // tmp[x] = this.turn;
            this.board[y][x] = this.turn;

            let result = this.checkWin(x,y, this.turn)
            this.highlight = {}
            for (let r of result.highlight) {
                this.highlight[r[0] + 'x' + r[1]] = true
            }
            result.highlight = this.highlight;

            if (result.win) {
                this.winner = this.turn === 1 ? this.plr1 : this.plr2
                result.winner = this.winner
            }
            else {
                this.turn = (this.turn % 2) + 1
            }
            return result;
        }
        return false
    }

    checkWin(x,y,plr) {
        let result = {win: false, highlight: [[x,y]]}

        this.genericCheck(x, y, plr, result, [1,0]);    // horizontal
        this.genericCheck(x, y, plr, result, [0,1]);    // vertical
        this.genericCheck(x, y, plr, result, [1,1]);    // diagonal \
        this.genericCheck(x, y, plr, result, [1,-1]);   // diagonal /

        return result
    }

    genericCheck(x,y,plr,result, [sx,sy]) {
        let localHighlight = []
        let seq = 1;
        let X = x + sx;
        let Y = y + sy;
        while (X >= 0 && X < this.width && Y >= 0 && Y < this.height && this.fieldOwner(X,Y) === plr) {
            seq++;
            localHighlight.push([X, Y])
            X += sx;
            Y += sy;
        }
        X = x - sx;
        Y = y - sy;
        while (X >= 0 && X < this.width && Y >= 0 && Y < this.height && this.fieldOwner(X,Y) === plr) {
            seq++;
            localHighlight.push([X, Y])
            X -= sx;
            Y -= sy;
        }
        if (seq >= 5) {
            result.highlight = result.highlight.concat(localHighlight)
            result.win = true
        }
    }
}

module.exports = ServerGame
