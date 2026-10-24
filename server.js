import http from "node:http";
import fs from 'node:fs';
import path from 'path';
import {WebSocketServer} from 'ws';


const PORT = 8000;



// http-server:
const httpServer = http.createServer(async (req, res) => {
    const htmlFile = await fs.promises.readFile(
        path.resolve("./index.html"),
        "utf-8"
    );
    res.setHeader('Content-Type', 'text/html');

    return res.end(htmlFile);
});


const wsServer = new WebSocketServer({
    server: httpServer
});

wsServer.on('connection', (webSocket) => {
    console.log(`client connected... ${webSocket.protocol}`);

    webSocket.on("message", (message) => {
        console.log(`received message from client...${message}`);
        wsServer.clients.forEach((client) => {
            client.send(message.toString());
        })
    })
})

httpServer.listen(PORT, () => {
    console.log(`server listening on port: ${PORT}`);
})