"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalManager = void 0;
const pty = __importStar(require("node-pty"));
const path_1 = __importDefault(require("path"));
const SHELL = "bash";
class TerminalManager {
    constructor() {
        this.sessions = {};
        this.sessions = {};
    }
    createPty(id, replId, onData) {
        let term = pty.spawn(SHELL, [], {
            cols: 100,
            name: 'xterm',
            cwd: path_1.default.join(__dirname, `../workspace`) // Changed to a generic workspace folder for the runner
        });
        term.onData((data) => onData(data, term.pid));
        this.sessions[id] = {
            terminal: term,
            replId
        };
        term.onExit(() => {
            delete this.sessions[term.pid];
        });
        return term;
    }
    write(terminalId, data) {
        var _a;
        (_a = this.sessions[terminalId]) === null || _a === void 0 ? void 0 : _a.terminal.write(data);
    }
    clear(terminalId) {
        this.sessions[terminalId].terminal.kill();
        delete this.sessions[terminalId];
    }
}
exports.TerminalManager = TerminalManager;
