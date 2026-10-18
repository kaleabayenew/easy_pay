"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditEventHub = void 0;
const events_1 = require("events");
class CreditEventHub extends events_1.EventEmitter {
    constructor() {
        super();
        this.ownerClients = new Map();
        this.adminClients = new Set();
        this.pingInterval = null;
        this.startPing();
    }
    startPing() {
        this.pingInterval = setInterval(() => {
            const now = Date.now();
            this.ownerClients.forEach((clients) => {
                clients.forEach((client) => {
                    try {
                        client.res.write(`: ping\n\n`);
                    }
                    catch (e) {
                        this.removeClient(client);
                    }
                });
            });
            this.adminClients.forEach((client) => {
                try {
                    client.res.write(`: ping\n\n`);
                }
                catch (e) {
                    this.removeClient(client);
                }
            });
        }, 25000);
    }
    addOwnerClient(ownerId, res, lastEventId) {
        const client = { res, ownerId, lastEventId };
        if (!this.ownerClients.has(ownerId)) {
            this.ownerClients.set(ownerId, new Set());
        }
        this.ownerClients.get(ownerId).add(client);
        res.on('close', () => {
            this.removeClient(client);
        });
        // Send initial connected event with current balance
        this.emit('connected', { ownerId, res });
    }
    addAdminClient(res) {
        const client = { res, ownerId: null };
        this.adminClients.add(client);
        res.on('close', () => {
            this.removeClient(client);
        });
    }
    removeClient(client) {
        if (client.ownerId !== null) {
            const clients = this.ownerClients.get(client.ownerId);
            if (clients) {
                clients.delete(client);
                if (clients.size === 0) {
                    this.ownerClients.delete(client.ownerId);
                }
            }
        }
        else {
            this.adminClients.delete(client);
        }
    }
    sendToOwner(ownerId, event) {
        const clients = this.ownerClients.get(ownerId);
        if (clients) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            clients.forEach((client) => {
                try {
                    client.res.write(data);
                }
                catch (e) {
                    this.removeClient(client);
                }
            });
        }
    }
    sendToAllAdmins(event) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        this.adminClients.forEach((client) => {
            try {
                client.res.write(data);
            }
            catch (e) {
                this.removeClient(client);
            }
        });
    }
    emitCreditUpdate(event) {
        this.sendToOwner(event.ownerId, event);
        this.sendToAllAdmins(event);
    }
}
// Singleton instance
// NOTE: This hub is in-memory and works only on a single instance.
// Scaling would require Redis pub/sub for distributed SSE.
exports.creditEventHub = new CreditEventHub();
