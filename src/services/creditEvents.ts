import { EventEmitter } from 'events';
import { Request, Response } from 'express';

interface Client {
  res: Response;
  ownerId: number | null;
  lastEventId?: string;
}

interface CreditEvent {
  ownerId: number;
  balance: number;
  change: number;
  type: string;
  reason?: string;
  at: string;
}

class CreditEventHub extends EventEmitter {
  private ownerClients: Map<number, Set<Client>> = new Map();
  private adminClients: Set<Client> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startPing();
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.ownerClients.forEach((clients) => {
        clients.forEach((client) => {
          try {
            client.res.write(`: ping\n\n`);
          } catch (e) {
            this.removeClient(client);
          }
        });
      });
      this.adminClients.forEach((client) => {
        try {
          client.res.write(`: ping\n\n`);
        } catch (e) {
          this.removeClient(client);
        }
      });
    }, 25000);
  }

  addOwnerClient(ownerId: number, res: Response, lastEventId?: string): void {
    const client: Client = { res, ownerId, lastEventId };
    if (!this.ownerClients.has(ownerId)) {
      this.ownerClients.set(ownerId, new Set());
    }
    this.ownerClients.get(ownerId)!.add(client);

    res.on('close', () => {
      this.removeClient(client);
    });

    // Send initial connected event with current balance
    this.emit('connected', { ownerId, res });
  }

  addAdminClient(res: Response): void {
    const client: Client = { res, ownerId: null };
    this.adminClients.add(client);

    res.on('close', () => {
      this.removeClient(client);
    });
  }

  private removeClient(client: Client): void {
    if (client.ownerId !== null) {
      const clients = this.ownerClients.get(client.ownerId);
      if (clients) {
        clients.delete(client);
        if (clients.size === 0) {
          this.ownerClients.delete(client.ownerId);
        }
      }
    } else {
      this.adminClients.delete(client);
    }
  }

  sendToOwner(ownerId: number, event: CreditEvent): void {
    const clients = this.ownerClients.get(ownerId);
    if (clients) {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      clients.forEach((client) => {
        try {
          client.res.write(data);
        } catch (e) {
          this.removeClient(client);
        }
      });
    }
  }

  sendToAllAdmins(event: CreditEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    this.adminClients.forEach((client) => {
      try {
        client.res.write(data);
      } catch (e) {
        this.removeClient(client);
      }
    });
  }

  emitCreditUpdate(event: CreditEvent): void {
    this.sendToOwner(event.ownerId, event);
    this.sendToAllAdmins(event);
  }
}

// Singleton instance
// NOTE: This hub is in-memory and works only on a single instance.
// Scaling would require Redis pub/sub for distributed SSE.
export const creditEventHub = new CreditEventHub();
