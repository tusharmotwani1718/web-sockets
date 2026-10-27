import http from "node:http";
import fs from 'node:fs';
import path from 'path';
import { WebSocketServer } from 'ws';


const PORT = process.env.PORT;
// How often the server pings every client. A dead client is detected
// within 1–2 intervals (30–60s here). Override with env to experiment.
const HEARTBEAT_INTERVAL = Number(process.env.HEARTBEAT_INTERVAL ?? 30_000);


// http-server:
const httpServer = http.createServer(async (req, res) => {
    const htmlFile = await fs.promises.readFile(
        path.resolve("./index.html"),
        "utf-8"
    );
    res.setHeader('Content-Type', 'text/html');

    return res.end(htmlFile);
});


// use the http server for web socket
const wsServer = new WebSocketServer({
    server: httpServer
});

wsServer.on('connection', (webSocket) => {
    console.log(`client connected... ${webSocket.protocol}`);
    // A fresh connection is alive by definition.
    webSocket.isAlive = true;
    // The client's WebSocket implementation (browser or `ws`) answers our
    // protocol-level ping frames automatically. Each pong = "still here".
    webSocket.on("pong", () => {
        webSocket.isAlive = true;
    });

    webSocket.on("message", (message) => {
        console.log(`received message from client...${message}`);

        // App-level ping FROM the client. Browsers can't send protocol ping
        // frames from JS, so the page sends this to check the server is alive.
        if (message.type === "ping") {
            webSocket.send(JSON.stringify({ type: "pong" }));
            return;
        }

        if (message.type === "chat") {
            console.log(`received message from ${who}: ${message.text}`);
            const out = JSON.stringify({ type: "chat", text: message.text });
            wsServer.clients.forEach((client) => {
                // `clients` can include sockets that are mid-close; skip those.
                if (client.readyState === WebSocket.OPEN) client.send(out);
            });
        }
    })

    // mark the client alive, if we receive the "pong" event
    webSocket.on("pong", () => {
        webSocket.isAlive = true;
    })
})

// Every interval: anyone who didn't pong since the LAST round is dead.
// Everyone else gets flagged "unconfirmed" and pinged again.
const heartbeat = setInterval(() => {
    wsServer.clients.forEach((webSocket) => {
        if (webSocket.isAlive === false) {
            console.log("no pong since last ping — terminating");
            // terminate(), not close(): close() starts a polite close handshake
            // and waits for a reply that a dead peer will never send.
            return webSocket.terminate();
        }
        webSocket.isAlive = false;
        webSocket.ping();
    });
}, HEARTBEAT_INTERVAL);

wsServer.on("close", () => clearInterval(heartbeat))

httpServer.listen(PORT, () => {
    console.log(`server listening on port: ${PORT}`);
})