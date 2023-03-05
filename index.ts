import ws from 'ws';
import * as url from "url";
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient();
redisClient.connect();

const WS_HOST = process.env.WS_HOST ?? '';
const WS_PORT = +(process.env.WS_PORT ?? 5000);

const webSocket = new ws.WebSocket.Server({
  host: WS_HOST,
  port: WS_PORT,
  verifyClient: (info, callback) => callback(true)
});

webSocket.on('connection', (connection, request) => {
  const { company, user } = url.parse(request.url ?? '', true).query;

  if (!company || !user) {
    connection.close(3003);
    return;
  }

  connection.onclose = async function (event) {
    console.log('connection closed', event.reason);
    await redisClient.hDel(company as string, user as string);
    // remove him from senders and listeners
    // also remove his reservationsList
  }

  connection.on('message', async (msg) => {
    const { data } = JSON.parse(msg.toString());

    if (data && data.reservationsList) {
      await redisClient.hSet(company as string, user as string, JSON.stringify(data.reservationsList));
    }

    const companyReservationsList = await redisClient.hGetAll(company as string);

    webSocket.clients.forEach((client) => {
      delete companyReservationsList[user as string];
      client.send(JSON.stringify(companyReservationsList));
    })
  });
});