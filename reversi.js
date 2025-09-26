// reversi.js - Discord 黑白棋遊戲邏輯
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const BOARD_SIZE = 5;

class ReversiGame {
  constructor(player1, player2) {
    this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    this.current = 'B'; // B: 黑, W: 白
    this.players = { B: player1, W: player2 };
    this.winner = null;
    this.initBoard();
  }

  initBoard() {
    const mid = Math.floor(BOARD_SIZE / 2);
    this.board[mid - 1][mid - 1] = 'W';
    this.board[mid][mid] = 'W';
    this.board[mid - 1][mid] = 'B';
    this.board[mid][mid - 1] = 'B';
  }

  getValidMoves(color) {
    const moves = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (!this.board[y][x] && this.canFlip(x, y, color).length) {
          moves.push([x, y]);
        }
      }
    }
    return moves;
  }

  canFlip(x, y, color) {
    const dirs = [
      [1, 0], [0, 1], [-1, 0], [0, -1],
      [1, 1], [-1, -1], [1, -1], [-1, 1]
    ];
    const flips = [];
    for (const [dx, dy] of dirs) {
      let nx = x + dx, ny = y + dy;
      let line = [];
      while (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE) {
        if (this.board[ny][nx] === (color === 'B' ? 'W' : 'B')) {
          line.push([nx, ny]);
        } else if (this.board[ny][nx] === color) {
          if (line.length) flips.push(...line);
          break;
        } else {
          break;
        }
        nx += dx;
        ny += dy;
      }
    }
    return flips;
  }

  place(x, y, userId) {
    if (this.winner) return false;
    if (this.players[this.current] !== userId) return false;
    if (this.board[y][x]) return false;
    const flips = this.canFlip(x, y, this.current);
    if (!flips.length) return false;
    this.board[y][x] = this.current;
    flips.forEach(([fx, fy]) => {
      this.board[fy][fx] = this.current;
    });
    // 換手
    const next = this.current === 'B' ? 'W' : 'B';
    if (this.getValidMoves(next).length) {
      this.current = next;
    } else if (this.getValidMoves(this.current).length) {
      this.current = this.current;
    } else {
      this.winner = this.getWinner();
    }
    return true;
  }

  getWinner() {
    let b = 0, w = 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this.board[y][x] === 'B') b++;
        if (this.board[y][x] === 'W') w++;
      }
    }
    if (b > w) return 'B';
    if (w > b) return 'W';
    return 'D';
  }

  renderBoard() {
    const rows = [];
    const validMoves = this.getValidMoves(this.current);
    for (let y = 0; y < BOARD_SIZE; y++) {
      const row = new ActionRowBuilder();
      for (let x = 0; x < BOARD_SIZE; x++) {
        let label = '·';
        let style = ButtonStyle.Secondary;
        if (this.board[y][x] === 'B') {
          label = '●';
          style = ButtonStyle.Primary;
        }
        if (this.board[y][x] === 'W') {
          label = '○';
          style = ButtonStyle.Danger;
        }
        const isValid = validMoves.some(([vx, vy]) => vx === x && vy === y);
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`reversi_${x}_${y}`)
            .setLabel(label)
            .setStyle(style)
            .setDisabled(!!this.board[y][x] || !!this.winner || !isValid)
        );
      }
      rows.push(row);
    }
    return rows;
  }
}

export { ReversiGame, BOARD_SIZE };
