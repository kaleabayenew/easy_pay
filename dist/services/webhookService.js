"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWebhook = void 0;
const axios_1 = __importDefault(require("axios"));
const sendWebhook = async (webhookUrl, payload) => {
    try {
        await axios_1.default.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 second timeout
        });
        return true;
    }
    catch (error) {
        console.error('Webhook send error:', error);
        return false;
    }
};
exports.sendWebhook = sendWebhook;
