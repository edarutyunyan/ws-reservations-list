import ws, {WebSocket} from 'ws';
import * as url from "url";
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

type WebSocketWithId = WebSocket & {id: string};

const redisClient = createClient();
redisClient.connect();

const webSocket = new ws.WebSocket.Server({ host: '127.0.0.1', port: 3001, verifyClient: (info, callback) => callback(true) });

webSocket.on('connection', (connection: WebSocketWithId, request) => {
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

  connection.id = company as string;

  connection.on('message', async (msg) => {
    const { data } = JSON.parse(msg.toString());

    if (data && data.reservationsList) {
      await redisClient.hSet(company as string, user as string, JSON.stringify(data.reservationsList));
    }

    const companyReservationsList = await redisClient.hGetAll(company as string);
    console.log(data, companyReservationsList);

    webSocket.clients.forEach((client) => {
      delete companyReservationsList[user as string];
      client.send(JSON.stringify(companyReservationsList));
    })
  });

});